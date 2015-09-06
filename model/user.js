var pg = require('pg');
var config = require('../config.js');
var pgMap = require('./pgMap.js');
var debug = require('debug')('OSMBC:model:user');
var should = require('should');

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

// Creates an User object and stores it to database
// can use a prototype to initialise data
// Parameter: Prototype (optional)
//            callback
// Prototype is not allowed to have an id
module.exports.createNewUser = createNewUser;


// save stores the current object to database
User.prototype.save = pgMap.save;

// Create Tables and Views
module.exports.createTable = createTable;

// Drop Table (and views)
module.exports.dropTable = dropTable;

module.exports.create= create;
module.exports.find = find;
module.exports.findById = findById;
module.exports.findOne = findOne;
module.exports.table = "usert";
