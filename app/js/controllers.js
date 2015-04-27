'use strict';

/* Controllers */

var openQualityControllers = angular.module('openQualityControllers', []);

openQualityControllers.controller('NavCtrl', ['$scope', '$routeParams',
    function($scope, $routeParams) {
        $scope.project = $routeParams.project || 'Projects';
        $scope.projects = [];

        $scope.$on('projectChanged', function(event, data) {
            console.log('Project changed', data);
            $scope.project = data;
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
                    console.log('logged in',data);
                    location.hash = '/';
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

        Users.update();
        $scope.$emit('projectChanged', $scope.project);
    }]);

openQualityControllers.controller('DefectListCtrl', ['$scope', '$routeParams', 'Users',
    function($scope, $routeParams, Users) {
        $scope.project = $routeParams.project;
        ALM.setCurrentProject($scope.project);
        $scope.Users = Users;

        var queryString = "",
            fields = ["id","name",
                    "description",
                    "dev-comments",
                    "attachment",
                    "detected-by",
                    //"detection-version",
                    //"detected-in-rel",
                    "creation-time",
                    "owner", "status", "severity"];

        ALM.getDefects(
            function onSuccess(defects, totalCount) {
                $scope.defects = defects;
                $scope.$apply();
            },
            function onError() {
            },
            queryString, fields);

        $scope.showDefect = function(id) {
            location.hash = '/projects/'+$scope.project+'/defects/'+id;
        }
    }]);

openQualityControllers.controller('DefectDetailCtrl', ['$scope', '$routeParams', 'Users', 'QCUtils',
    function($scope, $routeParams, Users, QCUtils) {
        var IMGS_SUFFIX = ['.png', '.bmp', '.jpg', '.jpeg', '.gif'];
        $scope.project = $routeParams.project;
        $scope.defect_id  = $routeParams.defect;
        $scope.Users = Users;

        ALM.setCurrentProject($scope.project);

        $scope.isImg = function(filename) {
            var suffix;
            for (var i in IMGS_SUFFIX) {
                suffix = IMGS_SUFFIX[i];
                if (filename.indexOf(suffix, filename.length - suffix.length) !== -1) {
                    return true;
                }
            }
            console.log(filename+' is not img')
            return false;
        };

        var queryString = 'id["'+$scope.defect_id+'"]',
            fields = ["id","name","description","dev-comments",
                    "severity","attachment","detection-version",
                    "creation-time",
                    "owner",
                    "detected-by",
                    "status"];

        ALM.getDefects(
            function onSuccess(defects, totalCount) {
                if (totalCount == 1) {
                    $scope.defect = defects[0];

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

openQualityControllers.controller('DefectNewCtrl', ['$scope', '$routeParams', 'Users',
    function($scope, $routeParams, Users) {
        $scope.newDefect = true;
        $scope.defect = {};

        $scope.createDefect = function() {
            ALM.createDefect($scope.defect);
        }
    }]);
