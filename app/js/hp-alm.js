(function() {

var API_URL = "";
var DOMAIN = "";
var PROJECT = null;
var ALM = {};
var loggedInUser = null;
window.ALM = ALM; // TODO for debug purpose

ALM.CLOSED_STATUSES = ['Closed', 'Fixed', 'Rejected'];
ALM.AUDIT_VERBS = {
    'UPDATE': 'updated',
    'CLOSE': 'closed',
    'CREATE': 'created'
};

// Setters / Getters
ALM.setServerAddress = function(url) { API_URL = url; }
ALM.getServerAddress = function() { return API_URL; }
ALM.getCurrentDomain  = function() { return DOMAIN; }
ALM.getCurrentProject = function() { return PROJECT; }
ALM.getLoggedInUser = function() { return loggedInUser; }
ALM.XML_UNICODE_REGEX = /[^\u0009\u000a\u000d\u0020-\uD7FF\uE000-\uFFFD]+/g;

ALM.onResponse = function onResponse(response, cb, errCb, xhr) {
    var jsonResponse;

    try {
        jsonResponse = $.xml2json(response);
    } catch(err) {
        console.log('Error parsing XML', err);
        if (errCb) {
            errCb("error during parsing xml:" + err)
        }
    }

    if (jsonResponse) {
        cb(jsonResponse, xhr);
    }
}

ALM.ajax = function ajax(path, onSuccess, onError, type, data, contentType) {
    if (!API_URL) {
        throw 'ALM REST API URL is not set';
        onError();
    }

    $.ajax(API_URL + path, {
        success: function (response, status, jqXHR) {
            ALM.onResponse(response, onSuccess, onError, jqXHR);
        },
        error: function(response, xhr) {
            onError();
            if (response.status == 401) {
                console.log('Not logged in');
                // Fix #28, avoid self redirect to login
                if (location.hash != '#/login' && location.hash != '#/settings') {
                    sessionStorage.setItem('redirectAfterLogin', location.hash);
                    location.hash = '/login';
                }
            }
        },
        dataFilter: function(data, type) {
            // fix #75 Remove PCDATA invalid chars before parsing
            return data.replace(ALM.XML_UNICODE_REGEX,' ');
        },
        xhrFields: {
            withCredentials: true
        },
        accepts: {
            xml: 'text/xml',
            text: 'text/plain',
            json: 'application/json'
        },
        type: type,
        data: data,
        contentType: contentType
    });
};

ALM.setCurrentProject = function(dom, prj) {
    DOMAIN = dom;
    PROJECT = prj;
}

ALM.login = function (username, password, onSuccess, onError) {
    ALM.ajax('authentication-point/j_spring_security_check', 
        function(res) {
            console.log('logged in', username)
            loggedInUser = username;
            onSuccess();
        }, function() {
            loggedInUser = null;
            onError();
        },
        'POST',
        {
            'j_username': username,
            'j_password': password
        });
}

ALM.tryLogin = function tryLogin(onLogin, onError) {
    ALM.ajax("rest/is-authenticated",
    function(response) {
        console.log('try logged in', response)
        loggedInUser = response.Username;
        onLogin(response.Username);
    },
    function(err) {
        onError(err);
    });
}

ALM.logout = function logout(cb) {
    ALM.ajax("authentication-point/logout", cb, function err(){});
}

function convertFields(entities) {
    if (!entities || entities.length == 0)
        return null;

    if (!(entities instanceof Array)) {
        entities = [entities];
    }

    return entities.map(function (entity) {
        var entityObj = entity.Fields.Field.reduce(function(prev, current) {
            prev[current.Name] = current.Value;
            return prev;
        }, {});
        return entityObj;
    });
}

function convertFieldsBack(entity, type) {
    var xml = '';

    if (type == 'defect') {

        var start = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>' +
            '<Entity Type="' + type + '">' + '<Fields>',
            middle = '',
            end = '</Fields></Entity>';

        for (var fieldName in entity) {
            var values = entity[fieldName];
            middle += '<Field Name="' + fieldName + '">';
            if (typeof(values) === 'string') {
                values = [values];
            }

            for (var i in values) {
                middle += '<Value>'+escapeXml(values[i])+'</Value>';
            }
            middle += '</Field>';
        }

        xml = start + middle + end;

    } else if (type == 'defect-link') {
        xml = '<defect-link>';
        if (entity.comment)
            xml += '<comment>'+entity.comment+'</comment>';
        xml += '<first-endpoint-id>'+entity['first-endpoint-id']+'</first-endpoint-id>';
        xml += '<second-endpoint-id>'+entity['second-endpoint-id']+'</second-endpoint-id>';
        xml += '<second-endpoint-type>defect</second-endpoint-type>'
        xml += '</defect-link>';
    }

    return xml;
}

  function escapeXml (s) {
    if (!s)
      return '';

    if (typeof s === "number") {
      return s;
    }
    var XML_CHAR_MAP = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&apos;'
    };

    return s.replace(/[<>&"']/g, function (ch) {
      return XML_CHAR_MAP[ch];
    });
  }

ALM.getProjectHistory = function(time, callback) {
    var path = 'rest/domains/'+DOMAIN+
        '/projects/'+PROJECT+'/audits';
    var query = 'query={parent-type[defect];parent-id[*];time[> "'+time+'"]}';

    ALM.ajax(path + '?' + query, function(history) {
        if (history && parseInt(history.TotalResults) == 1) {
            history.Audit = [history.Audit];
        }

        var tmp;
        for (var i in history.Audit) {
            if (history.Audit[i].Properties.Property) {
                if (!history.Audit[i].Properties.Property.length)
                    history.Audit[i].Properties.Property = [history.Audit[i].Properties.Property];

                for (var j in history.Audit[i].Properties.Property) {
                    if (history.Audit[i].Properties.Property[j].Name == 'status') {
                        tmp = history.Audit[i].Properties.Property[j].NewValue;
                        if (tmp == 'New')
                            history.Audit[i].Action = 'CREATE';
                        else if (ALM.CLOSED_STATUSES.indexOf(tmp) != -1)
                            history.Audit[i].Action = 'CLOSE';

                        break;
                    }
                }
            }
            history.Audit[i].Verb = ALM.AUDIT_VERBS[history.Audit[i].Action];
        }

        callback(null, history);
    }, function() {
        callback('failed to get history');
    });

}

ALM.addAttachment = function(defectId, formData, callback) {
    var path = "rest/domains/" + DOMAIN +
               "/projects/" + PROJECT +
               "/defects/" + defectId + "/attachments";

    $.ajax({
        url: API_URL + path,
        data: formData,
        processData: false,
        contentType: false,
        type: 'POST',
        success: function(data){
            callback(null, data);
        },
        error: function(data){
            callback('cant post form', data);
        }
    });
}

ALM.getDefectAttachments = function getDefectAttachments(defectId, cb, errCb) {
    var path = "rest/domains/" + DOMAIN +
               "/projects/" + PROJECT +
               "/defects/" + defectId + "/attachments";
    ALM.ajax(path, function onSuccess(attachmentsJSON) {
        var attachments = convertFields(attachmentsJSON.Entity);
        var buildAttachmentUrl = function(attachment) {
            attachment.url = API_URL + path + "/"  + attachment.name;
        }
        attachments.map(buildAttachmentUrl);
        cb(attachments);
    }, errCb);
}

ALM.getDomains = function(callback) {
    var path = "rest/domains/";

    ALM.ajax(path, function onSuccess(json) {
        var domains = {};
        if (json.Domain.length)
            domains = json.Domain.map(function(el){return el.Name;});
        else
            domains = [json.Domain.Name];
        callback(null, domains);
    }, function() {
        callback('cant get domains');
    });
}

ALM.getProjects = function getProjects(domain, cb, errCb) {
    var path = "rest/domains/" + domain + "/projects";

    ALM.ajax(path, function onSuccess(usersJSON) {
        var projects = usersJSON.Project.map(function(el) {
            return el.Name;
        })
        cb(projects);
    }, errCb);
}

ALM.getUsers = function getUsers(cb, errCb, name, dom, prj) {
    var path = '';

    if (!name) {
        path = "rest/domains/" + DOMAIN +
               "/projects/" + PROJECT +
               "/customization/users";
    } else {
        path = "rest/domains/" + dom +
               "/projects/" + prj +
               "/customization/users?name="+name;
    }

    ALM.ajax(path, function onSuccess(usersJSON) {
        var users = {};
        var el;

        if (usersJSON.User.length === undefined)
            usersJSON.User = [usersJSON.User];

        for (var i in usersJSON.User) {
            el = usersJSON.User[i];

            users[el.Name] = {
                id: el.Name,
                fullname: el.FullName,
                email: el.email,
                phone: el.phone,
            };

            if (el.email)
                users[el.Name].gravatar = 'https://www.gravatar.com/avatar/'+md5(el.email.toLowerCase())+'.jpg?d=identicon';
            else
                users[el.Name].gravatar = 'https://www.gravatar.com/avatar/0000.jpg?f=y';
        }

        cb(users);
    }, errCb);
}

ALM.getLinks = function(id, callback) {
    var url = "rest/domains/" + DOMAIN +
            "/projects/" + PROJECT +
            "/defects/" + id + '/defect-links';

    ALM.ajax(url, function(links) {
        links = links.defect_link;

        if (links.length == undefined)
            links = [links];

        callback(null, links);
    }, function(err) {
        callback('cant get links');
    });
}

ALM.createDefectLink = function(link, callback) {
      
    var url = "rest/domains/" + DOMAIN +
            "/projects/" + PROJECT +
            "/defects/" + link['first-endpoint-id'] + '/defect-links';
    
    var xml = convertFieldsBack(link, 'defect-link');

    ALM.ajax(url,
        function(link) {
            console.log(link)
            callback(null, link);
        },
        function(err) {
            callback(err)
        },
        'POST',
        xml,
        'application/xml');
}

ALM.getDefects = function getDefects(cb, errCb, query, fields, pageSize, startIndex) {
    var computedFields = ["has-others-linkage", "has-linkage", "alert-data"];
    if (!fields) {
        fields = ["id","name","description","dev-comments","severity","attachment"];
    }
    if (!pageSize) {
        pageSize = 100;
    }
    if (!startIndex) {
        startIndex = 1;
    }
    fields = fields.filter(function(field) {return computedFields.indexOf(field) == -1;})

    var fieldsParam = 'fields=' + fields.join(',');
    var queryParam = "query={" + query + "}";
    var pageSizeParam = "page-size=" + pageSize;
    var startIndexParam = "start-index=" + startIndex;
    var queryString = [
        queryParam,
        fieldsParam, 
        pageSizeParam, 
        startIndexParam
    ].join('&');

    var path = "rest/domains/" + DOMAIN +
               "/projects/" + PROJECT +
               "/defects?" + queryString;

    ALM.ajax(path, function onSuccess(defectsJSON) {
        var defectsCount = defectsJSON.TotalResults;
        var defects = convertFields(defectsJSON.Entity);
        cb(defects, defectsCount);
    }, errCb);
}

ALM.getChanged = function getChanged(oldDefect, newDefect) {
  var changed = {};
  for (var field in newDefect) {
    if (newDefect[field] != oldDefect[field] &&
        typeof(newDefect[field]) != 'object' &&
        oldDefect[field] != undefined
        ) {
      changed[field] = newDefect[field];
    }
  }
  return changed;
};

ALM.saveDefect = function saveDefect(cb, errCb, defect, lastSavedDefect) {
  var error = null,
      defectUrl = "rest/domains/" + DOMAIN +
            "/projects/" + PROJECT +
            "/defects/" + defect.id,
      start = function start() {
        lock();
      },

      lock = function lock() {
        verify(); // TODO locking error -> afterUnlock
      },

      verify = function verify() {
        var fields = Object.keys(defect);
        ALM.getDefects(function onSuccess(defects) {
          var oldDefect = defects[0], newDefect = defect,
              changedFields = ALM.getChanged(oldDefect, newDefect),
              hasNoConflicts = Object.keys(ALM.getChanged(oldDefect,
                                                          lastSavedDefect)).length == 0;
          // verify the latest version to prevent conflicts
          if (hasNoConflicts) {
            save(changedFields);
          } else {
            error = "There was an editing conflict! Please refresh";
            console.log(oldDefect,lastSavedDefect);
            unlock();
          }
        }, function onError(checkoutError) {
          error = checkoutError;
          unlock();
        }, "id[" + defect.id + "]", fields);
      },
      save = function save(changedFields) {
        // actual save
        var path = defectUrl,
            xml = convertFieldsBack(changedFields, 'defect');

        console.log(xml);

        ALM.ajax(path, function onSuccess() {
          unlock(); // always unlock after save
        }, function onError(saveError) {
          error = saveError;
          unlock(); // always unlock after error
        }, 'PUT', xml, 'application/xml');
        unlock();
      },
      unlock = function unlock() {
        afterUnlock();
      },
      afterUnlock = function afterUnlock() {
        if (error) {
          errCb(error);
        } else {
          cb();
        }
      };
  start();
}

ALM.updateField = function(defect, field, callback) {
    var path = "rest/domains/" + DOMAIN +
            "/projects/" + PROJECT +
            "/defects/" + defect.id;

    var fields = {};
    fields[field] = defect[field];
    var xml = convertFieldsBack(fields, 'defect');

    ALM.ajax(path, function onSuccess() {
            callback(null);
        }, function onError(saveError) {
            callback(saveError);
        }, 'PUT', xml, 'application/xml');
}

ALM.createDefect = function(fields, callback) {
      
    var url = "rest/domains/" + DOMAIN +
            "/projects/" + PROJECT +
            "/defects";
    
    var xml = convertFieldsBack(fields, 'defect');

    ALM.ajax(url,
        function(data) {
            callback(null, convertFields(data));
        },
        function(err) {
            callback(err)
        },
        'POST',
        xml,
        'application/xml');
}

ALM.getProperties = function(path, callback, err) {
    var url = "rest/domains/" + DOMAIN +
            "/projects/" + PROJECT +
            "/" + path;

    ALM.ajax(url, callback, err);
}

})();
