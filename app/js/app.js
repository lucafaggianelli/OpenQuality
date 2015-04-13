'use strict';

/* App Module */

var openQualityApp = angular.module('openQualityApp', [
    'ngRoute',

    'openQualityControllers',
    'openQualityServices'
    //'phonecatFilters',
]);

openQualityApp.config(['$routeProvider',
    function($routeProvider) {
        $routeProvider.
        when('/', {
            templateUrl: 'partials/index.html',
            controller: 'HomeCtrl'
        }).
        when('/login', {
            templateUrl: 'partials/login.html',
            controller: 'LoginCtrl'
        }).
        when('/projects', {
            templateUrl: 'partials/project-list.html',
            controller: 'ProjectListCtrl'
        }).
        when('/projects/:project', {
            templateUrl: 'partials/project-detail.html',
            controller: 'ProjectDetailCtrl'
        }).
        when('/projects/:project/defects', {
            templateUrl: 'partials/defect-list.html',
            controller: 'DefectListCtrl'
        }).
        when('/projects/:project/defects/new', {
            templateUrl: 'partials/defect-detail.html',
            controller: 'DefectNewCtrl'
        }).
        when('/projects/:project/defects/:defect', {
            templateUrl: 'partials/defect-detail.html',
            controller: 'DefectDetailCtrl'
        }).
        otherwise({
            redirectTo: '/'
        });
    }]);

function init() {
    ALM.config('http://blqsrv724.dl.net:8080/qcbin/','MC');
}

init();
