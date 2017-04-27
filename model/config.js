"use strict";

var debug    = require("debug")("OSMBC:model:config");
var should   = require("should");
var async    = require("async");
var yaml     = require("js-yaml");
var fs       = require("fs");
var path     = require("path");


var pgMap    = require("../model/pgMap.js");
var config   = require("../config.js");

var messageCenter = require("../notification/messageCenter.js");
var slackReceiver = require("../notification/slackReceiver.js");


function freshupVotes(json) {
  if (typeof json !== "object") return [];
  if (!Array.isArray(json)) return [];
  for (let i = 0; i < json.length; i++) {
    let item = json[i];
    if (item.icon && item.icon.substring(0, 3) === "fa-") item.iconClass = "fa-lg fa " + item.icon;
    if (item.icon && item.icon.substring(0, 10) === "glyphicon-") item.iconClass = "glyphicon " + item.icon;
  }
  return json;
}

function Config (proto) {
  debug("Config");
  debug("Prototype %s", JSON.stringify(proto));
  this.id = 0;
  for (var k in proto) {
    this[k] = proto[k];
  }
}

function create (proto) {
  debug("create");
  return new Config(proto);
}

function createNewConfig (proto, callback) {
  debug("createNewConfig");
  should(typeof (proto)).eql("object");
  should.exist(proto.type);

  if (proto) should.not.exist(proto.id);
  var config = create(proto);
  if (typeof (configMap[config.name]) !== "undefined") {
    // Configuration already exists
    return callback(new Error("Config >" + config.name + "< already exists."));
  }
  actualiseConfigMap(config);
  find({name: config.name}, function (err, result) {
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
  debug("Config.prototype.getJSON");
  // try to convert YAML if necessary
  if (this.json) {
    return this.json;
  }
  if (this.type === "yaml") {
    try {
      this.json = yaml.safeLoad(this.yaml);
      if (this.name === "votes") this.json = freshupVotes(this.json);
      return this.json;
    } catch (err) {
      return {error: "YAML convert error for: " + this.name + " ", errorMessage: err};
    }
  }
};

Config.prototype.getValue = function getValue() {
  debug("Config.prototype.getValue");
  if (this.type === "text") return this.text;
  if (this.type === "yaml") return this.getJSON();
  return "Unknown Type";
};

function find(obj, ord, callback) {
  debug("find");
  pgMap.find({table: "config", create: create}, obj, ord, callback);
}

function findOne(obj1, obj2, callback) {
  debug("findOne");
  pgMap.findOne({table: "config", create: create}, obj1, obj2, callback);
}




function readDefaultData(text) {
  debug("readDefaultData");
  var data = {};
  try {
    data.yaml = fs.readFileSync(path.resolve(__dirname, "..", "data", text + ".yaml"), "UTF8");
    data.type = "yaml";
    data.name = text;
    return data;
  } catch (err) {
    // File not found, return nothing
    // try txt next
  }
  try {
    data.text = fs.readFileSync(path.resolve(__dirname, "..", "data", text + ".txt"), "UTF8");
    data.type = "text";
    data.name = text;
    return data;
  } catch (err) {
    // File not found, return nothing
    // try txt next
  }
  return data;
}



function defaultConfigObject(text, callback) {
  debug("defaultConfigObject");
  var data = readDefaultData(text);
  should.exist(data.type);
  createNewConfig(data, callback);
}


function getConfigObject(text, callback) {
  debug("getConfigObject %s", text);
  findOne({name: text}, function _doGetConfigObject(err, result) {
    debug("_doGetConfigObject %s", text);
    if (err) return callback(err);
    if (result) should.exist(result.type);
    return callback(null, result);
  });
}

function actualiseConfigMap(obj) {
  should.exist(obj);
  configMap[obj.name] = obj;
}




var pgObject = {};
pgObject.createString = "CREATE TABLE config (  id bigserial NOT NULL,  data json,  \
                  CONSTRAINT config_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);";
pgObject.indexDefinition = {};
pgObject.viewDefinition = {};
pgObject.table = "config";
module.exports.pg = pgObject;


var checkAndRepair = {
  "formulation_tipEN": function () {},
  "formulation_tipDE": function () {},
  "calendartranslation": function (c) {
    var ct = c.getJSON();
    if (!ct) ct = {};
    if (!ct.town) ct.town = {};
    if (!ct.title) ct.title = {};
    if (!ct.date) ct.date = {};
    if (!ct.country) ct.country = {};
    if (!ct.footer) ct.footer = {};
    c.json = ct;
  },
  "categorydescription": function(c) {
    var cd = c.getJSON();
    if (!cd) cd = {};
    c.json = cd;
  },
  "languageflags": function(c) {
    var lf = c.getJSON();
    if (!lf) lf = {};
    c.json = lf;
  },
  "automatictranslatetext": function(c) {
    var lf = c.getJSON();
    if (!lf) lf = {};
    c.json = lf;
  },
  "calendarflags": function(c) {
    var cf = c.getJSON();
    if (!cf) cf = {};
    c.json = cf;
  },
  "ignoreforsearch": function(c) {
    var cf = c.getJSON();
    if (!cf) cf = [];
    c.json = cf;
  },
  "slacknotification": function(c) {
    var cf = c.getJSON();
    if (!cf) cf = {};
    c.json = cf;
  },
  "licenses": function(c) {
    var l = c.getJSON();
    if (!l) l = {};
    if (!l.CC0) l.CC0 = "";
    c.json = l;
  },

  "categorytranslation": function(c) {
    var ct = c.getJSON();
    if (!ct) ct = [];
    c.json = ct;
  },
  "editorstrings": function (c) {
    var es = c.getJSON();
    if (!es) es = {};
    c.json = es;
  },
  "votes": function (c) {
    var v = c.getJSON();
    if (!v) v = [];
    c.json = v;
  },
  "eventsfilter": function (c) {
    var v = c.getJSON();
    if (!v) v = [];
    c.json = v;
  }
};


Config.prototype.setAndSave = function setAndSave(user, data, callback) {
  debug("setAndSave");
  should(typeof (user)).equal("string");
  should(typeof (data)).equal("object");
  should(typeof (callback)).equal("function");
  var self = this;

  // try to convert YAML if necessary

  delete self.json;


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
      function calculateID(cb) {
        if (self.id !== 0) return cb();
        self.save(cb);
      },
      function(cb) {
        // do not log validation key in logfile
        var toValue = value;

        messageCenter.global.sendInfo({oid: self.id, user: user, table: "config", property: key, from: self[key], to: toValue}, cb);
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
    checkAndRepair[self.name](self);
    if (self.json && self.json.error) {
      return callback(new Error(self.json.errorMessage));
    }
    actualiseConfigMap(self);

    if (self.name === "slacknotification") {
      // Reinitialise Slack Receiver if something is changed on slack notification.
      slackReceiver.initialise();
    }
    self.save(callback);
  });
};






Config.prototype._internalSave = pgMap.save;


// save stores the current object to database
Config.prototype.save = function saveConfig(callback) {
  debug("Config.prototype.save");
  delete this.json;
  this._internalSave(function didit(err, result) {
    if (err) return callback(err);
    actualiseConfigMap(result);
    return callback(null, result);
  });
};


function initConfigElement(name, callback) {
  debug("initConfigElement %s", name);
  if (configMap[name]) return callback(null, configMap[name]);
  getConfigObject(name, function _doInitConfigElement(err, result) {
    debug("_doInitConfigElement");
    if (err) return callback(err);
    if (!result) {
      return defaultConfigObject(name, callback);
    }
    actualiseConfigMap(result);
    return callback(null, result);
  });
}


var configMap = null;

module.exports.initialiseConfigMap = function initialiseConfigMap() { configMap = null; };

function initialise(callback) {
  debug("initialise");
  if (configMap) return callback();
  configMap = {};
  async.series([
    initConfigElement.bind(null, "formulation_tipEN"),
    initConfigElement.bind(null, "formulation_tipDE"),
    initConfigElement.bind(null, "calendartranslation"),
    initConfigElement.bind(null, "categorydescription"),
    initConfigElement.bind(null, "languageflags"),
    initConfigElement.bind(null, "calendarflags"),
    initConfigElement.bind(null, "slacknotification"),
    initConfigElement.bind(null, "licenses"),
    initConfigElement.bind(null, "categorytranslation"),
    initConfigElement.bind(null, "editorstrings"),
    initConfigElement.bind(null, "automatictranslatetext"),
    initConfigElement.bind(null, "votes"),
    initConfigElement.bind(null, "eventsfilter"),
    initConfigElement.bind(null, "ignoreforsearch")
  ],
    function final(err) {
      debug("finalFunction initialise");
      return callback(err);
    });
}


module.exports.getConfig = function(text) {
  debug("exports.getConfig");
  return configMap[text].getValue();
};
module.exports.getConfigObject = function(text, callback) {
  debug("exports.getConfig");
  if (callback) return callback(null, configMap[text]);
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
  var result = {markdown: {EN: phEN, DE: phDE}, categories: cat};
  for (let i = 0; i < config.getLanguages().length; i++) {
    let lang = config.getLanguages()[i];
    if (lang === "DE") continue;
    if (lang === "EN") continue;
    result.markdown[lang] = phEN;
  }
  return result;
};
