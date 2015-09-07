'use strict';

/* App Module */

var openQualityApp = angular.module('openQualityApp', [
    'ngRoute',
    'ui.select',
    'ui.bootstrap',
    'ngSanitize',
    'textAngular',
    'angularMoment',
    'infinite-scroll',

    'openQualityControllers',
    'openQualityServices',
    'openQualityFilters',
    'openQualityDirs',
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
        when('/settings', {
            templateUrl: 'partials/settings.html',
            controller: 'SettingsCtrl'
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
        otherwise({
            redirectTo: '/'
        });
    }]);

openQualityApp.config(['$provide', function($provide){
    $provide.decorator('taTools', ['$delegate', function(taTools){
            taTools.pre.iconclass = 'fa fa-code';
            delete taTools.pre.buttontext;

            delete taTools.html.iconclass;
            taTools.html.buttontext = 'HTML';
            return taTools;
        }]);
}]);

function init() {
    // Default query params
    if (!localStorage.getItem('filters.search')) {
        localStorage.setItem('filters.search', JSON.stringify({
            query: {
                status: ['New', 'Open', 'Reopen']
            }
        }));
    }

    if (!localStorage.getItem('filters.sort')) {
        localStorage.setItem('filters.sort', JSON.stringify({
            param: 'last-modified',
            predicate: '"last-modified"',
            reverse: true
        }));
    }
}

init();
