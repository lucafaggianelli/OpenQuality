'use strict';

/* Services */

var openQualityServices = angular.module('openQualityServices', []);

openQualityServices.service('Notifications', function($filter, Users) {
    // Delay for QC to update history [ms]
    var QC_AUDIT_DELAY = 20 * 60 * 1000;

    var interval = null;
    var lastUpdate = null;
    var lastAudit = 0;
    var notification = null;

    this.startNotifier = function(delaySec) {
        console.log('Starting notification daemon with delay of '+delaySec+'s');

        if (interval)
            clearInterval(interval);

        lastAudit = localStorage.getItem('notif:lastAudit');
        if (!lastAudit)
            lastAudit = 0;

        // Use the saved 'lastupdate' time so you don't miss any notification
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
        // Fix issue #50: need to fetch history some minutes before
        // lastUpdate time as QC updates the history with some delay
        ALM.getProjectHistory($filter('date')(new Date(lastUpdate.getTime()-QC_AUDIT_DELAY), 'yyyy-MM-dd HH:mm:ss'), function(err, history) {
            if (err) {
                console.log(err);
                return;
            }

            var now = new Date();
            localStorage.setItem('notif:lastUpdate', now.toString());
            lastUpdate = now;

            var audit;
            var body, title, icon; // notification options
            
            if (parseInt(history.TotalResults) <= 0)
                return;

            var updatedDefects = [];
            for (var i=0; i < history.Audit.length; i++) {
                audit = history.Audit[i];
                
                if (parseInt(audit.Id) > lastAudit) {
                    console.log('New audit',audit.Id);
                    lastAudit = parseInt(audit.Id);
                    //user = Users.getUser(audit.User);
                } else {
                    // Already fired a notification for this audit
                    continue;
                }
                
                // Filter duplicated defects
                if (updatedDefects.indexOf(audit.ParentId) == -1) {
                    updatedDefects.push(audit.ParentId);
                }
            }
            localStorage.setItem('notif:lastAudit', lastAudit);

            if (!updatedDefects || updatedDefects.length == 0)
                return;

            // Build the body as 'Updated defects #1, #32, #90'
            if (updatedDefects.length == 1)
                body = 'Updated defect #';
            else
                body = 'Updated defects #';

            body += updatedDefects.join(', #');

            notification = new Notification('Quality Center', {body: body});
            notification.onclick = function(event) {
                console.log('got clicked',event);
            };

            // TODO bug #45
            /*
            var property;
            var user;
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
            }*/

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
