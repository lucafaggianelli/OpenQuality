'use strict';

/* Controllers */

var openQualityControllers = angular.module('openQualityControllers', []);

openQualityControllers.controller('MainCtrl', ['$scope', '$routeParams', 'Users', 'QCUtils', 'Settings', 'Notifications',
    function($scope, $routeParams, Users, QCUtils, Settings, Notifications) {
        $scope.domain = null;
        $scope.project = $routeParams.project || 'Projects';
        $scope.domains = null;
        $scope.loading = false;
        $scope.user = ALM.getLoggedInUser();

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

        $scope.$on('projectChanged', function(event, data) {
            if (data[0] != $scope.domain && data[1] != $scope.project) {
                console.log('Project changed to', data);
                $scope.domain = data[0];
                $scope.project = data[1];
                ALM.setCurrentProject($scope.domain, $scope.project);
                if ($scope.project != null) {
                    Users.update();
                    QCUtils.update();
                    Notifications.startNotifier(1 * 60);
                }
            }
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

openQualityControllers.controller('LoginCtrl', ['$scope', 'Users',
    function($scope, Users) {
        $scope.login = function() {
            var username = $('#username').val(),
                password = $('#password').val();

            ALM.login(username, password,
                function(data) {
                    console.log('logged in as',username);
                    sessionStorage.setItem('currentUser', username);
                    $scope.$emit('loggedIn', username);
                    location.hash = sessionStorage.getItem('redirectAfterLogin') || '/';
                    sessionStorage.removeItem('redirectAfterLogin');
                    console.log('redirecting to', location.hash);
                },
                function(data) {
                    console.log('logged out', data);
                    $scope.$emit('loggedIn', null);
                }
            );
        }
    }
]);

openQualityControllers.controller('SettingsCtrl', ['$scope', 'Settings',
    function($scope, Settings) {
        $scope.settings = Settings.settings;

        $scope.saveSettings = function(settings) {
            console.log('saving', settings)
            Settings.save(settings);
            ALM.setServerAddress(Settings.settings.serverAddress); // TODO move to ALM
        }
    }]);

openQualityControllers.controller('ProjectListCtrl', ['$scope',
    function($scope) {
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

openQualityControllers.controller('ProjectDetailCtrl', ['$scope', '$routeParams', 'Users',
    function($scope, $routeParams, Users) {
        $scope.domain = $routeParams.domain;
        $scope.project = $routeParams.project;
        //ALM.setCurrentProject($scope.domain, $scope.project);

        $scope.$emit('projectChanged', [$scope.domain, $scope.project]);
    }]);

openQualityControllers.controller('DefectListCtrl', ['$scope', '$routeParams', 'Users', 'QCUtils',
    function($scope, $routeParams, Users, QCUtils) {
        $scope.domain = $routeParams.domain;
        $scope.project = $routeParams.project;
        $scope.pageSize = 50;
        $scope.currentPage = 1;
        //ALM.setCurrentProject($scope.domain, $scope.project);

        $scope.$emit('projectChanged', [$scope.domain,$scope.project]);
        $scope.Users = Users;

        $scope.statuses = QCUtils.fields.status.Values;
        $scope.severities = QCUtils.fields.severity.Values;

        var fields = ["id","name",
                    "description",
                    "dev-comments",
                    "attachment",
                    "detected-by",
                    //"detection-version",
                    //"detected-in-rel",
                    "creation-time",
                    "owner", "status", "severity"];

        $scope.preset = JSON.parse(localStorage.getItem('defectsFilter'));

        $scope.getDefects = function() {
            var queryString = '';

            if ($scope.preset.query) {
                var values, query;
                for (var param in $scope.preset.query) {
                    values = $scope.preset.query[param];
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

        $scope.updatePreset = function(preset) {
            $scope.preset = preset;
            localStorage.setItem('defectsFilter', JSON.stringify(preset));
            $scope.getDefects();
        };

        $scope.showDefect = function(id) {
            location.hash = '/'+$scope.domain+'/projects/'+$scope.project+'/defects/'+id;
        }

        // Main
        $scope.getDefects();
    }]);

openQualityControllers.controller('DefectDetailCtrl', ['$scope', '$routeParams', 'Users', 'QCUtils', '$filter',
    function($scope, $routeParams, Users, QCUtils, $filter) {
        var originalDefect = null;
        $scope.domain = $routeParams.domain;
        $scope.project = $routeParams.project;
        $scope.defect_id  = $routeParams.defect;

        $scope.$emit('projectChanged', [$scope.domain, $scope.project]);

        $scope.Users = Users;
        $scope.fields = QCUtils.fields;
        $scope.getFileSizeString = Utils.getFileSizeString;

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

        $scope.setStatus = function() {
            console.log('status changed to', $scope.defect.status);
            ALM.updateStatus($scope.defect, function(err) {
                if (err) {
                    console.log('cant update status:', err);
                    return;
                }

                console.log('status changed');
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
                html += Users.getName(ALM.getLoggedInUser());
                html += ' &lt;'+ALM.getLoggedInUser()+'&gt;, ';
                html += $filter('date')(new Date(),'yyyy/MM/dd HH:mm:ss')+':';
                html += '</b></span></font></div>';

                // Body
                html += '<div align="left"><font face="Arial"><span style="font-size:9pt">';
                html += $scope.newComment;
                html += '</span></font></div>';
                
                // If first comment, need </html>
                if (firstComment)
                    html += COMMENT_HTML_END;

                // Append the comment
                if (!firstComment) {
                    var pos = defect['dev-comments'].indexOf('</body>');
                    var html = defect['dev-comments'].substr(0, pos) + html + 
                        defect['dev-comments'].substr(pos);
                }
                
                console.log(html);
                ALM.saveDefect(function() {
                }, function() {
                }, {id: $scope.defect.id, 'dev-comments': html},
                    $scope.defect);

            }, function() {
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

openQualityControllers.controller('DefectNewCtrl', ['$scope', '$routeParams', 'Users', 'QCUtils', '$filter',
    function($scope, $routeParams, Users, QCUtils, $filter) {
        $scope.domain = $routeParams.domain;
        $scope.project = $routeParams.project;
        $scope.$emit('projectChanged', [$scope.domain, $scope.project]);
        $scope.toolbar = TEXTANGULAR_TOOLBAR;

        $scope.newDefect = true;
        $scope.defect = {
            status: 'New',
            severity: '3-Minor functional',
        };

        $scope.users = Utils.obj2arr(Users.users);
        $scope.fields = QCUtils.fields;

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
    Closed: 'danger',
    Fixed: 'danger',
    Rejected: 'danger',
}

//var DESCRIPTION_HTML_START = '<html><body><div align="left"><font face="Arial"><span style="font-size:9pt">';
//var DESCRIPTION_HTML_END = '</span></font></div>';
var DESCRIPTION_HTML_START = '<html><body>';
var DESCRIPTION_HTML_END = '</body></html>';

var COMMENT_HTML_START = '<html><body><div align="left"><font face="Arial"><span style="font-size:9pt">&nbsp;&nbsp;</span></font></div>';
var COMMENT_HTML_END = '<div align="left">&nbsp;&nbsp;</div></body></html>';
var COMMENT_DIVIDER = '<font face="Arial"><span style="font-size:9pt"><br /></span></font><font face="Arial" color="#000080"><span style="font-size:9pt"><b>________________________________________</b></span></font><font face="Arial"><span style="font-size:9pt"><br /></span></font>';
