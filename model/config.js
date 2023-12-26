import { strict as assert } from "assert";
import { eachOf, series } from "async";
import { load } from "js-yaml";
import { readFileSync } from "fs";
import { resolve } from "path";



import pgMap from "../model/pgMap.js";
import language from "..//model/language.js";
import util from "../util/util.js";
import sanitize from "sanitize-html";
import config from "../config.js";


import messageCenter from "../notification/messageCenter.js";
import { initialiseSlackReceiver } from "../notification/slackReceiver.js";


import _debug from "debug";
const debug = _debug("OSMBC:model:config");

const mediaFolderLocal = config.getValue("media folder", { mustExist: true }).local;



function freshupVotes(json) {
  if (typeof json !== "object") return [];
  if (!Array.isArray(json)) {
    return { warning: ["Votes should be a YAML List"] };
  }
  for (let i = 0; i < json.length; i++) {
    const item = json[i];
    if (item.icon && item.icon.substring(0, 3) === "fa-") item.iconClass = "fa-lg fa " + item.icon;
    if (item.icon && item.icon.substring(0, 10) === "glyphicon-") item.iconClass = "glyphicon " + item.icon;
  }
  return json;
}

function freshupEmoji(json) {
  const warning = [];
  const newEmoji = {};
  if (json.emoji) {
    for (const key in json.emoji) {
      let value = json.emoji[key];

      if (value.substring(0, mediaFolderLocal.length) === mediaFolderLocal) value = `<img src="${value}"></img>`;

      value = sanitize(value, {
        allowedTags: sanitize.defaults.allowedTags.concat(["img"])
      });
      newEmoji[key] = value;
    }
  } else warning.push("Missing Emoji Entry.");
  json.emoji = newEmoji;
  const newShortcut = {};
  if (json.shortcut) {
    for (const key in json.shortcut) {
      const value = json.shortcut[key];
      if (!(key in newEmoji)) {
        warning.push(`Shortcut ${key} is not an emojy, ignored`);
        continue;
      }
      if (typeof value === "string") {
        newShortcut[key] = value;
        continue;
      }
      warning.push(`Datatype for shortcut ${key} is not string, ignored`);
    }
  }
  json.shortcut = newShortcut;
  json.warning = warning;
  return json;
}

function Config (proto) {
  debug("Config");
  debug("Prototype %s", JSON.stringify(proto));
  this.id = 0;
  for (const k in proto) {
    this[k] = proto[k];
  }
}

function create (proto) {
  debug("create");
  return new Config(proto);
}

