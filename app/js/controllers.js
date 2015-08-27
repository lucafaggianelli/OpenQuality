'use strict';

var manifest = require('../package.json');
var gui = require('nw.gui');

// App version
var VERSION = manifest.version;

// Poll interval for fetching QC Audit
var NOTIFICATIONS_INTERVAL = 2 * 60;

/* Controllers */
var openQualityControllers = angular.module('openQualityControllers', []);

openQualityControllers.controller('MainCtrl', ['$scope', '$routeParams', 'ALMx', 'Settings', 'Notifications', '$timeout',
    function($scope, $routeParams, ALMx, Settings, Notifications, $timeout) {
        $scope.domain = $routeParams.domain;
        $scope.project = $routeParams.project;
        $scope.domains = null;
        $scope.loading = false;
        $scope.user = ALM.getLoggedInUser();
        $scope.loadingModal = angular.element('#loading');

        var alertTimeout = null;
        $scope.alert = {
            show: false,
            type: 'alert-info',
            class: 'fade out',
            title: 'Alert!',
            body: 'Theres a problem'
        };

        $scope.closeAlert = function() {
            $scope.alert.class = 'fade out';
            $scope.alert.show = false;
        };

        $scope.showAlert = function(event, data) {
            $scope.alert.title = data.title || '';
            $scope.alert.body = data.body || '';

            $scope.alert.type = 'alert-' + (data.type || 'info');
            $scope.alert.class = 'fade in';
            $scope.alert.show = true;
            $scope.$apply();

            if (alertTimeout)
                $timeout.cancel(alertTimeout)
            alertTimeout = $timeout($scope.closeAlert, 5000);
        };

        var loadAllDomains = function(callback) {
            // Get all domains
            ALM.getDomains(function(err, domains) {
                if (err) {
                    callback(err);
                    return;
                }

                $scope.domains = {};
                // Get all project for each domain
                async.each(domains, function(dom, cb) {
                    ALM.getProjects(dom, function(projects) {
                        $scope.domains[dom] = projects;
                        cb();
                    }, function() {
                        cb('cannot init projects')
                    });
                }, function(err) {
                    $scope.$apply();
                    callback(err);
                });
            });
        }

        $scope.$on('$routeChangeSuccess', function(event, next, current) {
            var dom = next.params.domain;
            var prj = next.params.project;
            
            if ($scope.domain != dom || $scope.project != prj) {
                $scope.domain = dom;
                $scope.project = prj;
                ALM.setCurrentProject($scope.domain, $scope.project);

                if ($scope.domain != null && $scope.project != null) {
                    console.log('Project changed to '+dom+':'+prj);
                    localStorage.setItem('lastProject', dom+'.'+prj);
                    Notifications.startNotifier();
                } else {
                    console.log('Exited from project');
                    Notifications.stopNotifier();
                }
            }
        });

        $scope.$on('alert', $scope.showAlert);

        $scope.$on('loggedIn', function(event, username) {
            if (username) {
                // Logged in
                loadAllDomains(function() {
                    var dom;
                    for (var i in $scope.domains) {
                        dom = i; break;
                    }

                    ALM.getUsers(function(u) {
                        $scope.user = u[username];
                        $scope.$apply();
                    }, function() {
                        $scope.user = {id: ALM.getLoggedInUser()};
                        $scope.$apply();
                    }, username, dom, $scope.domains[dom][0]);
                });
            } else {
                // Logged out
                $scope.user = null;
            }
            $scope.$apply();
        });

        // If no server set, go to settings
        if (!Settings.settings.serverAddress) {
            console.log('server not set');
            location.hash = '/settings';
            return;
        }

        ALM.setServerAddress(Settings.settings.serverAddress);

        if (Settings.settings.rememberProject && (!location.hash || location.hash == '#/')) {
            var lastProject = localStorage.getItem('lastProject');
            if (lastProject) {
                lastProject = lastProject.split('.');
                console.log('Your last project is '+lastProject);
                location.hash = '/'+lastProject[0]+'/projects/'+lastProject[1];
            }
        }

        ALM.tryLogin(
            function(username) {
                loadAllDomains(function() {
                    var dom;
                    for (var i in $scope.domains) {
                        dom = i; break;
                    }

                    ALM.getUsers(function(u) {
                        $scope.user = u[username];
                        $scope.$apply();
                    }, function() {
                        $scope.user = {id: ALM.getLoggedInUser()};
                        $scope.$apply();
                    }, username, dom, $scope.domains[dom][0]);
                });
            },
            function(error) {
                console.log('trylogin: not logged in')
            }
        );
    }]);

