'use strict';

/* App Module */

var openQualityApp = angular.module('openQualityApp', [
    'ngRoute',
    'ui.select',
    'ngSanitize',

    'openQualityControllers',
    'openQualityServices',
    'openQualityFilters',
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
        when('/:domain/projects', {
            templateUrl: 'partials/project-list.html',
            controller: 'ProjectListCtrl'
        }).
        when('/:domain/projects/:project', {
            templateUrl: 'partials/project-detail.html',
            controller: 'ProjectDetailCtrl'
        }).
        when('/:domain/projects/:project/defects', {
            templateUrl: 'partials/defect-list.html',
            controller: 'DefectListCtrl'
        }).
        when('/:domain/projects/:project/defects/new', {
            templateUrl: 'partials/defect-edit.html',
            controller: 'DefectNewCtrl'
        }).
        when('/:domain/projects/:project/defects/:defect', {
            templateUrl: 'partials/defect-detail.html',
            controller: 'DefectDetailCtrl'
        }).
        otherwise({
            redirectTo: '/'
        });
    }]);

function init() {
    // Default query params
    if (!localStorage.getItem('defectsFilter')) {
        localStorage.setItem('defectsFilter', JSON.stringify({
            query: {
                status: ['New', 'Open', 'Reopen']
            }
        }));
    }

    ALM.config('http://blqsrv724.dl.net:8080/qcbin/','MC');
}

init();
