"use strict";

var pg     = require('pg');
var should = require('should');
var async  = require('async');
var debug  = require('debug')('OSMBC:model:pgMap');

var config = require('../config.js');
var util = require('../util.js');

function generateQuery(table,obj,order) {
  debug('generateQuery');

  var whereClause = "";

  var paramWhere = obj;
  if (obj && typeof(obj) == "object" && obj.sql) paramWhere = obj.sql;
  if (typeof(paramWhere)=='string') {
    whereClause = " "+ paramWhere;

    // if there is a select statement, expect and id and data, and take it.
    if (paramWhere.substring(0,6)==="select") {
      debug(paramWhere);
      return paramWhere;
    }
  } else {
    if (obj) {
      for (var k in obj) {
        var value = obj[k];
        var op = "=";
        if (typeof(value)=='string') {
          // check first operator in string
          if (value.substring(0,2)=="!=") {
            op = "!=";
            value = value.substring(2,9999);
          }   
          if (value.substring(0,2) == "IN") {
            op = "in";
            value = value.substring(2,999999);
          }
          if (op != "in") {
            // escape the Apostroph
            value = value.replace("'","''");
          }             
        }

        var n = "data->>'"+k+"'"+op+"'"+value+"'"; 
        if (op == "in") {
          n = "data->>'"+k+"'"+op+" "+value; 
          n = "("+n+" and (data->'"+k+"') is not null)";
        }

        if (value==="") {
          if (op == "=") {
            n = "("+n+" or (data->'"+k+"') is null)";
          }
          if (op == "!=") {
            n = "("+n+" and (data->'"+k+"') is not null)";
          }
        }
        if (whereClause ==="") whereClause = " where "+n;
        else whereClause += " and "+n;
      }    
    }
  }
  var orderby = " order by id";
  if (order) {
    should.exist(order.column);
    if (order.column != "id") orderby = " order by data->>'"+order.column+"'";
    if (order.desc) {
      orderby += " desc";
    }
    orderby += " , id ";
    if (order.limit) {
      orderby += " LIMIT "+order.limit;
    }
  }
  var query = "select id,data from "+table+whereClause+orderby;
  debug(query);
  return query;
}

 
module.exports.save = function(callback) {
  debug("save");
  var self = this;
  var table = self.getTable();

  // clean propertys with "_"

  for (var k in self) {
    if (k.substring(0,1)=="_") delete self[k];
  }

  // first check, wether ID is known or not
  if (self.id === 0) {
    // we have to create the object
    debug("Object has to be created");

    // store first version in database
    self.version = 1;
    pg.connect(config.pgstring, function(err, client, pgdone) {
      if (err) {
        pgdone();
        return (callback(err));
      }
      var sqlquery = "insert into "+table+"(data) values ($1) returning id";
      debug("Query %s",sqlquery);
      var startTime = new Date().getTime();
      var query = client.query(sqlquery, [self]);
      query.on('row',function(row) {
        debug("Created Row ID %s",row.id);
        self.id = row.id;
      });
      query.on('end',function () {

        var endTime = new Date().getTime();
        debug("SQL: ["+ (endTime - startTime)/1000 +"] insert to "+ table);
        
        pgdone();
        return callback(null,self);
      });
    });
  } else {
    debug("Object will be updated, current version is %s",self.version);
    pg.connect(config.pgstring, function(err, client, pgdone) {
      if (err) {
        pgdone();
        return (callback(err));
      }
      async.series([
        function(cb) {
          debug("Check version of object");
          var versionsEqual = false;

          var query = client.query("select (data->>'version')::int as version from "+table+" where id = $1",[self.id]);
            var startTime = new Date().getTime();
            query.on('row',function(row) {
              debug('row Version in Database %s',row.version);
              if (row.version===null) {
                // No Data in Database, so no conflict.
                versionsEqual = true;
              }
              else if (row.version == self.version) {
                debug('No Error');
                versionsEqual = true;
              }
            });
            query.on('end',function(){
              debug("end");
              var err = null;
              var endTime = new Date().getTime();
              debug("SQL: ["+ (endTime - startTime)/1000 +"]("+table+" versionCheck");
              if (!versionsEqual) {
                debug('send error');
                err = new Error("Version Number Differs");
              }
              return cb(err);
            });
        }
        ],
        function(err) {
          if (err) {
            debug('Foreward Error');
            pgdone();
            return callback(err);
          }
          self.version += 1;
          var query = client.query("update "+table+" set data = $2 where id = $1", [self.id,self]);
          /*query.on('row',function(row) {
            results.push(row);
          })*/
          query.on('end',function () {
            pgdone();
            return callback(null,self);
          });
        }
      );
    });
  }
};

