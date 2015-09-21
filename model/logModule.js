var pg = require('pg');
var async = require('async');
var config = require('../config.js');
var pgMap = require('../model/pgMap.js');
var debug = require('debug')('OSMBC:model:logModule');
var should = require('should');

var articleModule = require('../model/article.js');
var blogModule = require('../model/blog.js');
var userModule = require('../model/user.js');


module.exports.log = function log(object,callback) {
	debug("log");
  async.series([
    function checkOid(oidcb) {
      debug("checkOid");
      
      if (typeof(object.oid)!="object") return oidcb();

      var table = object.oid.table;
      var reference = object.oid;
      delete reference.table;
      var module;


      switch (table) {
        case "article": module = articleModule;break;
        case "blog": module = blogModule;break;
        case "user": module = userModule;break;
        default: module = null;
      }
      pgMap.find(module,reference,function findObject(err,result) {
        debug("findObject");
        if (err) return callback(err);
        if (result ==null) return callback(new Error("Object Id Not Found in Log Module"));
        if (result.length != 1) return callback(new Error("Object Reference nicht eindeutig"));
        object.oid = result[0].id;
        oidcb(); 
      })
    },
    function saveData(savecb) {
      debug("saveData");
      pg.connect(config.pgstring, function(err, client, pgdone) {
      	if (err) {
      		pgdone();
      		return (savecb(err));
      	}
        if (typeof(object.timestamp)=='undefined') object.timestamp = new Date();
        debug(object);
      	var query = client.query("insert into changes (data) values ($1) ", [object]);
      	query.on('end',function (result) {  		
      		pgdone();
      		savecb();
      	})
      })
    }],
    function(err) {callback(err)}
  )
}


module.exports.find = function(obj1,obj2,callback) {
  debug('find');
  pgMap.find(this,obj1,obj2,callback);
}
module.exports.findById = function(id,callback) {
  debug('findById');
  pgMap.findById(id,this,callback);
}

module.exports.create = function() {
  return {};
}

function createTable(cb) {
  debug('createTable');
  createString = 'CREATE TABLE changes (  id bigserial NOT NULL,  data json,  \
                  CONSTRAINT changes_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);'
  createView = "create index on changes((data->>'table'),(data->>'oid'));";
  pgMap.createTable('changes',createString,createView,cb)
}

function dropTable(cb) {
  debug('dropTable');
  pgMap.dropTable('changes',cb);
}

module.exports.table = "changes";
module.exports.createTable = createTable;
module.exports.dropTable = dropTable;