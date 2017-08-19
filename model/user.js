"use strict";

var pgMap = require("./pgMap.js");
var debug = require("debug")("OSMBC:model:user");
var should = require("should");
var async = require("async");
var messageCenter = require("../notification/messageCenter.js");
var mailReceiver = require("../notification/mailReceiver.js");
var random = require("randomstring");
var emailValidator = require("email-validator");


function User (proto) {
  debug("User");
  debug("Prototype %s", JSON.stringify(proto));
  this.id = 0;
  for (var k in proto) {
    this[k] = proto[k];
  }
}

function create (proto) {
  debug("create");
  return new User(proto);
}

function createNewUser (proto, callback) {
  debug("createNewUser");
  if (typeof (proto) === "function") {
    callback = proto;
    proto = null;
  }
  if (proto) should.not.exist(proto.id);
  var user = create(proto);
  find({OSMUser: user.OSMUser}, function (err, result) {
    if (err) return callback(err);
    if (result && result.length > 0) {
      return callback(new Error("User >" + user.OSMUser + "< already exists."));
    }
    // set some defaults for the user
    if (!proto) user.mailNewCollection = "false";
    if (!proto) user.mailAllComment = "false";
    if (!proto) user.mailComment = [];
    if (!proto) user.mailBlogLanguageStatusChange = [];
    // save data
    user.save(function updateUser(err, result) {
      if (err) return callback(err, result);
      mailReceiver.updateUser(result);
      callback(null, result);
    });
  });
}

User.prototype.calculateChanges = function calculateChanges(callback) {
  debug("User.prototype.calculateChanges");
  var self = this;
  if (self._countChanges) return;
  pgMap.count("select count(*) as count from changes where data->>'user'='" + this.OSMUser + "' and data->>'table'='article'", function(err, result) {
    if (err) return callback(err);
    self._countChanges = result.count;
    return callback();
  });
};


User.prototype.remove = pgMap.remove;

function find(obj, ord, callback) {
  debug("find");
  pgMap.find({table: "usert", create: create}, obj, ord, callback);
}
function findById(id, callback) {
  debug("findById %s", id);
  pgMap.findById(id, {table: "usert", create: create}, callback);
}

function findOne(obj1, obj2, callback) {
  debug("findOne");
  pgMap.findOne({table: "usert", create: create}, obj1, obj2, callback);
}



var pgObject = {};
pgObject.createString = "CREATE TABLE usert (  id bigserial NOT NULL,  data json,  \
                  CONSTRAINT user_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);";
pgObject.indexDefinition = {
  "user_id_idx": "CREATE INDEX user_id_idx ON usert USING btree (((data ->> 'OSMUser'::text)))"

};
pgObject.viewDefinition = {};
pgObject.table = "usert";
module.exports.pg = pgObject;

User.prototype.validateEmail = function validateEmail(user, validationCode, callback) {
  debug("validateEmail");
  should(typeof (user)).eql("object");
  should(typeof (validationCode)).eql("string");
  should(typeof (callback)).eql("function");
  var self = this;
  var err;
  if (self.OSMUser !== user.OSMUser) {
    debug("User is wrong");
    err = new Error("Wrong User: expected >" + self.OSMUser + "< given >" + user.OSMUser + "<");
    return callback(err);
  }
  if (!self.emailInvalidation) {
    debug("nothing in validation");
    err = new Error("No Validation pending for user >" + self.OSMUser + "<");
    return callback(err);
  }
  if (validationCode !== self.emailValidationKey) {
    debug("Validation Code is wrong");
    err = new Error("Wrong Validation Code for EMail for user >" + self.OSMUser + "<");
    messageCenter.global.sendInfo({oid: self.id, user: user.OSMUser, table: "usert", property: "email", from: null, to: "Validation Failed"}, function() {
      return callback(err);
    });
    return;
  }
  debug("Email Validation OK saving User");
  var oldmail = self.email;
  self.email = self.emailInvalidation;
  delete self.emailInvalidation;
  delete self.emailValidationKey;
  self.save(function logit(err) {
    mailReceiver.updateUser(self);
    if (err) return callback(err);
    messageCenter.global.sendInfo({oid: self.id, user: user.OSMUser, table: "usert", property: "email", from: oldmail, to: self.email}, function() {
      return callback(err);
    });
  });
};



