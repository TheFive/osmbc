var pg = require('pg');
var config = require('../config.js');
var pgMap = require('../model/pgMap.js');
var debug = require('debug')('OSMBC:logModule');


module.exports.log = function log(object,callback) {
	debug("log");
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