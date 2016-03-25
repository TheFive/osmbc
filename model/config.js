"use strict";

var debug    = require('debug')('OSMBC:model:config');
var should   = require('should');
var async    = require('async');
var yaml     = require('js-yaml');
var fs       = require('fs');
var path     = require('path');


var pgMap    = require('../model/pgMap.js');
var config   = require('../config.js');

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
  should(typeof(proto)).eql("object");
  should.exist(proto.type);

  if (proto) should.not.exist(proto.id);
  var config = create(proto);
  if (typeof(configMap[config.name])!="undefined") {
    // Configuration already exists
    return callback(new Error("Config >" + config.name + "< already exists."));
  }
  actualiseConfigMap(config);
  find({name:config.name},function (err,result) {
    if (err) return callback(err);
    if (result && result.length > 0) {
      return callback(new Error("Config >" + config.name + "< already exists."));
    }
    should.exist(config.type);
    config.save(callback);
  });
}



Config.prototype.remove = pgMap.remove;

Config.prototype.getJSON = function getJSON() {
  // try to convert YAML if necessary
  if (this.json) return this.json;
  if (this.type == "yaml") {
    try {
      return  yaml.safeLoad(this.yaml);
    }
    catch(err) {
      return "YAML convert error for "+this.name + " " + err;
    }
  }
};

Config.prototype.getValue = function getValue() {
  debug("Config.prototype.getValue");
  if (this.type == "text") return this.yaml;
  if (this.type == "yaml") return this.getJSON();
  return "Unknown Type";
};

function find(obj,ord,callback) {
	debug("find");
  pgMap.find({table:"config",create:create},obj,ord,callback);
}

function findOne(obj1,obj2,callback) {
  debug("findOne");
  pgMap.findOne({table:"config",create:create},obj1,obj2,callback);
}




function readDefaultData(text) {
  debug("readDefaultData");
  try {
    var data = fs.readFileSync(path.resolve(__dirname,"..","data",text+".yaml"),"UTF8");

    return data;
  } catch (err) {
    // File not found, return nothing
    return "";
  }
}

function defaultConfigObject(text,callback) {
  debug("defaultConfigObject");
  var proto= {};
  var data = readDefaultData(text);
  switch (text) {
    case "formulation_tipEN":
      proto = {type:"text",name:text,yaml:data};
      break;
    case "formulation_tipDE":
      proto =  {type: "text", name: text,yaml:data};
      break;
    case "calendartranslation":
      proto = {type:"yaml",name:text,yaml:data};
      break;
    case "categorydescription":
      proto = {type:"yaml",name:text,yaml:data};
      break;
    case "calendarflags":
      proto = {type:"yaml",name:text,yaml:data};
      break;
    default:
      return callback(new Error("Undefined Configuration >"+text+"<, could not create"));
  }
  should.exist(proto.type);
  createNewConfig(proto,callback);
}


function getConfigObject(text,callback) {
  debug('getConfigObject %s',text);
  findOne({name:text},function _doGetConfigObject(err,result){
    debug("_doGetConfigObject %s",text);
    if (result) should.exist(result.type);
    return callback(null,result);
  });
}

function actualiseConfigMap(obj) {
  should.exist(obj);
  configMap[obj.name]=obj;
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
      function calculateID(cb) {
        if (self.id !== 0) return cb();
        self.save(cb);
      },
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
    actualiseConfigMap(self);
    self.save(callback);
  });
};






Config.prototype._internalSave = pgMap.save;


// save stores the current object to database
Config.prototype.save = function saveConfig(callback) {
  debug('Config.prototype.save');
  this._internalSave(function didit(err,result){
    if (err) return callback(err);
    actualiseConfigMap(result);
    return callback(null,result);
  });
};


function initConfigElement(name,callback) {
  debug('initConfigElement %s',name);
  if (configMap[name]) return callback(null,configMap[name]);
  getConfigObject(name,function _doInitConfigElement(err,result){
    debug("_doInitConfigElement");
    if (err) return callback(err);
    if (!result) {
      return defaultConfigObject(name,callback);

    }
    actualiseConfigMap(result);
    return callback(null,result);
  });
}


var configMap = null;

module.exports.initialiseConfigMap = function initialiseConfigMap() {configMap = null;};

function initialise(callback) {
  debug("initialise");
  if (configMap) return callback();
  configMap = {};
  async.series([
      initConfigElement.bind(null,"formulation_tipEN"),
      initConfigElement.bind(null,"formulation_tipDE"),
      initConfigElement.bind(null,"calendartranslation"),
      initConfigElement.bind(null,"categorydescription"),
      initConfigElement.bind(null,"calendarflags")
  ],
    function final(err){
      debug("finalFunction initialise");
      return callback(err);
  });
}


module.exports.getConfig = function(text) {
  debug("exports.getConfig");
  return configMap[text].getValue();
};
module.exports.getConfigObject = function(text,callback) {
  debug("exports.getConfig");
  if (callback) return callback(null,configMap[text]);
  return configMap[text];
};

module.exports.initialise = initialise;


Config.prototype.getTable = function getTable() {
  return "config";
};

module.exports.getPlaceholder = function getPlaceholder() {
  var phEN = exports.getConfig("formulation_tipEN");
  var phDE = exports.getConfig("formulation_tipDE");
  var cat = exports.getConfig("categorydescription");
  var result = {markdown:{EN:phEN,DE:phDE},categories:cat};
  for (let i=0;i<config.getLanguages().length;i++) {
    let lang = config.getLanguages()[i];
    if (lang === "DE") continue;
    if (lang === "EN") continue;
    result.markdown[lang] = phEN;
  }
  return result;
};