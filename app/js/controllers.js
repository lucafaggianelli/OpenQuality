'use strict';

/* Controllers */

var openQualityControllers = angular.module('openQualityControllers', []);

openQualityControllers.controller('NavCtrl', ['$scope', '$routeParams', 'Users', 'QCUtils',
    function($scope, $routeParams, Users, QCUtils) {
        $scope.project = $routeParams.project || 'Projects';
        $scope.projects = [];
        $scope.loading = false;

        $scope.$on('projectChanged', function(event, data) {
            if (data != $scope.project) {
                console.log('Project changed', data);
                $scope.project = data;
                if ($scope.project != null) {
                    Users.update();
                    QCUtils.update();
                }
            }
        });
    }]);

openQualityControllers.controller('HomeCtrl', ['$scope', '$location',
    function($scope, $location) {
       ALM.tryLogin(
            function(username) {
            },
            function(error) {
                location.hash = '/login';
            }
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
                    location.hash = sessionStorage.getItem('redirectAfterLogin') || '/';
                    sessionStorage.removeItem('redirectAfterLogin');
                },
                function(data) {
                    console.log('logged out', data);
                }
            );
        }
    }
]);

openQualityControllers.controller('ProjectListCtrl', ['$scope',
    function($scope) {
        ALM.getProjects(
            function(prjs) {
                console.log('loaded prjs', prjs);
                $scope.projects = prjs;
                $scope.$apply();
            },
            function(err) {
                console.log('cant load projects', err);
            });
  }]);

openQualityControllers.controller('ProjectDetailCtrl', ['$scope', '$routeParams', 'Users',
    function($scope, $routeParams, Users) {
        $scope.project = $routeParams.project;
        ALM.setCurrentProject($scope.project);

        $scope.$emit('projectChanged', $scope.project);
    }]);

openQualityControllers.controller('DefectListCtrl', ['$scope', '$routeParams', 'Users', 'QCUtils',
    function($scope, $routeParams, Users, QCUtils) {
        $scope.project = $routeParams.project;
        ALM.setCurrentProject($scope.project);
        $scope.$emit('projectChanged', $scope.project);
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
            location.hash = '/projects/'+$scope.project+'/defects/'+id;
        }

        // Main
        $scope.getDefects();
    }]);

openQualityControllers.controller('DefectDetailCtrl', ['$scope', '$routeParams', 'Users', 'QCUtils',
    function($scope, $routeParams, Users, QCUtils) {
        var IMGS_SUFFIX = ['.png', '.bmp', '.jpg', '.jpeg', '.gif'];
        $scope.project = $routeParams.project;
        $scope.defect_id  = $routeParams.defect;
        $scope.users = Users.users;

        ALM.setCurrentProject($scope.project);
        $scope.$emit('projectChanged', $scope.project);

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
        $scope.$emit('projectChanged', $scope.project);
        $scope.newDefect = true;
        $scope.defect = {};

        $scope.users = Users.users;
        $scope.statuses = QCUtils.fields.status.Values;
        $scope.versions = QCUtils.fields['detection-version'].Values;
        $scope.severities = QCUtils.fields.severity.Values;

        $scope.createDefect = function(defect) {
            console.log(defect);
            ALM.createDefect(defect);
        }
    }]);

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
