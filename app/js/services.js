'use strict';

/* Services */

var openQualityServices = angular.module('openQualityServices', []);

app.factory('UsersService', function() {
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
});
