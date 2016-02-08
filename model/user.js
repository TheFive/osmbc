"use strict";

var pgMap = require('./pgMap.js');
var debug = require('debug')('OSMBC:model:user');
var should = require('should');
var async = require('async');
var messageCenter = require('../notification/messageCenter.js');
var mailReceiver = require('../notification/mailReceiver.js');
var random = require('randomstring');
var emailValidator = require('email-validator');


function User (proto)
{
	debug("User");
  debug("Prototype %s",JSON.stringify(proto));
  this.id = 0;
  for (var k in proto) {
    this[k] = proto[k];
  }
}

function create (proto) {
	debug("create");
	return new User(proto);
}

function createNewUser (proto,callback) {
  debug("createNewUser");
  if (typeof(proto)=='function') {
    callback = proto;
    proto = null;
  }
  if (proto) should.not.exist(proto.id);
  var user = create(proto);
  user.save(callback);
}



User.prototype.remove = pgMap.remove;

function find(obj,ord,callback) {
	debug("find");
  pgMap.find({table:"usert",create:create},obj,ord,callback);
}
function findById(id,callback) {
	debug("findById %s",id);
  pgMap.findById(id,{table:"usert",create:create},callback);
}

function findOne(obj1,obj2,callback) {
  debug("findOne");
  pgMap.findOne({table:"usert",create:create},obj1,obj2,callback);
}

function createTable(cb) {
  debug('createTable');
  var createString = 'CREATE TABLE usert (  id bigserial NOT NULL,  data json,  \
                  CONSTRAINT user_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);';
  var createView="";
  pgMap.createTable('usert',createString,createView,cb);
}

function dropTable(cb) {
  debug('dropTable');
  pgMap.dropTable('usert',cb);
}

User.prototype.validateEmail = function validateEmail(user,validationCode,callback) {
  debug('validateEmail');
  should(typeof(user)).eql("object");
  should(typeof(validationCode)).eql("string");
  should(typeof(callback)).eql("function");
  var self = this;
  var err;
  if (self.OSMUser !== user.OSMUser) {
    debug("User is wrong");
    err = new Error("Wrong User: expected >"+self.OSMUser+"< given >"+user.OSMUser+"<");
    return callback(err);
  }
  if (!self.emailInvalidation) {
    debug("nothing in validation");
    err = new Error("No Validation pending for user >"+self.OSMUser+"<");
    return callback(err);
  }
  if (validationCode !== self.emailValidationKey) {
    debug("Validation Code is wrong");
    err = new Error("Wrong Validation Code for EMail for user >"+self.OSMUser+"<");
    messageCenter.global.sendInfo({oid:self.id,user:user.OSMUser,table:"usert",property:"email",from:null,to:"Validation Failed"},function(){
      return callback(err);
    });
    return;
  }
  debug("Email Validation OK saving User");
  var oldmail = self.email;
  self.email = self.emailInvalidation;
  delete self.emailInvalidation;
  delete self.emailValidationKey;
  self.save(function logit(err){
    if (err) return callback(err);
    messageCenter.global.sendInfo({oid:self.id,user:user.OSMUser,table:"usert",property:"email",from:oldmail,to:self.email},function(){
      return callback(err);
    });

  });
};



User.prototype.setAndSave = function setAndSave(user,data,callback) {
  debug("setAndSave");
  should(typeof(user)).equal('string');
  should(typeof(data)).equal('object');
  should(typeof(callback)).equal('function');
  var self = this;
  delete self.lock;
  var sendWelcomeEmail = false;

  if (data.email && data.email !== self.email) {
    if (data.email !=="resend") {
      if (!emailValidator.validate(data.email)) {
        var error = new Error("Invalid Email Adress: "+data.email);
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


  async.forEachOf(data,function setAndSaveEachOf(value,key,cb_eachOf){
    // There is no Value for the key, so do nothing
    if (typeof(value)=='undefined') return cb_eachOf();

    // The Value to be set, is the same then in the object itself
    // so do nothing
    if (value === self[key]) return cb_eachOf();
    if (JSON.stringify(value)===JSON.stringify(self[key])) return cb_eachOf();
    if (typeof(self[key])==='undefined' && value === '') return cb_eachOf();

    
    debug("Set Key %s to value >>%s<<",key,value);
    debug("Old Value Was >>%s<<",self[key]);


    async.series ( [
        function(cb) {
          // do not log validation key in logfile
          var toValue = value;
          // Hide Validation Key not to show to all users
          if (key === "emailValidationKey") return cb();

          messageCenter.global.sendInfo({oid:self.id,user:user,table:"usert",property:key,from:self[key],to:toValue},cb);
        },
        function(cb) {
          self[key] = value;
          cb();
        }
      ],function(err){
        cb_eachOf(err);
      });

  },function setAndSaveFinalCB(err) {
    debug('setAndSaveFinalCB');
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
        m.sendWelcomeMail(user,function (){});
      } 
      return callback();
    });
  });
};


User.prototype.getNotificationStatus = function getNotificationStatus(channel, type) {
  debug("User.prototype.getNotificationStatus");
  if (!this.notificationStatus) return null;
  if (!this.notificationStatus[channel]) return null;
  return this.notification[channel][type];
};



// Creates an User object and stores it to database
// can use a prototype to initialise data
// Parameter: Prototype (optional)
//            callback
// Prototype is not allowed to have an id
module.exports.createNewUser = createNewUser;


// save stores the current object to database
User.prototype.save = pgMap.save; // Create Tables and Views
module.exports.createTable = createTable;

// Drop Table (and views)
module.exports.dropTable = dropTable;

module.exports.create= create;
module.exports.find = find;
module.exports.findById = findById;
module.exports.findOne = findOne;

User.prototype.getTable = function getTable() {
  return "usert";
};
