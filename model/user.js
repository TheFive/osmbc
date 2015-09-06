var pg = require('pg');
var config = require('../config.js');
var pgMap = require('./pgMap.js');
var debug = require('debug')('OSMBC:model:user');
var should = require('should');
var async = require('async');
var logModule = require('../model/logModule.js');

function User (proto)
{
	debug("User");
  debug("Prototype %s",JSON.stringify(proto));
  this.id = 0;
  this._meta={};
  this._meta.table = "usert";
  for (k in proto) {
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
    delete proto;
  }
  should.not.exist(proto.id);
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
  createString = 'CREATE TABLE usert (  id bigserial NOT NULL,  data json,  \
                  CONSTRAINT user_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);'

  pgMap.createTable('usert',createString,createView,cb)
}

function dropTable(cb) {
  debug('dropTable');
  pgMap.dropTable('usert',cb);
}


function setAndSave(user,data,callback) {
  debug("setAndSave");
  should(typeof(user)).equal('string');
  should(typeof(data)).equal('object');
  should(typeof(callback)).equal('function');
  var self = this;
  delete self.lock;


  async.forEachOf(data,function setAndSaveEachOf(value,key,cb_eachOf){
    // There is no Value for the key, so do nothing
    if (typeof(value)=='undefined') return cb_eachOf();

    // The Value to be set, is the same then in the object itself
    // so do nothing
    if (value == self[key]) return cb_eachOf();
    
    debug("Set Key %s to value >>%s<<",key,value);
    debug("Old Value Was >>%s<<",self[key]);


    async.series ( [
        function(cb) {
           logModule.log({oid:self.id,user:user,table:"usert",property:key,from:self[key],to:value},cb);
        },
        function(cb) {
          self[key] = value;
          cb();
        }
      ],function(err){
        cb_eachOf(err);
      })

  },function setAndSaveFinalCB(err) {
    if (err) return callback(err);
    self.save(function (err) {
      callback(err);
    });
  })
} 

// Creates an User object and stores it to database
// can use a prototype to initialise data
// Parameter: Prototype (optional)
//            callback
// Prototype is not allowed to have an id
module.exports.createNewUser = createNewUser;


// save stores the current object to database
User.prototype.save = pgMap.save;
User.prototype.setAndSave = setAndSave;

// Create Tables and Views
module.exports.createTable = createTable;

// Drop Table (and views)
module.exports.dropTable = dropTable;

module.exports.create= create;
module.exports.find = find;
module.exports.findById = findById;
module.exports.findOne = findOne;
module.exports.table = "usert";