openQualityControllers.controller('HomeCtrl', ['$scope', '$location',
    function($scope, $location) {
        ALM.tryLogin(
            function(username) { },
            function(error) { }
        );
    }]);

openQualityControllers.controller('LoginCtrl', ['$scope', 'Settings',
    function($scope, Settings) {

        $scope.login = function(u, p) {
            var username = u || $scope.username;
            var password = p || $scope.password;
            var remember = $scope.remember;

            ALM.login(username, password,
                function(data) {
                    $scope.$emit('alert', {type:'success',body:'Logged in as '+username});
                    if (remember) {
                        Settings.setAccount(username, password);
                    }

                    sessionStorage.setItem('currentUser', username);
                    $scope.$emit('loggedIn', username);
                    location.hash = sessionStorage.getItem('redirectAfterLogin') || '/';
                    sessionStorage.removeItem('redirectAfterLogin');
                },
                function(data) {
                    $scope.$emit('alert', {type:'danger',body:'Can\'t login'});
                    $scope.$emit('loggedIn', null);
                }
            );
        }

        if (Settings.settings.username && Settings.settings.password) {
            console.log('Found an account, will login');
            $scope.login(Settings.settings.username, Settings.settings.password);
        }
    }
]);

openQualityControllers.controller('SettingsCtrl', ['$scope', 'Settings',
    function($scope, Settings) {
        $scope.version = VERSION;

        $scope.settings = Settings.settings;

        $scope.saveSettings = function(settings) {
            // Need trailing slash
            if (settings.serverAddress.substr(-1) != '/')
                settings.serverAddress += '/';

            Settings.save(settings);
            ALM.setServerAddress(settings.serverAddress);

            if ($scope.settingsForm.username.$dirty ||
                $scope.settingsForm.password.$dirty ||
                $scope.settingsForm.serverAddress.$dirty) {
                ALM.login(settings.username, settings.password,
                    function() {
                        $scope.settingsForm.$setPristine();
                        $scope.$emit('loggedIn', settings.username);
                        $scope.$emit('alert', {type:'success',body:'Logged in as '+settings.username});
                    }, function() {
                        $scope.settingsForm.$setPristine();
                    });
            }
        }
    }]);

openQualityControllers.controller('ProjectListCtrl', ['$scope',
    function($scope) {
        console.error('ProjectListCtrl deprecated');
        $scope.domain = ALM.getCurrentDomain();

        ALM.getProjects($scope.domain,
            function(prjs) {
                $scope.projects = prjs;
                $scope.$apply();
            },
            function(err) {
                console.log('cant load projects', err);
            });
    }]);

openQualityControllers.controller('ProjectDetailCtrl', ['$scope', '$routeParams', 'ALMx',
    function($scope, $routeParams, ALMx) {
        $scope.domain = $routeParams.domain;
        $scope.project = $routeParams.project;
        $scope.news = [];
        $scope.stats = {};

        $scope.getDefectUrl = function(id) {
            return '#/'+$scope.domain+'/projects/'+$scope.project+'/defects/'+id;
        }

        $scope.getHistory = function() {
            var time = moment().startOf('week').format('YYYY-MM-DD');
            ALM.getProjectHistory(time, function(err, history) {
                if (err)
                    console.log(err);

                $scope.news = history.Audit;
                $scope.$apply();
            });
        };

        $scope.getStats = function() {
            ALM.getDefects(function(defects, count) {
                $scope.stats.closed = parseInt(count);
                $scope.$apply();
            }, function() {
            }, 'status[Closed OR Fixed OR Rejected]', ['id'],1,1);

            ALM.getDefects(function(defects, count) {
                $scope.stats.total = parseInt(count);
                $scope.$apply();
            }, function() {
            }, 'status[*]', ['id'],1,1);
        };

        ALMx.update($scope.domain, $scope.project, function() {
            console.log('project update is ready');
            $scope.Users = ALMx;
            $scope.fields = ALMx.fields;

            $scope.getHistory();
            $scope.getStats();
        });
    }]);

