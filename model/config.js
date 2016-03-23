"use strict";

var pgMap    = require('./pgMap.js');
var debug    = require('debug')('OSMBC:model:config');
var should   = require('should');
var async    = require('async');
var yaml  = require('js-yaml');
var fs    = require('fs');
var path  = require('path');
var config = require('../config.js');
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

  if (proto) should.not.exist(proto.id);
  var config = create(proto);
  if (typeof(configMap[config.name])!="undefined") {
    // Configuration already exists
    return callback(new Error("Config >" + config.name + "< already exists."));
  }
  find({name:config.name},function (err,result) {
    if (err) return callback(err);
    if (result && result.length > 0) {
      return callback(new Error("Config >" + config.name + "< already exists."));
    }
    configMap[config.name] =
    callback(null,config);
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


function readPlaceholder(callback) {
  debug("readPlaceholder");
  var placeholder = {};
  placeholder.markdown = {};
  async.series([
    function placeholderDE(callback) {
      getConfig("formulation_tipDE",function(err,result){
        if (err) return callback(err);
        placeholder.markdown.DE = result;
        callback();
      });
    },
    function placeholderDE(callback) {
      getConfig("formulation_tipEN",function(err,result){
        if (err) return callback(err);
        placeholder.markdown.EN = result;
        callback();
      });
    },
    function categories(callback) {
      getConfig("categorydescription",function(err,result){
        if (err) return callback(err);
        placeholder.categories = result;
        callback();
      });
    }],
    function final(err) {
      if (err) return callback(err);
      for (var i=0;i<config.getLanguages();i++) {
        var lang = config.getLanguages()[i];
        if (!(placeholder.markdown[lang])) {
          placeholder.markdown[lang]=placeholder.markdown.EN;
        }
      }

      return callback(null,placeholder);

  });
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

function defaultConfig(text,callback) {
  debug("defaultConfig");
  var proto= {};
  var data = readDefaultData(text);
  switch (text) {
    case "formulation_tipEN":
    case "formulation_tipDE":
      proto =  {type: "text", name: text,yaml:data};
      break;
    case "calendartranslation":
    case "categorydescription":
    case "calendarflags":
      proto = {type:"yaml",name:text,yaml:data};
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

function actualiseConfigMap(obj) {
  if (obj.type == "yaml") {
    return obj.getJSON();
  }
  if (obj.type == "text") {
    return result.yaml;
  }
  return null;

}

function getConfig(text,callback) {
  debug('getConfig');
  getConfigObject(text,function(err,result){
    if (err) return callback(err);
    if (!result) return callback(new Error("Config >"+text+"< not found"));


    if (result.type == "yaml") {
      return callback(null,result.getJSON());
    }
    if (result.type == "text") {
      return callback(null,result.yaml);
    }
    return callback(new Error("undefined config type >"+text+"<, program error"));

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
    self.save(callback);
  });
};





// Creates an User object and stores it to database
// can use a prototype to initialise data
// Parameter: Prototype (optional)
//            callback
// Prototype is not allowed to have an id
module.exports.createNewConfig = createNewConfig;

Config.prototype._internalSave = pgMap.save;


// save stores the current object to database
Config.prototype.save = function saveConfig(callback) {
  debug('Config.prototype.save');
  this._internalSave(function didit(err,result){
    if (err) return callback(err);
    delete configMap[result.name];
    initConfigElement(result.name,callback);
  });
};


function initConfigElement(name,callback) {
  debug('initConfigElement');
  if (configMap[name]) return callback();
  getConfig(name,function(err,result){
    if (err) return callback(err);
    configMap[name] = result;
    return callback(null,result);
  });
}


var configMap = null;
function initialise(callback) {
  debug("initialise");
  if (configMap) return callback();
  configMap = {};
  async.parallel([
      initConfigElement.bind(null,"formulation_tipEN"),
      initConfigElement.bind(null,"formulation_tipDE"),
      initConfigElement.bind(null,"calendartranslation"),
      initConfigElement.bind(null,"categorydescription"),
      initConfigElement.bind(null,"calendarflags")
  ],
    function final(err){
      return callback(err);
  });
}


module.exports.create= create;
module.exports.find = find;
module.exports.findById = findById;
module.exports.findOne = findOne;
module.exports.getConfig = function(text) {
  return configMap[text];
};
module.exports.getConfigObject = getConfigObject;
module.exports.readPlaceholder = readPlaceholder;
module.exports.initialise = initialise;


Config.prototype.getTable = function getTable() {
  return "config";
};
