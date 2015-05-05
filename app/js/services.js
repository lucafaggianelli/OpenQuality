'use strict';

/* Services */

var openQualityServices = angular.module('openQualityServices', []);

openQualityServices.service('Notifications', function($filter, Users) {
    var interval = null;
    var lastUpdate = null;
    var notification = null;

    this.startNotifier = function(delaySec) {
        console.log('Starting notification daemon with delay of '+delaySec+'s');

        if (interval)
            clearInterval(interval);

        // Use the saved 'lastupdate' so you don't miss any notification
        // or fallback to now
        var tmp = localStorage.getItem('notif:lastUpdate');
        if (tmp) {
            lastUpdate = new Date(tmp);
            getNotifications();
        } else {
            lastUpdate = new Date();
        }

        interval = setInterval(getNotifications, delaySec * 1000);
    };

    var getNotifications = function() {
        ALM.getProjectHistory($filter('date')(lastUpdate, 'yyyy-MM-dd HH:mm:ss'), function(err, history) {
            if (err) {
                console.log(err);
                return;
            }

            var now = new Date();
            localStorage.setItem('notif:lastUpdate', now.toString());
            lastUpdate = now;

            var audit;
            var body;
            var property;
            var user;
            
            if (parseInt(history.TotalResults) <= 0)
                return;

            console.log('Changes from '+lastUpdate+' to '+now, history);

            // TODO bug #45
            //for (var i=0; i < history.Audit.length; i++) {
            if (history.Audit.length > 0) {
                audit = history.Audit[0]; // TODO i

                user = Users.getUser(audit.User);

                if (!audit.Properties || audit.Properties == "") {
                    body = 'Updated defect #' + audit.ParentId;
                } else {
                    property = (audit.Properties.Property || audit.Properties[0].Property).Label;
                    body = (DICT[property] || 'Updated '+property+' on') + ' defect #' + audit.ParentId;
                }

                console.log('notify', user.fullname, body, user.gravatar+'&s=60');
                notification = new Notification(user.fullname, {body: body, icon: user.gravatar+'&s=60'});
                notification.onclick = function(event) {
                    console.log('got clicked',event);
                };
            }

        });
    }
    
    var DICT = {
        'Comments': 'Commented'
    }
});

openQualityServices.service('Users', function() {
    var that = this;
    this.users = {};

    this.update = function(callback) {
        var cache = sessionStorage.getItem('users.'+ALM.getCurrentProject());
        if (cache) {
            this.users = JSON.parse(cache);
            return;
        }

        ALM.getUsers(function(users) {
            that.users = users;
            sessionStorage.setItem('users.'+ALM.getCurrentProject(), JSON.stringify(users));
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

openQualityServices.service('Settings', function() {
    this.settings = JSON.parse(localStorage.getItem('settings')) || {};
    
    this.save = function(settings) {
        this.settings = settings;
        localStorage.setItem('settings', JSON.stringify(settings));
    }
});

openQualityServices.service('QCUtils', function() {
    var that = this;
    this.fields = {};

    this.update = function() {
        var cache = sessionStorage.getItem('fields.'+ALM.getCurrentProject());
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
                        var count = 0;
                        for (var i in json.List) {
                            for (var j in that.fields) {
                                if (that.fields[j].Type == 'LookupList' && 
                                        that.fields[j].List_Id == json.List[i].Id) {

                                    tmp = json.List[i].Items.Item;
                                    if (!tmp) {
                                        // Handle 0 elements array
                                        that.fields[j].Values = [];
                                    } else if (tmp.length === undefined) {
                                        // Handle 1 element array
                                        that.fields[j].Values = [tmp.value];
                                    } else {
                                        // Handle 1+ elements array
                                        that.fields[j].Values = tmp.map(function(x){return x.value;});
                                    }
                                    //console.log('Lookuplist',that.fields[j].Name,that.fields[j].Values);
                                    count++;
                                    // Dont call break as some fields share the same list
                                }
                            }
                        }
                        console.log('Total lookup list '+count);

                        sessionStorage.setItem('fields.'+ALM.getCurrentProject(), JSON.stringify(that.fields));
                        console.log('Updated fields for project '+ ALM.getCurrentProject());
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