openQualityControllers.controller('DefectListCtrl', ['$scope', '$routeParams', 'ALMx', '$modal',
    function($scope, $routeParams, ALMx, $modal) {
        $scope.domain = $routeParams.domain;
        $scope.project = $routeParams.project;
        $scope.loggedInUser = ALM.getLoggedInUser();
        $scope.gotoDefect = null;
        $scope.pageSize = 100;
        $scope.currentPage = 1;
        $scope.defectDetailsModal = false;

        var fields = [
                "id",
                "name",
                "description",
                "dev-comments",
                "attachment",
                "last-modified",
                "owner",
                "status",
                "severity",
                "priority"];

        $scope.searchFilters = JSON.parse(localStorage.getItem('filters.search'));
        $scope.sortFilters = JSON.parse(localStorage.getItem('filters.sort'));

        $scope.updateSortButtons = function() {
            angular.forEach($scope.sortButtons, function(value, key) {
                if (key == $scope.sortFilters.param) {
                    $scope.sortButtons[key].btn = 'btn-primary';
                    $scope.sortButtons[key].icon = $scope.sortFilters.reverse ? 
                        'glyphicon-sort-by-attributes-alt':'glyphicon-sort-by-attributes';
                } else {
                    $scope.sortButtons[key].btn = 'btn-default';
                    $scope.sortButtons[key].icon = 'glyphicon-sort-by-attributes';
                }
            });
        }

        $scope.sortButtons = {
            'id': {btn:'btn-default',icon:'glyphicon-sort-by-attributes-alt'},
            'last-modified': {btn:'btn-default',icon:'glyphicon-sort-by-attributes-alt'},
            'severity': {btn:'btn-default',icon:'glyphicon-sort-by-attributes-alt'},
            'priority': {btn:'btn-default',icon:'glyphicon-sort-by-attributes-alt'},
        };
        $scope.updateSortButtons();

        $scope.sort = function(param) {
            // If press again the sort button, reverse the order
            if ($scope.sortFilters.param == param) {
                $scope.sortFilters.reverse = !$scope.sortFilters.reverse;
            } else {
                $scope.sortFilters.param = param;
                $scope.sortFilters.predicate = '"'+param+'"';
            }
            $scope.searchForm.$setDirty();
            $scope.updateSortButtons();
        };

        $scope.getSeverityIcon = ALMx.getDefectSeverityIcon;
        $scope.getPriorityIcon = ALMx.getDefectPriorityIcon;

        $scope.getDefects = function() {
            var queryString = '';

            if ($scope.searchFilters.query) {
                var values, query;
                for (var param in $scope.searchFilters.query) {
                    values = $scope.searchFilters.query[param];

                    // When the search param is not set
                    if (values === undefined || values === null)
                        continue;

                    // Make single values as arrays
                    if (typeof(values) == 'string')
                        values = [values];
                    
                    // Literals must be quoted to avoid white space issues
                    values = values.map(function(x){return '"'+x+'"';});
                    queryString += param + '[' + values.join(' OR ') + '];';
                }
            }

            ALM.getDefects(
                function onSuccess(defects, totalCount) {
                    $scope.totalPages = new Array(Math.ceil(totalCount / $scope.pageSize));

                    // Rework defects
                    var defect;
                    for (var i in defects) {
                        defect = defects[i];

                        defects[i].id = parseInt(defect.id)

                        // Status table row class
                        if (defect.status) {
                            defects[i].statusClass = STATUS_CLASSES[defect.status] || '';
                        }
                    }

                    $scope.defects = defects;
                    $scope.$apply();

                    if (!$scope.filteredDefects)
                        ALMx.lastSearch = [];
                    else
                        ALMx.lastSearch = $scope.filteredDefects.map(function(d){ return d.id; });
                },
                function onError() {
                    console.log('error getting defects');
                    ALMx.lastSearch = [];
                    $scope.$apply();
                },
                queryString, fields, $scope.pageSize, ($scope.currentPage-1) * $scope.pageSize + 1);
        };

        $scope.setPage = function(page) {
            if (page <= 0 || page > $scope.totalPages.length)
                return;
            $scope.currentPage = page;
            $scope.getDefects();
        };

        $scope.resetSearchFilters = function() {
            $scope.searchFilters = JSON.parse(localStorage.getItem('filters.search'));
            $scope.sortFilters = JSON.parse(localStorage.getItem('filters.sort'));
            $scope.updateSortButtons();
            $scope.searchForm.$setPristine();

            $scope.getDefects();
        };

        $scope.saveFilters = function() {
            console.log($scope.sortFilters);
            localStorage.setItem('filters.search', JSON.stringify($scope.searchFilters));
            localStorage.setItem('filters.sort', JSON.stringify($scope.sortFilters));

            $scope.getDefects();
        };

        $scope.showDefect = function(id) {
            //location.hash = '/'+$scope.domain+'/projects/'+$scope.project+'/defects/'+id;
            //$scope.defectDetailsModal = true;
            //$scope.$broadcast('showDefect', id);

            var modalInstance = $modal.open({
              animation: $scope.animationsEnabled,
              templateUrl: 'partials/defect-detail.html',
              controller: 'DefectDetailCtrl',
              size: 'lg',
              resolve: {
                defect_id: function () {
                  return id;
                }
              }
            });

          };
        window.onscroll = function() {
            var doc = document.documentElement;
            var left = (window.pageXOffset || doc.scrollLeft) - (doc.clientLeft || 0);
            var top = (window.pageYOffset || doc.scrollTop)  - (doc.clientTop || 0);
        }

        $scope.$on('updateDefectList', function() {
            $scope.getDefects();
        });

        ALMx.update($scope.domain, $scope.project, function() {
            $scope.Users = ALMx;
            $scope.fields = ALMx.fields;
            $scope.loggedInUser = ALM.getLoggedInUser();

            $scope.getDefects();
        });
    }]);

