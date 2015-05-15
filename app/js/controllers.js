'use strict';

var manifest = require('../package.json');

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

        $scope.hello = function(num) {
            console.log(num);
        };

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
            console.log('saving', settings)
            Settings.save(settings);
            ALM.setServerAddress(Settings.settings.serverAddress);
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

openQualityControllers.controller('ProjectDetailCtrl', ['$scope', '$routeParams',
    function($scope, $routeParams) {
        // TODO Deprecated
        console.warn('ProjectDetailCtrl implement me as dashboard');
        $scope.domain = $routeParams.domain;
        $scope.project = $routeParams.project;
    }]);

openQualityControllers.controller('DefectListCtrl', ['$scope', '$routeParams', 'ALMx',
    function($scope, $routeParams, ALMx) {
        $scope.domain = $routeParams.domain;
        $scope.project = $routeParams.project;
        $scope.loggedInUser = ALM.getLoggedInUser();
        $scope.gotoDefect = null;
        $scope.pageSize = 50;
        $scope.currentPage = 1;

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
                    $scope.sortButtons[key].btn = 'btn-success';
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
                    // Literals must be quoted to avoid white space issues
                    values = values.map(function(x){return '"'+x+'"';});
                    queryString += param + '[' + values.join(' OR ') + '];';
                }
            }

            ALM.getDefects(
                function onSuccess(defects, totalCount) {
                    $scope.totalPages = new Array(Math.ceil(totalCount / $scope.pageSize));
                    $scope.defects = defects;

                    // Status table row class
                    for (var i in $scope.defects) {
                        if ($scope.defects[i].status) {
                            $scope.defects[i].statusClass = STATUS_CLASSES[$scope.defects[i].status] || '';
                        }
                    }

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

            $scope.getDefects();
        };

        $scope.saveFilters = function() {
            console.log($scope.sortFilters);
            localStorage.setItem('filters.search', JSON.stringify($scope.searchFilters));
            localStorage.setItem('filters.sort', JSON.stringify($scope.sortFilters));

            $scope.getDefects();
        };

        $scope.showDefect = function(id) {
            location.hash = '/'+$scope.domain+'/projects/'+$scope.project+'/defects/'+id;
        }

        window.onscroll = function() {
            var doc = document.documentElement;
            var left = (window.pageXOffset || doc.scrollLeft) - (doc.clientLeft || 0);
            var top = (window.pageYOffset || doc.scrollTop)  - (doc.clientTop || 0);
        }

        $scope.$on('updateDefectList', function() {
            $scope.getDefects();
        });

        ALMx.update($scope.domain, $scope.project, function() {
            console.log('project update is ready');
            $scope.Users = ALMx;
            $scope.fields = ALMx.fields;

            $scope.getDefects();
        });
    }]);

openQualityControllers.controller('DefectDetailCtrl', ['$scope', '$routeParams', 'ALMx', '$filter',
    function($scope, $routeParams, ALMx, $filter) {
        var originalDefect = null;
        $scope.domain = $routeParams.domain;
        $scope.project = $routeParams.project;
        $scope.defect_id  = $routeParams.defect;
        $scope.defect = null;
        $scope.lastSearch = ALMx.lastSearch;
        $scope.defectIndex = ALMx.lastSearch.indexOf($scope.defect_id);

        $scope.getFileSizeString = Utils.getFileSizeString;
        $scope.toolbar = TEXTANGULAR_TOOLBAR;

        $(function () {
            scrollTo(0,0);
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

        $scope.addComment = function() {
            ALM.getDefects(function(defect, count) {
                if (count == 1) {
                    defect = defect[0];
                } else {
                    console.log('expected 1 defect, got '+count);
                    return;
                }

                var newComment = {
                    user: ALMx.getUser(ALM.getLoggedInUser()).fullname,
                    date: $filter('date')(new Date(),'yyyy/MM/dd HH:mm:ss')+':',
                    content: $scope.newComment.replace(/<[^>]+>/gm, '')
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
                html += newComment.date;
                html += '</b></span></font></div>';

                // Body
                //html += '<div align="left"><font face="Arial"><span style="font-size:9pt">';
                html += $scope.newComment;
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

                ALM.saveDefect(function() {
                        $scope.$emit('alert', {type: 'success', body: 'Successfully commented defect!'});
                        $scope.defect.comments.unshift(newComment);
                        $scope.$apply();
                    }, function() {
                        $scope.$emit('alert', {type: 'danger', body: 'Can\'t comment the defect!'});
                    }, {id: $scope.defect.id, 'dev-comments': html},
                    $scope.defect);
            }, function() {
                $scope.$emit('alert', {type: 'danger', body: 'Can\'t comment the defect!'});
                console.log('error');
            }, 'id["'+$scope.defect_id+'"]', ['dev-comments']);
        };

        var queryString = 'id["'+$scope.defect_id+'"]',
            fields = ["id","name","description","dev-comments",
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
            ALM.getDefects(function(defects, totalCount) {
                if (totalCount == 1) {
                    originalDefect = defects[0];
                    $scope.defect = defects[0];
    
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
                                    user: Utils.html2txt(tmp[1]),
                                    date: tmp[2],
                                    content: tmp[3] };
                            else
                                return {
                                    user: null,
                                    date: null,
                                    content: comment };
                        });
                        $scope.defect.comments.reverse();
                    }

                    // Severity icon
                    $scope.defect.severityIcon = ALMx.getDefectSeverityIcon($scope.defect.severity);
                    $scope.defect.priorityIcon = ALMx.getDefectPriorityIcon($scope.defect.priority);

                    $scope.$apply();
                } else {
                    $scope.defectNotFound = true;
                    $scope.$apply();
                    return;
                }

                ALM.getLinks($scope.defect.id, function(err, links) {
                    if (err)
                        return;

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

        ALMx.update($scope.domain, $scope.project, function() {
            console.log('project update is ready');
            $scope.Users = ALMx;
            $scope.fields = ALMx.fields;

            $scope.getDefect();
        });
    }]);

openQualityControllers.controller('DefectNewCtrl', ['$scope', '$routeParams', 'ALMx', '$filter',
    function($scope, $routeParams, ALMx, $filter) {
        $scope.domain = $routeParams.domain;
        $scope.project = $routeParams.project;
        $scope.toolbar = TEXTANGULAR_TOOLBAR;

        $scope.newDefect = true;
        $scope.defect = {
            status: 'New',
            severity: '3-Minor functional',
        };

        $scope.users = Utils.obj2arr(ALMx.users);
        $scope.fields = ALMx.fields;

        $scope.createDefect = function(defect) {
            // Surround with HTML and BODY tags
            defect.description = DESCRIPTION_HTML_START + defect.description + DESCRIPTION_HTML_END;

            // Add pre-defined fields
            defect['detected-by'] = ALM.getLoggedInUser();
            defect['creation-time'] = $filter('date')(new Date(), 'yyyy-MM-dd HH:mm:ss');

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

var COMMENT_HTML_START = '<html><body><div align="left"><font face="Arial"><span style="font-size:9pt">&nbsp;&nbsp;</span></font></div>';
var COMMENT_HTML_END = '<div align="left">&nbsp;&nbsp;</div></body></html>';
var COMMENT_DIVIDER = '<font face="Arial"><span style="font-size:9pt"><br /></span></font><font face="Arial" color="#000080"><span style="font-size:9pt"><b>________________________________________</b></span></font><font face="Arial"><span style="font-size:9pt"><br /></span></font>';
