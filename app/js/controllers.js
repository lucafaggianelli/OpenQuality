'use strict';

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

        var loadAllDomains = function() {
            // Get all domains
            ALM.getDomains(function(err, domains) {
                if (err) {
                    console.log(err);
                    return;
                }

                $scope.domains = {};
                // Get all project for each domain
                async.each(domains, function(dom, callback) {
                    ALM.getProjects(dom, function(projects) {
                        $scope.domains[dom] = projects;
                        callback();
                    }, function() {
                        callback('cannot init projects')
                    });
                }, function(err) {
                    $scope.$apply();
                });
            });
        }

        $scope.$on('$routeChangeSuccess', function(event, next, current) {
            var dom = next.params.domain;
            var prj = next.params.project;
            
            if ($scope.domain != dom || $scope.project != prj) {
                console.log('Project changed to '+dom+':'+prj);
                $scope.domain = dom;
                $scope.project = prj;
                ALM.setCurrentProject($scope.domain, $scope.project);

                if ($scope.domain != null && $scope.project != null) {
                    Notifications.startNotifier();
                }
            }
        });

        $scope.$on('alert', $scope.showAlert);

        $scope.$on('loggedIn', function(event, data) {
            if (data) {
                // Logged in
                $scope.user = ALM.getLoggedInUser();
                loadAllDomains();
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

        console.log('server is ' + Settings.settings.serverAddress);
        ALM.setServerAddress(Settings.settings.serverAddress);

        ALM.tryLogin(
            function(username) {
                $scope.user = username;
                loadAllDomains();
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
        $scope.pageSize = 50;
        $scope.currentPage = 1;

        var fields = ["id","name",
                    "description",
                    "dev-comments",
                    "attachment",
                    "last-modified",
                    "owner", "status", "severity"];

        $scope.searchFilters = JSON.parse(localStorage.getItem('defectsFilter'));

        $scope.sortFilters = {
            param: 'last-modified',
            predicate: '"last-modified"',
            reverse: true,
        };

        $scope.sortButtons = {
            'id': {btn:'btn-default',icon:'glyphicon-sort-by-attributes-alt'},
            'last-modified': {btn:'btn-success',icon:'glyphicon-sort-by-attributes-alt'},
            'severity': {btn:'btn-default',icon:'glyphicon-sort-by-attributes-alt'},
        };

        $scope.sort = function(param) {
            // If press again the sort button, reverse the order
            if ($scope.sortFilters.param == param) {
                $scope.sortFilters.reverse = !$scope.sortFilters.reverse;
            } else {
                $scope.sortFilters.param = param;
                $scope.sortFilters.predicate = '"'+param+'"';
            }

            angular.forEach($scope.sortButtons, function(value, key) {
                if (key == $scope.sortFilters.param) {
                    $scope.sortButtons[key].btn = 'btn-success';
                    $scope.sortButtons[key].icon = $scope.sortFilters.reverse ? 
                        'glyphicon-sort-by-attributes-alt':'glyphicon-sort-by-attributes';
                } else {
                    $scope.sortButtons[key].btn = 'btn-default';
                }
            });
        };

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
                },
                function onError() {
                    console.log('error getting defects')
                },
                queryString, fields, $scope.pageSize, ($scope.currentPage-1) * $scope.pageSize + 1);
        };

        $scope.setPage = function(page) {
            if (page <= 0 || page > $scope.totalPages.length)
                return;
            $scope.currentPage = page;
            $scope.getDefects();
        };

        $scope.updatePreset = function(filters, save) {
            $scope.searchFilters = filters;
            if (save)
                localStorage.setItem('defectsFilter', JSON.stringify(searchFilters));

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

        ALMx.update($scope.domain, $scope.project, function() {
            console.log('project update is ready');
            $scope.Users = ALMx;
            $scope.statuses = ALMx.fields.status.Values;
            $scope.severities = ALMx.fields.severity.Values;
            
            $scope.getDefects();
        });
    }]);

openQualityControllers.controller('DefectDetailCtrl', ['$scope', '$routeParams', 'ALMx', '$filter',
    function($scope, $routeParams, ALMx, $filter) {
        var originalDefect = null;
        $scope.domain = $routeParams.domain;
        $scope.project = $routeParams.project;
        $scope.defect_id  = $routeParams.defect;

        $scope.Users = ALMx;
        $scope.fields = ALMx.fields;
        $scope.getFileSizeString = Utils.getFileSizeString;
        $scope.toolbar = TEXTANGULAR_TOOLBAR;

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
                $scope.$emit('alert', {type: 'success', body: 'Successfully changed defect field"'+field+'"!'});
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
                if (count == 1)
                    defect = defect[0];
                else {
                    console.log('expected 1 defect, got '+count);
                    return;
                }

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
                html += ALMx.getName(ALM.getLoggedInUser());
                html += ' &lt;'+ALM.getLoggedInUser()+'&gt;, ';
                html += $filter('date')(new Date(),'yyyy/MM/dd HH:mm:ss')+':';
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
                    "user-09", // Fixed in version
                    "user-01", // Terminal
                    "user-03", // Discipline
            ];

        ALM.getDefects(
            function onSuccess(defects, totalCount) {
                if (totalCount == 1) {
                    originalDefect = defects[0];
                    $scope.defect = defects[0];
    
                    // Comments - prettify
                    if ($scope.defect['dev-comments']) {
                        var tmp;
                        $scope.defect.comments = $scope.defect['dev-comments']
                                .replace(/<[^>]+>/gm, '')
                                .split(/_{3,}/g).map(function(comment) {
                            //tmp = comment.match(/(.+)\s+&lt;.*&gt;,\s+([0-9\/]+):/);
                            tmp = comment.split(/(.+)\s+&lt;.*&gt;,\s+([0-9\/]+\s*[0-9:]*)\s*:/);
                            if (tmp && tmp.length == 4)
                                return {
                                    user: tmp[1],
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
                    if ($scope.defect.severity) {
                        var tmp = $scope.defect.severity.match(/^(\d+)/);
                        if (tmp && tmp.length == 2)
                            $scope.defect.severityIcon = SEVERITY_ICONS[parseInt(tmp[1])];
                    }

                    $scope.$apply();
                } else {
                    console.log('Expecting 1 defect, got ' + totalCount);
                }

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
            // TODO Fix to HTML format
            // Surround with HTML and BODY tags
            defect.description = DESCRIPTION_HTML_START + defect.description + DESCRIPTION_HTML_END;
            console.log(defect.description);

            // Add pre-defined fields
            defect['detected-by'] = ALM.getLoggedInUser();
            defect['creation-time'] = $filter('date')(new Date(), 'yyyy-MM-dd HH:mm:ss');

            console.log(defect);
            angular.forEach($scope.defectedit, function(value, key) {
                if(key[0] == '$') return;
                console.log(key, value.$dirty)
            });
            ALM.createDefect(defect);
        }
    }]);

/**
 * Constants
 */

var TEXTANGULAR_TOOLBAR = "["+
    "['bold','italics','underline','strikeThrough'],"+
    "['ul','ol','indent','outdent'],"+
    "['justifyLeft','justifyCenter','justifyRight'],"+
    "['undo','redo']"+
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
