'use strict';

/* Services */

var openQualityServices = angular.module('openQualityServices', []);


openQualityServices.service('Users', function() {
    var that = this;
    this.users = {};

    this.update = function() {
        ALM.getUsers(function(users) {
            that.users = users;
        }, function() {});
    }

    this.getUser = function(name) {
        return this.users[name];
    };

    if (localStorage.getItem('users')) {
        this.users = JSON.parse(localStorage.getItem('users'));
    }
});

/*
app.factory('ALM', function() {
    return {
        getFullName: function(username) {
            return sessionStorage.users[username];
        },

        getUsers: function getUsers(username, password) {
          ALM.getUsers(
              function cb(users) {
                console.log('loaded users');
              },
              function onError(error) {
                console.log('users loading error');
              });
        },
    };
});*/
