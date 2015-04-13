(function() {

var API_URL = "";
var DOMAIN = "";
var PROJECT = null;
var LOGIN_FORM = "login-form-required=y&";
var ALM = {};
window.ALM = ALM;

ALM.config = function(apiUrl, domain) {
    API_URL = apiUrl;
    DOMAIN = domain;
}

ALM.onResponse = function onResponse(response, cb, errCb) {
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
        cb(jsonResponse);
    }
}

ALM.ajax = function ajax(path, onSuccess, onError, type, data, contentType) {
    $.ajax(API_URL + path, {
        success: function (response) {
            console.log('AJAX success, parsing XML');
            ALM.onResponse(response, onSuccess, onError);
        },
        error: onError,
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

ALM.setCurrentProject = function(prj) {
    PROJECT = prj;
}

ALM.login = function (username, password, onSuccess, onError) {
    ALM.ajax('authentication-point/j_spring_security_check', onSuccess, onError, 'POST', {
        'j_username': username,
        'j_password': password
    });
}

ALM.tryLogin = function tryLogin(onLogin, onError) {
    ALM.ajax("rest/is-authenticated?" + LOGIN_FORM,
    function(response) {
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
    var start = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>' +
        '<Entity Type="' + type + '">' + '<Fields>',
        middle = '',
        end = '</Fields></Entity>';
    for (var fieldName in entity) {
      middle += '<Field Name="' + fieldName +'">' +
        '<Value>' + escapeXml(entity[fieldName]) + '</Value></Field>';
    }
    return start + middle + end;
  }

  function escapeXml (s) {
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

ALM.getDefectAttachments = function getDefectAttachments(defectId, cb, errCb) {
    var path = "rest/domains/" + DOMAIN +
               "/projects/" + PROJECT +
               "/defects/" + defectId + "/attachments?" + LOGIN_FORM;
    ALM.ajax(path, function onSuccess(attachmentsJSON) {
        var attachments = convertFields(attachmentsJSON.Entity);
        var buildAttachmentUrl = function(attachment) {
            attachment.url = API_URL + path + "/"  + attachment.name;
        }
        attachments.map(buildAttachmentUrl);
        cb(attachments);
    }, errCb);
}

ALM.getProjects = function getProjects(cb, errCb) {
    var path = "rest/domains/" + DOMAIN +
               "/projects?" + LOGIN_FORM;
    ALM.ajax(path, function onSuccess(usersJSON) {
        var projects = usersJSON.Project.map(function(el) {
            return el.Name;
        })
        cb(projects);
    }, errCb);
}

ALM.getUsers = function getUsers(cb, errCb) {
    var path = "rest/domains/" + DOMAIN +
               "/projects/" + PROJECT +
               "/customization/users?" + LOGIN_FORM;

    ALM.ajax(path, function onSuccess(usersJSON) {
        var users = {};
        var el;
        for (var i in usersJSON.User) {
            el = usersJSON.User[i];

            users[el.Name] = {
                id: el.Name,
                fullname: el.FullName,
                email: el.email,
                phone: el.phone,
            };
        }

        cb(users);
    }, errCb);
}

ALM.getDefects = function getDefects(cb, errCb, query, fields, pageSize, startIndex) {
    var computedFields = ["has-others-linkage", "has-linkage", "alert-data"],
        fieldsParam = null;
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
    fieldsParam = 'fields=' + fields.join(',') + '&';
    var queryParam = "query={" + query + "}&";
    var pageSizeParam = "page-size=" + pageSize + "&";
    var startIndexParam = "start-index=" + startIndex + "&";
    var path = "rest/domains/" + DOMAIN +
               "/projects/" + PROJECT +
               "/defects?" + queryParam + fieldsParam + pageSizeParam +
               startIndexParam + LOGIN_FORM;
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
        ALM.ajax(path, function onSuccess() {
          unlock(); // always unlock after save
        }, function onError(saveError) {
          error = saveError;
          unlock(); // always unlock after error
        }, 'PUT', xml, 'application/xml');
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

ALM.createDefect = function(data) {
      
    var url = "rest/domains/" + DOMAIN +
            "/projects/" + PROJECT +
            "/defects/" + defect.id;

    ALM.ajax(url,
        function() {},
        function() {},
        'POST',
        null,//convertFieldsBack(changedFields, 'defect');
        'application/xml');
}

})();