module.exports.remove = function(callback) {
  debug("remove");
  var self = this;
  var table = self.getTable();
  // first check, wether ID is known or not
  if (self.id === 0) {
    // we have to create the beer
    callback(new Error("ID is zero, transient object not deleted."));
    return;
  }
  // we have to change the beer
  pg.connect(config.pgstring, function(err, client, pgdone) {
    if (err) return (callback(err));
    debug("call delete");

    var query = client.query("delete from "+table+" where id = $1", [self.id]);
    /*query.on('row',function(row) {
      results.push(row);
    })*/
    query.on('end',function (result) {
      debug("end called");
      
      pgdone();
      callback(null,result);
    });
  });
};

module.exports.find = function find(module,obj,order,callback) {
  debug("find");
  if (typeof(obj)=='function') {
    callback = obj;
    obj = null;
    order = null;
  } else if (typeof(order) == 'function') {
    callback = order;
    order = null;
  } else {
    should(typeof(order)).equal('object');
  }
  should(typeof(callback)).equal('function');

  debug("Connecting to DB" +config.pgstring);

  pg.connect(config.pgstring, function find_pgConnect(err, client, pgdone) {
    debug('find_pgConnect');
    if (err) {
      console.log("Connection Error");
      console.dir(err);
      pgdone();
      return (callback(err));
    }
    var table = module.table;
    var sqlQuery = generateQuery(table,obj,order);

    var result = [];

    var startTime = new Date().getTime();

    var query;

    if (obj && obj.params) {
      query = client.query(sqlQuery,obj.params);
      console.dir(sqlQuery);
      console.dir(obj.params);
    }
    else query = client.query(sqlQuery);

    query.on('row',function findRowFunction(row) {
      debug('findRowFunction');
      var r = module.create();
      for (var k in row.data) {
        r[k]=row.data[k];
      }
      r.id = row.id;
      result.push(r);
    });
    query.on('error',function findErrorFunction(error) {   
      debug('findErrorFunction');
      pgdone();
      callback(error);
    });
    query.on('end',function findEndFunction() {   
      debug('findEndFunction');
      var endTime = new Date().getTime();
      debug("SQL: ["+ (endTime - startTime)/1000 +"]("+result.length+" rows)"+ sqlQuery);
      pgdone();
      callback(null,result);
    });
  });
};



module.exports.fullTextSearch = function fullTextSearch(module,search,order,callback) {
  debug("fullTextSearch");
  should.exist(module.table);
  should.exist(module.create);
  should(typeof(search)).eql("string");
  if (typeof(order)=='function') {
    callback = order;
    order = null;
  }

  pg.connect(config.pgstring, function(err, client, pgdone) {
    if (err) {
      console.log("Connection Error");
      console.dir(err);

      pgdone();
      return (callback(err));
    }
 
    var result = [];

    var orderBy = "";

    if (order) {
      should.exist(order.column);
      orderBy = " order by data->>'"+order.column+"'";
      if (order.desc) {
        orderBy +=" desc";
      }
    }
    var germanVector = "@@ plainto_tsquery('german', '"+search+"')";
    var englishVector = "@@ plainto_tsquery('english', '"+search+"')";

    if (util.isURL(search)) {
      var http1Url = search;
      var http2Url;
      if (search.substring(0,5)=="http:") {
        http2Url = "https:"+search.substring(5,9999);
      }
      if (search.substring(0,6)=="https:") {
        http2Url = "http:"+search.substring(6,9999);
      }
      search = "''"+http1Url+"'' | ''("+http1Url+")'' ";
      if (http2Url) search += "| ''"+http2Url+"'' | ''("+http1Url+")'' ";
      germanVector = "@@ to_tsquery('german', '"+search+"')";
      englishVector = "@@ to_tsquery('english', '"+search+"')";
    }
   
    var sqlQuery =  "select id, data from article \
                          where to_tsvector('german', coalesce(data->>'title','')::text || ' '|| \
                                                      coalesce(data->>'collection','')  || ' '|| \
                                                      coalesce(data->>'markdownDE','')   ) "+germanVector+" \
                            or to_tsvector('english',  coalesce(data->>'collection','')  || ' '|| \
                                                      coalesce(data->>'markdownEN','')   ) "+englishVector+ 
                        orderBy;
    var startTime = new Date().getTime();

    var query = client.query(sqlQuery);

    query.on('row',function(row) {
      debug("query.on row");
      var r = module.create();
      for (var k in row.data) {
        r[k]=row.data[k];
      }
      r.id = row.id;
      result.push(r);
    });
    query.on('end',function () {    
      debug("query.on end");
      pgdone();
      var endTime = new Date().getTime();
      debug("SQL: ["+ (endTime - startTime)/1000 +"]("+result.length+" rows)"+ sqlQuery);
      return callback(null,result);
    });
    query.on('error',function (err) {  
      debug("query on err");
      debug(err);  
      pgdone();
      return callback(err);
    });
  });
};


