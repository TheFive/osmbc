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
  this._meta={};
  this._meta.table = "usert";
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
  pgMap.find(this,obj,ord,callback);
}
function findById(id,callback) {
	debug("findById %s",id);
  pgMap.findById(id,this,callback);
}

function findOne(obj1,obj2,callback) {
  debug("findOne");
  pgMap.findOne(this,obj1,obj2,callback);
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

function validateEmail(validationCode,callback) {
  debug('validateEmail');
  var self = this;
  var err;
  if (!self.emailInvalidation) {
    err = new Error("No Validation pending for user >"+self.OSMUser+"<");
    console.dir(self);
    return callback(err);
  }
  if (validationCode !== self.emailValidationKey) {
    err = new Error("Wrong Validation Code for EMail for user >"+self.OSMUser+"<");
    console.log("Given Key:"+validationCode);
    console.log("Expected :"+self.emailValidationKey);
    console.dir(self);
    return callback(err);
  }
  self.email = self.emailInvalidation;
  delete self.emailInvalidation;
  delete self.emailValidationKey;
  self.save(callback);
}



function setAndSave(user,data,callback) {
  debug("setAndSave");
  should(typeof(user)).equal('string');
  should(typeof(data)).equal('object');
  should(typeof(callback)).equal('function');
  var self = this;
  delete self.lock;
  var sendWelcomeEmail = false;

  if (data.email !== self.email) {
    if (data.email && data.email !== "" && !emailValidator.validate(data.email)) {
      var error = new Error("Invalid Email Adress: "+data.email);
      return callback(error);
    }
    if (data.email !== "") {
      data.emailInvalidation = data.email;
      delete data.email;
    }

   
    data.emailValidationKey = random.generate();
    if (emailValidator.validate(data.emailInvalidation)) sendWelcomeEmail = true;
  }


  async.forEachOf(data,function setAndSaveEachOf(value,key,cb_eachOf){
    // There is no Value for the key, so do nothing
    if (typeof(value)=='undefined') return cb_eachOf();

    // The Value to be set, is the same then in the object itself
    // so do nothing
    if (value == self[key]) return cb_eachOf();
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
      mailReceiver.updateUser(self);
      var m = new mailReceiver.MailReceiver(self);
      if (sendWelcomeEmail) {
        m.sendWelcomeMail(user,callback);
      } else return callback();
    });
  });
} 

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
User.prototype.save = pgMap.save;
User.prototype.setAndSave = setAndSave;
User.prototype.validateEmail = validateEmail;

// Create Tables and Views
module.exports.createTable = createTable;

// Drop Table (and views)
module.exports.dropTable = dropTable;

module.exports.create= create;
module.exports.find = find;
module.exports.findById = findById;
module.exports.findOne = findOne;
module.exports.table = "usert";
