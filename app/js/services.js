'use strict';

/* Services */

var openQualityServices = angular.module('openQualityServices', []);

openQualityServices.service('Notifications', function($rootScope, $filter, ALMx) {
    // Delay for QC to update history [ms]
    var QC_AUDIT_DELAY = 20 * 60 * 1000;

    // Poll interval for fetching QC Audit
    var NOTIFICATIONS_INTERVAL = 2 * 60;

    var interval = null;
    var lastUpdate = null;
    var lastAudit = 0;
    var notification = null;

    this.startNotifier = function(delaySec) {
        if (!delaySec || delaySec <= 10) {
            console.warn('Notifier minimum delay is 10s. You cant set it to '+delaySec+'s');
            delaySec = NOTIFICATIONS_INTERVAL;
        }
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

    this.stopNotifier = function() {
        console.log('Stopping notification daemon');
        if (interval)
            clearInterval(interval);
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
            
            if (parseInt(history.TotalResults) <= 0) {
                return;
            }

            var lastAuditNew = lastAudit;
            var updatedDefects = [];
            var users = [], usersIds = [];
            for (var i=0; i < history.Audit.length; i++) {
                audit = history.Audit[i];
                audit.Id = parseInt(audit.Id);

                // Already fired a notification for this audit
                if (audit.Id <= lastAudit)
                    continue;

                // Find the last audit ID
                if (audit.Id > lastAuditNew)
                    lastAuditNew = audit.Id;

                if (usersIds.indexOf(audit.User) == -1) {
                    usersIds.push(audit.User);
                    users.push(ALMx.getUser(audit.User));
                }
                
                // Filter duplicated defects
                if (updatedDefects.indexOf(audit.ParentId) == -1) {
                    updatedDefects.push(audit.ParentId);
                }
            }
            localStorage.setItem('notif:lastAudit', lastAuditNew);
            lastAudit = lastAuditNew;

            if (!updatedDefects || updatedDefects.length == 0)
                return;

            // Build title i.e.:
            //   Luca Faggianelli + 3 others
            title = users[0].fullname;
            if (users.length > 1) {
                title += ' + ' + (users.length-1) + 'others';
                // Pluralize 'other(s)'
                if (users.length > 2)
                    title += 's';
            }

            // Build the body i.e.:
            //   Updated defects #1, #32, #90
            if (updatedDefects.length == 1)
                body = 'Updated defect #';
            else
                body = 'Updated defects #';
            body += updatedDefects.join(', #');

            // Icon
            icon = users[0].gravatar+'&s=60'

            console.log({title: title, body: body, icon: icon});
    
            $rootScope.$broadcast('updateDefectList');

            // TODO issue #54
            notification = new Notification(title, {body: body});//, icon: icon});
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

openQualityServices.service('Settings', function() {
    this.settings = JSON.parse(localStorage.getItem('settings')) || {};
    
    this.setAccount = function(u,p) {
        this.settings.username = u;
        this.settings.password = p;
        this.save();
    };

    this.save = function(settings) {
        if (settings)
            this.settings = settings;

        localStorage.setItem('settings', JSON.stringify(this.settings));
    }
});

openQualityServices.service('ALMx', function($rootScope) {
    var that = this;

    this.domain = null;
    this.project = null;

    this.fields = {};
    this.users = {};
    this.usersArr = [];
    this.lastSearch = [];

    this.update = function(domain, project, callback) {
        if (domain != this.domain || project != this.project) {
            console.log('Project changed to '+domain+':'+project);
            this.domain = domain;
            this.project = project;
            ALM.setCurrentProject(this.domain, this.project);

            if (this.domain != null && this.project != null) {
                async.series([
                    this.updateUsers,
                    this.updateFields
                ], function(err) {
                    callback(err);
                });
            } else {
                callback();
            }
        } else {
            callback();
        }
    }

    this.updateUsers = function(callback) {
        var cache = sessionStorage.getItem('users.'+ALM.getCurrentProject());
        if (cache) {
            that.users = JSON.parse(cache);
            that.usersArr = Utils.obj2arr(that.users);
            callback(null);
            return;
        }

        ALM.getUsers(function(users) {
            that.users = users;
            that.usersArr = Utils.obj2arr(that.users);
            sessionStorage.setItem('users.'+ALM.getCurrentProject(), JSON.stringify(users));
            console.log('Users list updated');
            callback(null);
        }, function() {
            callback('Cant fetch users list');
        });
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
    
    this.updateFields = function(callback) {
        var cache = sessionStorage.getItem('fields.'+ALM.getCurrentProject());
        if (cache) {
            that.fields = JSON.parse(cache);
            callback(null);
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
                        console.log('Project fields updated for '+ ALM.getCurrentProject());
                        callback(null);
                    }, function() {
                        console.log('Fail');
                        callback('Cant fetch fields');
                    });

            }, function() {
                console.log('Fail');
                callback('Cant fetch fields');
            });
    }

    this.getDefectPriorityIcon = function(prio) {
        if (!prio)
            return null;

        var tmp = prio.match(/^(\d+)\s*-/);
        if (tmp && tmp.length == 2) {
            tmp = parseInt(tmp[1])
            if (tmp >= 0 && tmp <ALM_PRIORITY_ICONS.length);
                return 'glyphicon glyphicon-'+ALM_PRIORITY_ICONS[tmp]+' icon-severity-'+tmp;
        }

        return null;
    }

    this.getDefectSeverityIcon = function(severity) {
        if (!severity)
            return null;

        var tmp = severity.match(/^(\d+)\s*-/);
        if (tmp && tmp.length == 2) {
            tmp = parseInt(tmp[1])
            if (tmp >= 0 && tmp <ALM_SEVERITY_ICONS.length);
                return 'glyphicon glyphicon-'+ALM_SEVERITY_ICONS[tmp]+' icon-severity-'+tmp;
        }

        return null;
    }
});

var ALM_PRIORITY_ICONS = [
    null,
    'circle-arrow-down', // 1 Low
    'arrow-down', // 2 Medium
    'arrow-up', // 3 High
    'circle-arrow-up', // 4 Very High
    'exclamation-sign' // 5 Urgent
];

var ALM_SEVERITY_ICONS = [
    null,
    'gift', // 1 feature request
    'sunglasses',
    'arrow-down', // minor
    'arrow-up', // major
    'fire' // 5 crash data loss
];
