"use strict";

var pgMap    = require('./pgMap.js');
var debug    = require('debug')('OSMBC:model:user');
var should   = require('should');
var async    = require('async');
var yaml  = require('js-yaml');
var messageCenter = require('../notification/messageCenter.js');

function Config (proto)
{
	debug("Config");
  debug("Prototype %s",JSON.stringify(proto));
  this.id = 0;
  for (var k in proto) {
    this[k] = proto[k];
  }
}

function create (proto) {
	debug("create");
	return new Config(proto);
}

function createNewConfig (proto,callback) {
  debug("createNewConfig");
  if (typeof(proto)=='function') {
    callback = proto;
    proto = null;
  }
  if (proto) should.not.exist(proto.id);
  var config = create(proto);
  find({name:config.name},function (err,result) {
    if (err) return callback(err);
    if (result && result.length > 0) {
      return callback(new Error("Config >" + config.name + "< already exists."));
    }
    // save data
    config.save(function saveConfig(err, result) {
      if (err) return callback(err, result);
      callback(null, result);
    });
  });
}



Config.prototype.remove = pgMap.remove;

function find(obj,ord,callback) {
	debug("find");
  pgMap.find({table:"config",create:create},obj,ord,callback);
}
function findById(id,callback) {
	debug("findById %s",id);
  pgMap.findById(id,{table:"config",create:create},callback);
}

function findOne(obj1,obj2,callback) {
  debug("findOne");
  pgMap.findOne({table:"config",create:create},obj1,obj2,callback);
}


function defaultConfig(text,callback) {
  debug("defaultConfig");
  var proto= {};
  switch (text) {
    case "formulation_tipEN":
    case "formulation_tipDE":
      proto =  {type: "text", name: text};
      break;
    case "calendarflags":
      proto = {type:"yaml",name:text};
      break;
    default:
      return callback(new Error("Undefined Configuration >"+text+"<, could not create"));
  }
  createNewConfig(proto,callback);
}


function getConfigObject(text,callback) {
  debug('getConfig');
  findOne({name:text},function(err,result){
    if (!result) return defaultConfig(text,callback);
    return callback(null,result);
  });
}
function getConfig(text,callback) {
  debug('getConfig');
  getConfigObject(text,function(err,result){
    if (err) return callback(err);
    if (!result) return callback(new Error("Config >"+text+"< not found"));
    if (result.type == "yaml") {
      return callback(null,result.json);
    }
    if (result.type == "text") {
      return callback(null.result.yaml);
    }
    return callback(new Error("undefined config type, programm error"));

  });

}


var pgObject= {};
pgObject.createString = 'CREATE TABLE config (  id bigserial NOT NULL,  data json,  \
                  CONSTRAINT config_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);';
pgObject.indexDefinition={};
pgObject.viewDefinition = {};
pgObject.table="config";
module.exports.pg = pgObject;





Config.prototype.setAndSave = function setAndSave(user,data,callback) {
  debug("setAndSave");
  should(typeof(user)).equal('string');
  should(typeof(data)).equal('object');
  should(typeof(callback)).equal('function');
  var self = this;

  // try to convert YAML if necessary
  if (self.type == "yaml") {
    try {
      self.json = yaml.safeLoad(data.yaml);
    }
    catch(err) {
      return callback(err);
    }
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

        messageCenter.global.sendInfo({oid:self.id,user:user,table:"config",property:key,from:self[key],to:toValue},cb);
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
    self.save(callback);
  });
};





// Creates an User object and stores it to database
// can use a prototype to initialise data
// Parameter: Prototype (optional)
//            callback
// Prototype is not allowed to have an id
module.exports.createNewConfig = createNewConfig;


// save stores the current object to database
Config.prototype.save = pgMap.save; // Create Tables and Views


module.exports.create= create;
module.exports.find = find;
module.exports.findById = findById;
module.exports.findOne = findOne;
module.exports.getConfig = getConfig;
module.exports.getConfigObject = getConfigObject;

Config.prototype.getTable = function getTable() {
  return "config";
};