User.prototype.setAndSave = function setAndSave(user, data, callback) {
  debug("setAndSave");
  should(typeof (user)).equal("string");
  should(typeof (data)).equal("object");
  should(typeof (callback)).equal("function");
  var self = this;
  delete self.lock;
  var sendWelcomeEmail = false;
  // remove spaces from front and and of email adress
  if (data.email) data.email = data.email.trim();

  // check and react on Mail Change
  if (data.email && data.email.trim() !== "" && data.email !== self.email) {
    if (self.OSMUser !== user && self.hasLoggedIn()) return callback(new Error("EMail address can only be changed by the user himself, after he has logged in."));
    if (data.email !== "resend") {
      if (!emailValidator.validate(data.email)) {
        var error = new Error("Invalid Email Address: " + data.email);
        return callback(error);
      }
      if (data.email !== "") {
        // put email to validation email, and generate a key.
        data.emailInvalidation = data.email;
        data.emailValidationKey = random.generate();
        delete data.email;
      }
    } else {
      // resend case.
      delete data.email;
    }


    sendWelcomeEmail = true;
  }

  // Check Change of OSMUser Name.
  if (data.OSMUser !== self.OSMUser) {
    if (self.hasLoggedIn()) return callback(new Error(">" + self.OSMUser + "< already has logged in, change in name not possible."));
  }
  async.series([
    function checkUserName(cb) {
      if (data.OSMUser && data.OSMUser !== self.OSMUser) {
        find({OSMUser: data.OSMUser}, function(err, result) {
          if (err) return callback(err);
          if (result && result.length) {
            return cb(new Error("User >" + data.OSMUser + "< already exists."));
          } else return cb();
        });
      } else return cb();
    }
  ], function finalFunction(err) {
    if (err) return callback(err);
    async.forEachOf(data, function setAndSaveEachOf(value, key, cbEachOf) {
        // There is no Value for the key, so do nothing
      if (typeof (value) === "undefined") return cbEachOf();

        // The Value to be set, is the same then in the object itself
        // so do nothing
      if (value === self[key]) return cbEachOf();
      if (JSON.stringify(value) === JSON.stringify(self[key])) return cbEachOf();
      if (typeof (self[key]) === "undefined" && value === "") return cbEachOf();


      debug("Set Key %s to value >>%s<<", key, value);
      debug("Old Value Was >>%s<<", self[key]);


      async.series([
        function(cb) {
            // do not log validation key in logfile
          var toValue = value;
            // Hide Validation Key not to show to all users
          if (key === "emailValidationKey") return cb();

          messageCenter.global.sendInfo({oid: self.id, user: user, table: "usert", property: key, from: self[key], to: toValue}, cb);
        },
        function(cb) {
          self[key] = value;
          cb();
        }
      ], function(err) {
        cbEachOf(err);
      });
    }, function setAndSaveFinalCB(err) {
      debug("setAndSaveFinalCB");
      if (err) return callback(err);
      self.save(function (err) {
          // Inform Mail Receiver Module, that there could be a change
        if (err) return callback(err);
          // tell mail receiver to update the information about the users
        mailReceiver.updateUser(self);
        if (sendWelcomeEmail) {
          var m = new mailReceiver.MailReceiver(self);
            // do not wait for mail to go out.
            // mail is logged in outgoing mail list
          m.sendWelcomeMail(user, function () {});
        }
        return callback();
      });
    });
  });
};


User.prototype.hasLoggedIn = function hasLoggedIn() {
  debug("User.prototype.hasLoggedIn");
  if (this.lastAccess) return true;
  return false;
};


User.prototype.getNotificationStatus = function getNotificationStatus(channel, type) {
  debug("User.prototype.getNotificationStatus");
  if (!this.notificationStatus) return null;
  if (!this.notificationStatus[channel]) return null;
  return this.notification[channel][type];
};

User.prototype.getMainLang = function getMainLang() {
  debug("User.prototype.getMainLang");
  if (this.mainLang) return this.mainLang;
  if (this.language) return this.language;
  return "EN";
};

User.prototype.getSecondLang = function getSecondLang() {
  debug("User.prototype.getMainLang");
  if (this.secondLang) return this.secondLang;
  return null;
};

User.prototype.getLang3 = function getLang3() {
  debug("User.prototype.getLang3");
  if (this.lang3) return this.lang3;
  return null;
};

User.prototype.getLang4 = function getLang4() {
  debug("User.prototype.getLang4");
  if (this.lang4) return this.lang4;
  return null;
};


User.prototype.setOption = function setOption(view, option, value) {
  debug("User.prototype.setOption");
  if (!this.option) this.option = {};
  if (!this.option[view]) this.option[view] = {};
  this.option[view][option] = value;
};


var defaultOption = {};

User.prototype.getOption = function getOption(view, option) {
  debug("User.protoype.getOption");
  if (this.option && this.option[view] && this.option[view][option]) return this.option[view][option];
  if (defaultOption && defaultOption[view] && defaultOption[view][option]) return defaultOption[view][option];
  return null;
};


User.prototype.createApiKey = function createApiKey(callback) {
  debug("createApiKey");
  let apiKey = random.generate({length: 10});
  this.apiKey = apiKey;
  this.save(callback);
};

// Creates an User object and stores it to database
// can use a prototype to initialise data
// Parameter: Prototype (optional)
//            callback
// Prototype is not allowed to have an id
module.exports.createNewUser = createNewUser;


// save stores the current object to database
User.prototype.save = pgMap.save; // Create Tables and Views


module.exports.create = create;
module.exports.find = find;
module.exports.findById = findById;
module.exports.findOne = findOne;

User.prototype.getTable = function getTable() {
  return "usert";
};