module.exports.findById = function findById(id,module,callback) {
  debug("findById %s",id);
  var table = module.table;

  pg.connect(config.pgstring, function(err, client, pgdone) {
    if (err) {
      console.log("Connection Error");
      console.dir(err);

      pgdone();
      return (callback(err));
    }
    var result = null;
    var idToSearch = 0;

    if (id % 1 === 0) idToSearch = id;


    var startTime = new Date().getTime();

    var query = client.query("select id,data from "+table+" where id = $1", [idToSearch]);
    query.on('row',function(row) {
      result = module.create();
      for (var k in row.data) {
        result[k]=row.data[k];
      }
      result.id = row.id;
    });
    query.on('end',function () {    
      pgdone();
      var endTime = new Date().getTime();
      debug("SQL: ["+ (endTime - startTime)/1000 +"] Select by id from "+ table);
      callback(null,result);
    });
  });
};

module.exports.findOne = function findOne(module,obj,order,callback) {
  debug("findOne");
  if (typeof(obj)=='function') {
    callback = obj;
    obj = null;
  }
  if (typeof(order)=='function') {
    callback = order;
    order = null;
  }

  pg.connect(config.pgstring, function(err, client, pgdone) {
    if (err) {

      pgdone();
      return (callback(err));
    }
    var result = null;


    var sqlQuery = generateQuery(module.table,obj,order);

    var startTime = new Date().getTime();

    var query = client.query(sqlQuery+ " limit 1");
    query.on('row',function(row) {
      result = module.create();
      for (var k in row.data) {
        result[k]=row.data[k];
      }
      result.id = row.id;
    });
    query.on('end',function () {
      pgdone();
      var endTime = new Date().getTime();
      debug("SQL: ["+ (endTime - startTime)/1000 +"]"+ sqlQuery);
      callback(null,result);      
    });
  });
};


exports.createTables = function(pgObject,options,analyse,callback) {
  debug('createTable %s',pgObject.table);
  should(typeof(pg)).equal('object');
  should(typeof(options)).equal('object');
  if (typeof(analyse)==="function") {
    callback = analyse;
    analyse = {foundNOK:{},expected:{}};
  }
  should(typeof(analyse)).equal('object');

  pg.connect(config.pgstring,function(err,client,pgdone) {
    if (err) {
      callback(err);
      pgdone();
      return;
    }
    async.series([
      function tabledrop(cb) {
        if (options.dropTable) {
          if (options.verbose) console.log("Drop Table "+pgObject.table);
          var dropString = "DROP TABLE IF EXISTS "+pgObject.table+ " CASCADE";
          client.query(dropString,cb);
        } else return cb();
      },
      function tablecreation(cb) {
        if (options.createTable) {
          if (options.verbose) console.log("Create Table "+pgObject.table);
          if (options.verbose) console.log("Query: "+pgObject.createString);
          client.query(pgObject.createString,cb);
        } else return cb();
      },
      function indexdrop(cb) {
        var toBeDropped = [];
        var k;
        if (options.dropIndex) {
          for (k in pgObject.indexDefinition) {
            toBeDropped.push(k);
          }
        }
        if (options.updateIndex) {
          for (k in analyse.foundNOK) {
            if (toBeDropped.indexOf(k)<0) toBeDropped.push(k);
          }
          for (k in analyse.foundUnnecessary) {
            if (toBeDropped.indexOf(k)<0) toBeDropped.push(k);
          }
        }
        async.each(toBeDropped,function(index,eachofcb){
          if (options.verbose) console.log("Drop Index "+index);
          var dropIndex = "DROP INDEX if exists "+index+";";
          client.query(dropIndex,eachofcb);
        },function finalFunction(err){return cb(err);});
      },
      function indexcreation(cb) {
        if (options.verbose) console.log("Creating Indexes for "+pgObject.table);
        if (options.createIndex || options.updateIndex) {
          async.forEachOf(pgObject.indexDefinition,function(sql,index,eachofcb){
            var createIt = false;
            if (options.createIndex) createIt = true;
            if (analyse.foundNOK[index]) createIt = true;
            if (analyse.expected[index]) createIt = true;

            if (!createIt) return eachofcb();
            if (options.verbose) console.log("Create Index "+index);
            client.query(sql,eachofcb);
          },function finalFunction(err){return cb(err);});
        } else return cb();
      },
      function viewsdrop(cb) {
        if (options.dropView) {
          async.forEachOf(pgObject.viewDefinition,function(sql,view,eachofcb){
            var dropIndex = "DROP VIEW if exists "+view+";";
            if (options.verbose) console.log("Drop View "+view);
            client.query(dropIndex,eachofcb);
          },function finalFunction(err){return cb(err);});
        } else return cb();
      },
      function viewscreation(cb) {
        if (options.createView) {
          async.forEachOf(pgObject.viewDefinition,function(sql,view,eachofcb){
            if (options.verbose) console.log("Create View "+view);
            client.query(sql,eachofcb);
          },function finalFunction(err){return cb(err);});
        } else return cb();
      }
    ],function finalFunction(err){
      if (options.verbose) {
        if (err) console.dir(err);
      }
      pgdone();
      return callback(err);
    });
  });
}; 




