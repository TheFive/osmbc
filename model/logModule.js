var pg = require('pg');
var async = require('async');
var config = require('../config.js');
var pgMap = require('../model/pgMap.js');
var debug = require('debug')('OSMBC:logModule');
var should = require('should');

var articleModule = require('../model/article.js');
var blogModule = require('../model/blog.js');
var userModule = require('../model/user.js');


module.exports.log = function log(object,callback) {
	debug("log");
  async.series([
    function checkOid(callback) {
      
      if (typeof(object.oid)!="object") return callback();

      var table = oid.table;
      var reference = oid.r;
      var module;

      switch (table) {
        case "article": module = articleModule;break;
        case "blog": module = blogModule;break;
        case "user": module = userModule;break;
        default: module = null;
      }
      pgMap.find(module,reference,function(err,result) {
        if (err) return callback(err);
        if (result ==null) return callback(new Error("Object Id Not Found in Log Module"));
        object.oid = result.id;
        callback(); 
      })
    },
    function saveData(callback) {
      pg.connect(config.pgstring, function(err, client, pgdone) {
      	if (err) {
      		pgdone();
      		return (callback(err));
      	}
        object.timestamp = new Date();
      	var query = client.query("insert into changes (data) values ($1) ", [object]);
      	query.on('end',function (result) {  		
      		pgdone();
      		callback();
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
  createView = '';
  pgMap.createTable('changes',createString,createView,cb)
}

function dropTable(cb) {
  debug('dropTable');
  pgMap.dropTable('changes',cb);
}

module.exports.table = "changes";
module.exports.createTable = createTable;
module.exports.dropTable = dropTable;