'use strict';

/* Services */

var openQualityServices = angular.module('openQualityServices', []);


openQualityServices.service('Users', function() {
    var that = this;
    this.users = {};

    this.update = function() {
        ALM.getUsers(function(users) {
            that.users = users;
            console.log('Users list updated');
        }, function() {});
    }

    this.getUser = function(name) {
        return this.users[name.toLowerCase()];
    };

    this.getName = function(name) {
        var u = this.getUser(name);
        if (u) {
            return u.fullname;
        } else {
            console.log('cant find user '+name, u);
            return name;
        }
    };

    if (localStorage.getItem('users')) {
        this.users = JSON.parse(localStorage.getItem('users'));
    }
});

openQualityServices.service('QCUtils', function() {
    var that = this;
    this.lists = {};

    this.getDefectLists = function(entity) {
    }

    this.update = function() {
        ALM.getProperties('customization/entities/defect/lists',
            function(json) {
                that.lists = json;
            }, function() {
                console.log('Fail');
            });
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