function createNewConfig (proto, callback) {
  debug("createNewConfig");
  assert(typeof (proto) === "object");
  assert(proto.type);
  assert(configMap);

  if (proto) assert(typeof proto.id === "undefined");
  const config = create(proto);
  if (typeof (configMap[config.name]) !== "undefined") {
    // Configuration already exists
    return callback(new Error("Config >" + config.name + "< already exists."));
  }
  actualiseConfigMap(config);
  find({ name: config.name }, function (err, result) {
    if (err) return callback(err);
    if (result && result.length > 0) {
      return callback(new Error("Config >" + config.name + "< already exists."));
    }
    assert(config.type);
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
      this.json = load(this.yaml);
      if (this.name === "votes") this.json = freshupVotes(this.json);
      if (this.name === "languageflags") this.json = freshupEmoji(this.json);
      checkAndRepair[this.name](this);
      return this.json;
    } catch (err) {
      return { error: "YAML convert error for: " + this.name + " ", errorMessage: err };
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
  pgMap.find({ table: "config", create: create }, obj, ord, callback);
}

function findOne(obj1, obj2, callback) {
  debug("findOne");
  pgMap.findOne({ table: "config", create: create }, obj1, obj2, callback);
}




function readDefaultData(text) {
  debug("readDefaultData");
  const data = {};
  try {
    data.yaml = readFileSync(resolve(config.getDirName(), "data", text + ".yaml"), "UTF8");
    data.type = "yaml";
    data.name = text;
    return data;
  } catch (err) {
    // File not found, return nothing
    // try txt next
  }
  try {
    data.text = readFileSync(resolve(config.getDirName(), "data", text + ".txt"), "UTF8");
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
  const data = readDefaultData(text);
  assert(data.type);
  createNewConfig(data, callback);
}


function getConfigObject(text, callback) {
  debug("getConfigObject %s", text);
  findOne({ name: text }, function _doGetConfigObject(err, result) {
    debug("_doGetConfigObject %s", text);
    if (err) return callback(err);
    if (result) assert(result.type);
    return callback(null, result);
  });
}

function actualiseConfigMap(obj) {
  assert(obj);
  assert(configMap);
  configMap[obj.name] = obj;
}




const pgObject = {};
pgObject.createString = "CREATE TABLE config (  id bigserial NOT NULL,  data json,  \
                  CONSTRAINT config_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);";
pgObject.indexDefinition = {};
pgObject.viewDefinition = {};
pgObject.table = "config";


const checkAndRepair = {
  formulation_tipEN: function () {},
  formulation_tipDE: function () {},
  calendartranslation: function (c) {
    let ct = c.getJSON();
    if (!ct) ct = {};
    if (!ct.town) ct.town = {};
    if (!ct.title) ct.title = {};
    if (!ct.date) ct.date = {};
    if (!ct.country) ct.country = {};
    if (!ct.footer) ct.footer = {};
    c.json = ct;
  },
  categorydescription: function(c) {
    let cd = c.getJSON();
    if (!cd) cd = {};
    c.json = cd;
  },
  languageflags: function(c) {
    let lf = c.getJSON();
    if (!lf) lf = {};
    c.json = lf;
  },
  automatictranslatetext: function(c) {
    let lf = c.getJSON();
    if (!lf) lf = {};
    c.json = lf;
  },
  calendarflags: function(c) {
    let cf = c.getJSON();
    if (!cf) cf = {};
    c.json = cf;
  },
  ignoreforsearch: function(c) {
    let cf = c.getJSON();
    if (!cf) cf = [];
    c.json = cf;
  },
  slacknotification: function(c) {
    let cf = c.getJSON();
    if (!cf) cf = {};
    c.json = cf;
  },
  licenses: function(c) {
    let l = c.getJSON();
    if (!l) l = {};
    if (!l.CC0) l.CC0 = "";
    c.json = l;
  },

  categorytranslation: function(c) {
    let ct = c.getJSON();
    if (!ct) ct = [];
    c.json = ct;
  },
  editorstrings: function (c) {
    let es = c.getJSON();
    if (!es) es = {};
    c.json = es;
  },
  votes: function (c) {
    let v = c.getJSON();
    if (!v) v = [];
    c.json = v;
  },
  eventsfilter: function (c) {
    let v = c.getJSON();
    if (!v) v = [];
    c.json = v;
  },
  newArticles: function(c) {
    let v = c.getJSON();
    if (!v) v = {};
    for (const k in v) {
      for (const k2 in v[k]) {
        if (["collection", "title", "categoryEN"].indexOf(k2) >= 0) continue;
        delete v[k][k2];
      }
    }
    c.json = v;
  }
};


Config.prototype.setAndSave = function setAndSave(user, data, callback) {
  const self = this;
  function _configSetAndSave(user, data, callback) {
    debug("setAndSave");
    util.requireTypes([user, data, callback], ["object", "object", "function"]);
    // try to convert YAML if necessary

    delete self.json;


    eachOf(data, function setAndSaveEachOf(value, key, cbEachOf) {
      // There is no Value for the key, so do nothing
      if (typeof (value) === "undefined") return cbEachOf();

      // The Value to be set, is the same then in the object itself
      // so do nothing
      if (value === self[key]) return cbEachOf();
      if (JSON.stringify(value) === JSON.stringify(self[key])) return cbEachOf();
      if (typeof (self[key]) === "undefined" && value === "") return cbEachOf();


      debug("Set Key %s to value >>%s<<", key, value);
      debug("Old Value Was >>%s<<", self[key]);


      series([
        function calculateID(cb) {
          if (self.id !== 0) return cb();
          self.save(cb);
        },
        function(cb) {
          // do not log validation key in logfile
          const toValue = value;

          messageCenter.global.sendInfo({ oid: self.id, user: user.OSMUser, table: "config", property: key, from: self[key], to: toValue }, cb);
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
        initialiseSlackReceiver();
      }
      self.save(callback);
    });
  }
  if (callback) {
    return _configSetAndSave(user, data, callback);
  }
  return new Promise((resolve, reject) => {
    _configSetAndSave(user, data, (err) => { (err) ? reject(err) : resolve(); });
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
  assert(configMap);
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


let configMap = null;

function initialiseConfigMap() { configMap = null; }

function initialise(callback) {
  function _initialise(callback) {
    debug("initialise");
    assert(callback);
    if (configMap) return callback();
    configMap = {};
    series([
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
      initConfigElement.bind(null, "ignoreforsearch"),
      initConfigElement.bind(null, "newArticles")
    ],
    function final(err) {
      debug("finalFunction initialise");
      return callback(err);
    });
  }
  if (callback) {
    return _initialise(callback);
  }
  return new Promise((resolve, reject) => {
    _initialise((err, result) => err ? reject(err) : resolve(result));
  });
}


function getConfig(text) {
  debug("exports.getConfig");
  assert(configMap);

  return configMap[text].getValue();
}

function getConfigObjectExported(text, callback) {
  function _getConfigObject(text, callback) {
    debug("exports.getConfigObject");
    let config = null;
    assert(configMap);
    if (configMap[text]) {
      config = configMap[text];
    } else {
      for (const key in configMap) {
        const c = configMap[key];
        if (c.id === text) {
          config = c;
          break;
        }
      }
    }
    assert(config);
    if (callback) return callback(null, config);
    return config;
  }
  if (callback) {
    return _getConfigObject(text, callback);
  }
  return new Promise((resolve, reject) => {
    _getConfigObject(text, (err, result) => (err) ? reject(err) : resolve(result));
  });
};



Config.prototype.getTable = function getTable() {
  return "config";
};

function getPlaceholder() {
  const phEN = getConfig("formulation_tipEN");
  const phDE = getConfig("formulation_tipDE");
  const cat = getConfig("categorydescription");
  const result = { markdown: { EN: phEN, DE: phDE }, categories: cat };
  for (const lang in language.getLanguages()) {
    if (lang === "DE") continue;
    if (lang === "EN") continue;
    result.markdown[lang] = phEN;
  }
  return result;
}

const configModule = {
  pg: pgObject,
  initialiseConfigMap: initialiseConfigMap,
  getConfig: getConfig,
  getConfigObject: getConfigObjectExported,
  initialise: initialise,
  getPlaceholder: getPlaceholder,
  Class: Config

};

export default configModule;
