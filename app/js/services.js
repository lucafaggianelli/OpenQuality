'use strict';

/* Services */

var openQualityServices = angular.module('openQualityServices', []);


openQualityServices.service('Users', function() {
    var that = this;
    this.users = {};

    this.update = function(callback) {
        var cache = sessionStorage.getItem('users.'+ALM.PROJECT);
        if (cache) {
            this.users = JSON.parse(cache);
            return;
        }

        ALM.getUsers(function(users) {
            that.users = users;
            sessionStorage.setItem('users.'+ALM.PROJECT, JSON.stringify(users));
            console.log('Users list updated');
        }, function() {});
    }

    this.getUser = function(name) {
        if (!name)
            return null;

        return this.users[name.toLowerCase()];
    };

    this.getName = function(name) {
        if (!name)
            return null;

        var u = this.getUser(name);
        if (u) {
            return u.fullname;
        } else {
            console.log('cant find user '+name);
            return name;
        }
    };
});

openQualityServices.service('QCUtils', function() {
    var that = this;
    this.fields = {};

    this.update = function() {
        var cache = sessionStorage.getItem('fields.'+ALM.PROJECT);
        if (cache) {
            this.fields = JSON.parse(cache);
            return;
        }

        ALM.getProperties('customization/entities/defect/fields',
            function(json) {
                that.fields = {};
                for (var i in json.Field) {
                    that.fields[json.Field[i].Name] = json.Field[i];
                }
                
                ALM.getProperties('customization/entities/defect/lists',
                    function(json) {
                        var tmp;
                        for (var i in json.List) {
                            for (var j in that.fields) {
                                if (that.fields[j].Type == 'LookupList' && 
                                        that.fields[j].List_Id == json.List[i].Id &&
                                        json.List[i].Items.Item) {
                                    tmp = json.List[i].Items.Item;
                                    if (tmp.length === undefined)
                                        that.fields[j].Values = tmp.value;
                                    else
                                        that.fields[j].Values = tmp.map(function(x){return x.value;});
                                    break;
                                }
                            }
                        }
                        
                        sessionStorage.setItem('fields.'+ALM.PROJECT, JSON.stringify(that.fields));
                        console.log('Updated fields for project '+ ALM.PROJECT);
                    }, function() {
                        console.log('Fail');
                    });

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
