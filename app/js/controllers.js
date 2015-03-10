'use strict';

/* Controllers */

var openQualityControllers = angular.module('openQualityControllers', []);

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

openQualityControllers.controller('LoginCtrl', ['$scope',
    function($scope) {
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

openQualityControllers.controller('ProjectDetailCtrl', ['$scope', '$routeParams',
    function($scope, $routeParams) {
        $scope.project = $routeParams.project;
        ALM.setCurrentProject($scope.project);
    }]);

openQualityControllers.controller('DefectListCtrl', ['$scope', '$routeParams',
    function($scope, $routeParams) {
        $scope.project = $routeParams.project;
        ALM.setCurrentProject($scope.project);

        var queryString = "",
            fields = ["id","name",
                    //"description","dev-comments",
                    //"severity","attachment","detection-version",
                    //"detected-in-rel", "creation-time",
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

openQualityControllers.controller('DefectDetailCtrl', ['$scope', '$routeParams',
    function($scope, $routeParams) {
        $scope.project = $routeParams.project;
        $scope.defect_id  = $routeParams.defect;

        ALM.setCurrentProject($scope.project);

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
                    $scope.$apply();
                } else {
                    console.log('Expecting 1 defect, got ' + totalCount);
                }
            },
            function onError() {
            },
            queryString, fields);
    }]);
