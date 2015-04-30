'use strict';

/* Controllers */

var openQualityControllers = angular.module('openQualityControllers', []);

openQualityControllers.controller('MainCtrl', ['$scope', '$routeParams', 'Users', 'QCUtils',
    function($scope, $routeParams, Users, QCUtils) {
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
        
        ALM.tryLogin(
            function(username) {
                console.log('trylogin: logged in as', username);
                $scope.user = username;
                loadAllDomains();
            },
            function(error) {
                location.hash = '/login';
            }
        );
        
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
            if (data != $scope.project) {
                console.log('Project changed to', data);
                $scope.domain = data[0];
                $scope.project = data[1];
                if ($scope.project != null) {
                    Users.update();
                    QCUtils.update();
                }
            }
        });
    }]);

openQualityControllers.controller('HomeCtrl', ['$scope', '$location',
    function($scope, $location) {
       
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
                },
                function(data) {
                    console.log('logged out', data);
                    $scope.$emit('loggedIn', null);
                }
            );
        }
    }
]);

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
        ALM.setCurrentProject($scope.domain, $scope.project);

        $scope.$emit('projectChanged', [$scope.domain, $scope.project]);
    }]);

openQualityControllers.controller('DefectListCtrl', ['$scope', '$routeParams', 'Users', 'QCUtils',
    function($scope, $routeParams, Users, QCUtils) {
        $scope.domain = $routeParams.domain;
        $scope.project = $routeParams.project;
        ALM.setCurrentProject($scope.domain, $scope.project);

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
                    console.log('err')
                },
                queryString, fields);
        };

        $scope.updatePreset = function(preset) {
            $scope.preset = preset;
            localStorage.setItem('defectsFilter', JSON.stringify(preset));
            $scope.getDefects();
        }

        $scope.showDefect = function(id) {
            location.hash = '/'+$scope.domain+'/projects/'+$scope.project+'/defects/'+id;
        }

        // Main
        $scope.getDefects();
    }]);

openQualityControllers.controller('DefectDetailCtrl', ['$scope', '$routeParams', 'Users', 'QCUtils',
    function($scope, $routeParams, Users, QCUtils) {
        $scope.domain = $routeParams.domain;
        $scope.project = $routeParams.project;
        $scope.defect_id  = $routeParams.defect;
        $scope.$emit('projectChanged', $scope.project);
        
        ALM.setCurrentProject($scope.domain, $scope.project);

        $scope.users = Users.users;
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

        var queryString = 'id["'+$scope.defect_id+'"]',
            fields = ["id","name","description","dev-comments",
                    "severity","attachment","detection-version",
                    "creation-time",
                    "owner",
                    "detected-by",
                    "status",
                    "user-09", //Fixed in version
                    "user-01", //Terminal
            ];

        ALM.getDefects(
            function onSuccess(defects, totalCount) {
                if (totalCount == 1) {
                    $scope.defect = defects[0];
    
                    // Comments - prettify
                    if ($scope.defect['dev-comments']) {
                        var tmp;
                        $scope.defect.comments = $scope.defect['dev-comments'].replace(/<[^>]+>/gm, '').split(/_{3,}/g).map(function(comment) {
                            //tmp = comment.match(/(.+)\s+&lt;.*&gt;,\s+([0-9\/]+):/);
                            tmp = comment.split(/(.+)\s+&lt;.*&gt;,\s+([0-9\/]+):/);
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

openQualityControllers.controller('DefectNewCtrl', ['$scope', '$routeParams', 'Users', 'QCUtils',
    function($scope, $routeParams, Users, QCUtils) {
        $scope.domain = $routeParams.domain;
        $scope.project = $routeParams.project;
        $scope.$emit('projectChanged', [$scope.domain, $scope.project]);

        $scope.newDefect = true;
        $scope.defect = {};

        $scope.users = Users.users;
        $scope.statuses = QCUtils.fields.status.Values;
        $scope.versions = QCUtils.fields['detection-version'].Values;
        $scope.severities = QCUtils.fields.severity.Values;

        $scope.createDefect = function(defect) {
            console.log(defect);
            angular.forEach($scope.defectedit, function(value, key) {
                if(key[0] == '$') return;
                console.log(key, value.$pristine)
            });
            ALM.createDefect(defect);
        }
    }]);

/**
 * Constants
 */
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