openQualityControllers.controller('DefectDetailCtrl', ['$scope', '$routeParams', 'ALMx', 'defect_id',
    function($scope, $routeParams, ALMx, defect_id) {
        var originalDefect = null;
        $scope.domain = $routeParams.domain;
        $scope.project = $routeParams.project;
        $scope.defect_id  = defect_id || $routeParams.defect;
        $scope.defect = null;
        $scope.lastSearch = ALMx.lastSearch;
        $scope.defectIndex = ALMx.lastSearch.indexOf($scope.defect_id);

        $scope.getFileSizeString = Utils.getFileSizeString;
        $scope.toolbar = TEXTANGULAR_TOOLBAR;

        $scope.newLink = {};

        $(function () {
            //scrollTo(0,0);
            $('[data-toggle="tooltip"]').tooltip()
        })

        $scope.isImg = function(filename) {
            var suffix;
            for (var i in IMGS_SUFFIX) {
                suffix = IMGS_SUFFIX[i];
                if (filename.indexOf(suffix, filename.length - suffix.length) !== -1) {
                    return true;
                }
            }
            return false;
        };

        $scope.updateField = function(field) {
            console.log('Changing '+field+' to', $scope.defect[field]);
            ALM.updateField($scope.defect, field, function(err) {
                if (err) {
                    console.log('cant update field:', err);
                    $scope.$emit('alert', {type: 'danger', body: 'Unable to change defect field "'+field+'"!'});
                    return;
                }

                console.log('field changed');
                $scope.$emit('alert', {type: 'success', body: 'Successfully changed defect field "'+field+'"!'});
            });
        }

        $scope.addAttachment = function() {
            var fileInput = angular.element('#new-attach-file')[0];
            var formData = new FormData();

            if (fileInput.files.length == 1) {
                var file = fileInput.files[0];

                // Add the file to the request.
                formData.append('file', file, file.name);
                formData.append('filename', file.name);
                console.log('file is '+file.name);
            }

            if ($scope.newAttachDesc) {
                formData.append('description', $scope.newAttachDesc);
            }

            ALM.addAttachment($scope.defect.id, formData, function(err, data) {
                console.log(err, data);
            });
        };

        $scope.addLink = function() {
            $scope.newLink['first-endpoint-id'] = $scope.defect.id;

            console.log($scope.newLink)
            ALM.createDefectLink($scope.newLink, function(err,link) {
                if (err) {
                    $scope.$emit('alert', {type: 'danger', body: 'Can\'t create link!'});
                    return;
                } else {
                    $scope.$emit('alert', {type: 'success', body: 'Link successfully created!'});
                }
                console.log(link);
                $scope.defect.links.push(link);
                $scope.$apply();
            });
        }

        $scope.addComment = function(content) {
            ALM.getDefects(function(defect, count) {
                if (count == 1) {
                    defect = defect[0];
                } else {
                    console.log('expected 1 defect, got '+count);
                    return;
                }

                var newComment = {
                    user: ALMx.getUser(ALM.getLoggedInUser()).fullname,
                    date: moment().format('YYYY/MM/DD HH:mm:ss'),
                    content: content.replace(/<[^>]+>/gm, '')
                };
                var html = '';
                var firstComment = !defect['dev-comments'];

                // If first comment, need <html>
                if (firstComment)
                    html += COMMENT_HTML_START;

                html += '<div align="left">';

                // Divider if not the first comment
                if (!firstComment)
                    html += COMMENT_DIVIDER;

                // Header
                html += '<font face="Arial" color="#000080" size="1"><span style="font-size:8pt"><b>';
                html += newComment.user;
                html += ' &lt;'+ALM.getLoggedInUser()+'&gt;, ';
                html += newComment.date+':';
                html += '</b></span></font></div>';

                // Body
                //html += '<div align="left"><font face="Arial"><span style="font-size:9pt">';
                html += content;
                //html += '</span></font></div>';

                // If first comment, need </html>
                if (firstComment)
                    html += COMMENT_HTML_END;

                // Append the comment
                if (!firstComment) {
                    var pos = defect['dev-comments'].indexOf('</body>');
                    var html = defect['dev-comments'].substr(0, pos) + html + 
                        defect['dev-comments'].substr(pos);
                }

                $scope.defect['dev-comments'] = html;

                ALM.updateField($scope.defect, 'dev-comments', function(err) {
                    if (err) {
                        $scope.$emit('alert', {type: 'danger', body: 'Can\'t comment the defect!'});
                        return;
                    }

                    $scope.$emit('alert', {type: 'success', body: 'Successfully commented defect!'});
                    $scope.defect.comments.push(newComment);
                    $scope.$apply();
                });

            }, function() {
                $scope.$emit('alert', {type: 'danger', body: 'Can\'t comment the defect!'});
                console.log('error');
            }, 'id["'+$scope.defect_id+'"]', ['dev-comments']);
        };

        var fields = ["id","name","description","dev-comments",
                    "severity","attachment","detection-version",
                    "creation-time",
                    "owner",
                    "detected-by",
                    "status",
                    "priority",
                    "user-09", // Fixed in version
                    "user-01", // Terminal
                    "user-03", // Discipline
            ];

        $scope.getDefect = function() {
            var queryString = 'id["'+$scope.defect_id+'"]';
            ALM.getDefects(function(defects, totalCount) {
                if (totalCount == 1) {
                    originalDefect = defects[0];
                    $scope.defect = defects[0];
                    $scope.defect.links = [];
                    $scope.defect.comments = [];
                    $scope.descrMore = true;
    
                    // Comments - prettify
                    if ($scope.defect['dev-comments']) {
                        var tmp;
                        $scope.defect.comments = $scope.defect['dev-comments']
                                .replace(/<html>[\r\n]*<body>[\r\n]*/,'')
                                .replace(/[\r\n]*<\/body>[\r\n]*<\/html>/,'')
                                .split(/<b>_{10,}<\/b>/g).map(function(comment) {
                            tmp = comment.split(/(.+)\s+&lt;.*&gt;,\s+([0-9\/]+\s*[0-9:]*)\s*:/);
                            if (tmp && tmp.length == 4)
                                return {
                                    user: Utils.html2txt(tmp[1]).replace(/&nbsp;/g, ''),
                                    date: tmp[2].replace(/&nbsp;/g, ''),
                                    content: tmp[3] };
                            else
                                return {
                                    user: null,
                                    date: null,
                                    content: comment };
                        });
                        
                        if (!$scope.defect.comments)
                            $scope.defect.comments = [];

                        // show comments in original QC order
                        //$scope.defect.comments.reverse();
                    }

                    // Severity icon
                    $scope.defect.severityIcon = ALMx.getDefectSeverityIcon($scope.defect.severity);
                    $scope.defect.priorityIcon = ALMx.getDefectPriorityIcon($scope.defect.priority);
                    $scope.$apply();

                    // Forward HTTP links to the OS
                    $('.defect-detail-description a, .defect-detail-comments a').click(function(event) {
                        if (event.target.href && event.target.href.match(/https*:\/\//)) {
                            gui.Shell.openExternal(event.target.href);
                            return false;
                        }
                    });
                    
                    if ($('.defect-detail-description')[0].offsetHeight <= 100) {
                        $('.description-show-more').hide();
                    } else {
                        $('.description-show-more').addClass('less');
                        $scope.descrMore = false;
                    }
                    
                    $scope.$apply();
                } else {
                    $scope.defectNotFound = true;
                    $scope.$apply();
                    return;
                }

                ALM.getLinks($scope.defect.id, function(err, links) {
                    if (err)
                        return;

                    console.log(links);

                    $scope.defect.links = links;
                    $scope.$apply();
                });

                if ($scope.defect.attachment) {
                    ALM.getDefectAttachments($scope.defect.id, function(res) {
                        $scope.defect.attachments = res;
                        $scope.$apply();
                    }, function() {
                    });
                }
            },
            function onError() {
            },
            queryString, fields);
        }

        $scope.backToSearch = function() {
            location.hash = '#/'+$scope.domain+'/projects/'+$scope.project+'/defects';
        };

        $scope.gotoDefect = function(id) {
            location.hash = '#/'+$scope.domain+'/projects/'+$scope.project+'/defects/'+id;
        };

        $scope.$on('showDefect', function(event, id) {
            $scope.defect_id = id;
            //$scope.Users = ALMx;
            //$scope.fields = ALMx.fields;

            $scope.getDefect();
        });

        ALMx.update($scope.domain, $scope.project, function() {
            console.log('project update is ready');
            $scope.Users = ALMx;
            $scope.fields = ALMx.fields;

            $scope.getDefect();
        });
    }]);

openQualityControllers.controller('DefectNewCtrl', ['$scope', '$routeParams', 'ALMx',
    function($scope, $routeParams, ALMx) {
        $scope.domain = $routeParams.domain;
        $scope.project = $routeParams.project;
        $scope.toolbar = TEXTANGULAR_TOOLBAR;

        $scope.newDefect = true;

        // Default value for defects
        $scope.defect = {
            status: 'New',
            severity: '3-Minor functional',
            priority: '2-Medium',
        };

        $scope.createDefect = function(defect) {
            // Surround with HTML and BODY tags
            defect.description = DESCRIPTION_HTML_START + defect.description + DESCRIPTION_HTML_END;

            // Add pre-defined fields
            defect['detected-by'] = ALM.getLoggedInUser();
            defect['creation-time'] = moment().format('YYYY-MM-DD HH:mm:ss');

            angular.forEach($scope.defectedit, function(value, key) {
                if(key[0] == '$') return;
                console.log(key, value.$dirty)
            });

            ALM.createDefect(defect, function(err, result) {
                console.log(err,result);
                if (err) {
                    $scope.$emit('alert', {type:'danger', body:'Cant create defect'});
                } else {
                    $scope.$emit('alert', {type:'success', body:'Successfully created defect'});
                }
                console.log('going to', '/'+$scope.domain+'/projects/'+$scope.project+'/defects/'+result[0].id);
                location.hash = '/'+$scope.domain+'/projects/'+$scope.project+'/defects/'+result[0].id;
            });
        }

        ALMx.update($scope.domain, $scope.project, function() {
            $scope.users = Utils.obj2arr(ALMx.users);
            $scope.fields = ALMx.fields;
        });
    }]);

/**
 * Constants
 */

var TEXTANGULAR_TOOLBAR = "["+
    "['bold','italics','underline','strikeThrough'],"+
    "['ul','ol','indent','outdent'],"+
    "['justifyLeft','justifyCenter','justifyRight'],"+
    "['pre','insertLink'],"+
    "['undo','redo','clear'],"+
    "['html']"+
    "]";

var IMGS_SUFFIX = ['.png', '.bmp', '.jpg', '.jpeg', '.gif'];

var SEVERITY_ICONS = [
    null,
    'gift', // 1 feature request
    'circle-arrow-down', // 2 cosmetic
    'arrow-down', // minor
    'arrow-up', // major
    'fire' // 5 crash data loss
];

var STATUS_CLASSES = {
    New: 'text-info',
    Open: 'text-success',
    Closed: 'text-danger',
    Fixed: 'text-danger',
    Rejected: 'text-warning',
    Reopen: 'text-warning',
}

//var DESCRIPTION_HTML_START = '<html><body><div align="left"><font face="Arial"><span style="font-size:9pt">';
//var DESCRIPTION_HTML_END = '</span></font></div>';
var DESCRIPTION_HTML_START = '<html><body>';
var DESCRIPTION_HTML_END = '</body></html>';

var COMMENT_HTML_START = '<html><body>';
var COMMENT_HTML_END = '</body></html>';
var COMMENT_DIVIDER = '<font face="Arial"><span style="font-size:9pt"><br /></span></font><font face="Arial" color="#000080"><span style="font-size:9pt"><b>________________________________________</b></span></font><font face="Arial"><span style="font-size:9pt"><br /></span></font>';
