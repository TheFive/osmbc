"use strict";

var pool     = require("../model/db.js");
var should = require("should");
var async  = require("async");
var debug  = require("debug")("OSMBC:model:pgMap");
var sqldebug  = require("debug")("OSMBC:model:sql");

var config = require("../config.js");
var logger = require("../config.js").logger;
var util = require("../util.js");


function generateQuery(table, obj, order) {
  debug("generateQuery");

  var whereClause = "";

  var paramWhere = obj;
  if (obj && typeof (obj) === "object" && obj.sql) paramWhere = obj.sql;
  if (typeof (paramWhere) === "string") {
    whereClause = " " + paramWhere;

    // if there is a select statement, expect and id and data, and take it.
    if (paramWhere.substring(0, 6) === "select") {
      debug(paramWhere);
      return paramWhere;
    }
  } else {
    if (obj) {
      for (var k in obj) {
        var value = obj[k];
        var op = "=";
        if (typeof (value) === "string") {
          // check first operator in string
          if (value.substring(0, 2) === "!=") {
            op = "!=";
            value = value.substring(2, 9999);
          }
          if (value.substring(0, 2) === "IN") {
            op = "in";
            value = value.substring(2, 999999);
          }
          if (value.substring(0, 2) === "<=") {
            op = "<=";
            value = value.substring(2, 999999);
          }
          if (value.substring(0, 2) === ">=") {
            op = ">=";
            value = value.substring(2, 999999);
          }
          if (value.substring(0, 3) === "GE:") {
            op = ">=";
            value = value.substring(3, 999999);
          }
          if (value.substring(0, 1) === ">") {
            op = ">";
            value = value.substring(1, 999999);
          }
          if (value.substring(0, 1) === "<") {
            op = "<";
            value = value.substring(1, 999999);
          }
          if (value.indexOf("%") >= 0) op = "like";
          if (op !== "in") {
            // escape the Apostroph
            value = value.replace("'", "''");
          }
        }

        var n = "data->>'" + k + "'" + op + "'" + value + "'";
        if (op === "in") {
          n = "data->>'" + k + "'" + op + " " + value;
          n = "(" + n + " and (data->'" + k + "') is not null)";
        }

        if (value === "") {
          if (op === "=") {
            n = "(" + n + " or (data->'" + k + "') is null)";
          }
          if (op === "!=") {
            n = "(" + n + " and (data->'" + k + "') is not null)";
          }
        }
        if (whereClause === "") whereClause = " where " + n;
        else whereClause += " and " + n;
      }
    }
  }
  var orderby = " order by id";
  if (order) {
    should.exist(order.column);
    if (order.column !== "id") orderby = " order by data->>'" + order.column + "'";
    if (order.desc) {
      orderby += " desc";
    }
    orderby += " , id ";
    if (order.limit) {
      orderby += " LIMIT " + order.limit;
    }
  }
  var query = "select id,data from " + table + whereClause + orderby;
  sqldebug(query);
  return query;
}


module.exports.save = function(options, callback) {
  debug("save");
  if (typeof options === "function") {
    callback = options;
    options = null;
  }
  let self = this;
  var table = self.getTable();

  // store blog Reference not to loose it.
  let blog = self._blog;

  // clean property's with "_"
  for (var k in self) {
    if (k.substring(0, 1) === "_") delete self[k];
  }
  // id must be >= 0;
  if (self.id === -1) {
    return callback(new Error("Virtual Object can not be saved"));
  }

  // first check, wether ID is known or not
  if (self.id === 0) {
    // we have to create the object
    debug("Object has to be created");

    // store first version in database
    self.version = 1;
    var sqlquery = "insert into " + table + "(data) values ($1) returning id";
    sqldebug("Query %s", sqlquery);
    pool.query(sqlquery, [self], function(err, result) {
      if (err) return callback(err);
      should.exist(result.rows);
      self.id = result.rows[0].id;
      return callback(null, self);
    });
  } else {
    debug("Object will be updated, current version is %s", self.version);
    async.series([
      function(cb) {
        debug("Check version of object");
        var versionsEqual = false;
        var startTime = new Date().getTime();

        pool.query("select (data->>'version')::int as version from " + table + " where id = $1",
          [self.id], function(err, result) {
            if (err) return cb(err);
            let row = null;
            if (result && result.rows) row = result.rows[0];
            if (row.version === null) {
              // No Data in Database, so no conflict.
              versionsEqual = true;
            } else if (row.version === self.version) {
              debug("No Error");
              versionsEqual = true;
            }
            debug("end");
            err = null;
            var endTime = new Date().getTime();
            sqldebug("SQL get Version: [" + (endTime - startTime) / 1000 + "](" + table + " versionCheck " + versionsEqual + ")");
            if (!versionsEqual) {
              debug("send error");
              err = new Error("Version Number Differs");
            }
            return cb(err);
          });
      }
    ],
    function finalFunction(err) {
      debug("final Function save");
      if (err) {
        debug("Forward Error");
        debug(err);

        return callback(err);
      }
      if (!options || !options.noVersionIncrease) self.version += 1;
      pool.query("update " + table + " set data = $2 where id = $1", [self.id, self], function(err) {
        if (typeof blog !== "undefined") self._blog = blog;
        return callback(err, self);
      });
    }
    );
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
  debug("call delete");

  pool.query("delete from " + table + " where id = $1", [self.id], callback);
};

function convertResultFunction(module, callback) {
  should.exist(callback);
  return function crs(err, pgResult) {
    let result = [];
    if (err) return callback(err);
    pgResult.rows.forEach(function(row) {
      var r = module.create();
      for (var k in row.data) {
        r[k] = row.data[k];
      }
      r.id = row.id;
      result.push(r);
    });
    return callback(null, result);
  };
}

function convertOneResultFunction(module, callback) {
  should.exist(callback);
  return function crs(err, pgResult) {
    if (err) return callback(err);
    if (pgResult.rows.length === 0) return callback(null, null);
    let row = pgResult.rows[0];
    var r = module.create();
    for (var k in row.data) {
      r[k] = row.data[k];
    }
    r.id = row.id;
    return callback(null, r);
  };
}

module.exports.find = function find(module, obj, order, callback) {
  debug("find");
  if (typeof (obj) === "function") {
    callback = obj;
    obj = null;
    order = null;
  } else if (typeof (order) === "function") {
    callback = order;
    order = null;
  } else {
    should(typeof (order)).equal("object");
  }
  should(typeof (callback)).equal("function");

  debug("Connecting to DB" + config.pgstring);

  var table = module.table;
  var sqlQuery = generateQuery(table, obj, order);



  if (obj && obj.params) {
    pool.query(sqlQuery, obj.params, convertResultFunction(module, callback));
  } else {
    pool.query(sqlQuery, undefined, convertResultFunction(module, callback));
  }
};



module.exports.fullTextSearch = function fullTextSearch(module, search, order, callback) {
  debug("fullTextSearch");
  should.exist(module.table);
  should.exist(module.create);
  should(typeof (search)).eql("string");
  if (typeof (order) === "function") {
    callback = order;
    order = null;
  }


  var orderBy = "";

  if (order) {
    should.exist(order.column);
    orderBy = " order by data->>'" + order.column + "'";
    if (order.desc) {
      orderBy += " desc";
    }
  }
  var germanVector = "@@ plainto_tsquery('german', '" + search + "')";
  var englishVector = "@@ plainto_tsquery('english', '" + search + "')";

  if (util.isURL(search)) {
    var http1Url = search;
    var http2Url;
    if (search.substring(0, 5) === "http:") {
      http2Url = "https:" + search.substring(5, 9999);
    }
    if (search.substring(0, 6) === "https:") {
      http2Url = "http:" + search.substring(6, 9999);
    }
    search = "''" + util.toPGString(http1Url, 2) + "'' | ''(" + util.toPGString(http1Url, 2) + ")'' ";
    if (http2Url) search += "| ''" + util.toPGString(http2Url, 2) + "'' | ''(" + util.toPGString(http1Url, 2) + ")'' ";
    germanVector = "@@ to_tsquery('german', '" + search + "')";
    englishVector = "@@ to_tsquery('english', '" + search + "')";
  }

  var sqlQuery =  "select id, data from article \
                        where to_tsvector('german', coalesce(data->>'title','')::text || ' '|| \
                                                    coalesce(data->>'collection','')  || ' '|| \
                                                    coalesce(data->>'markdownDE','')   ) " + germanVector + " \
                          or to_tsvector('english',  coalesce(data->>'collection','')  || ' '|| \
                                                    coalesce(data->>'markdownEN','')   ) " + englishVector +
                      orderBy;

  pool.query(sqlQuery, convertResultFunction(module, callback));
};


module.exports.findById = function findById(id, module, callback) {
  debug("findById %s", id);
  var table = module.table;

  var idToSearch = 0;

  if (id % 1 === 0) idToSearch = id;



  pool.query("select id,data from " + table + " where id = $1", [idToSearch], convertOneResultFunction(module, callback));
};

module.exports.findOne = function findOne(module, obj, order, callback) {
  debug("findOne");
  if (typeof (obj) === "function") {
    callback = obj;
    obj = null;
  }
  if (typeof (order) === "function") {
    callback = order;
    order = null;
  }


  var sqlQuery = generateQuery(module.table, obj, order);


  pool.query(sqlQuery + " limit 1", convertOneResultFunction(module, callback));
};


exports.createTables = function(pgObject, options, analyse, callback) {
  debug("pgMap.createTables %s %s", pgObject.table, JSON.stringify(options));
  should(typeof (options)).equal("object");
  if (typeof (analyse) === "function") {
    callback = analyse;
    analyse = {foundNOK: {}, expected: {}};
  }
  should(typeof (analyse)).equal("object");

  async.series([
    function tabledrop(cb) {
      if (options.dropTables || (options.dropTable && options.dropTable === pgObject.table)) {
        debug("tabledrop");
        if (options.verbose) logger.info("Drop Table " + pgObject.table);
        var dropString = "DROP TABLE IF EXISTS " + pgObject.table + " CASCADE";
        pool.query(dropString, cb);
      } else return cb();
    },
    function tablecreation(cb) {
      if (options.createTables || (options.createTable && options.createTable === pgObject.table)) {
        debug("tablecreation");
        if (options.verbose) logger.info("Create Table " + pgObject.table);
        if (options.verbose) logger.info("Query: " + pgObject.createString);
        pool.query(pgObject.createString, cb);
      } else return cb();
    },
    function indexdrop(cb) {
      var toBeDropped = [];
      var k;
      if (options.dropIndex) {
        debug("indexdrop");
        for (k in pgObject.indexDefinition) {
          toBeDropped.push(k);
        }
      }
      if (options.updateIndex) {
        debug("updateindex");
        for (k in analyse.foundNOK) {
          if (toBeDropped.indexOf(k) < 0) toBeDropped.push(k);
        }
        for (k in analyse.foundUnnecessary) {
          if (toBeDropped.indexOf(k) < 0) toBeDropped.push(k);
        }
      }
      async.each(toBeDropped, function ftoBeDropped(index, eachofcb) {
        debug("ftoBeDropped");
        if (options.verbose) logger.info("Drop Index " + index);
        var dropIndex = "DROP INDEX if exists " + index + ";";
        pool.query(dropIndex, eachofcb);
      }, function finalFunction(err) {
        debug("finalFunction");
        return cb(err);
      });
    },
    function indexcreation(cb) {
      if (options.createIndex || options.updateIndex) {
        debug("indexcreation");
        if (options.verbose) logger.info("Creating Indexes for " + pgObject.table);
        async.forEachOf(pgObject.indexDefinition, function(sql, index, eachofcb) {
          var createIt = false;
          if (options.createIndex) createIt = true;
          if (analyse.foundNOK[index]) createIt = true;
          if (analyse.expected[index]) createIt = true;

          if (!createIt) return eachofcb();
          if (options.verbose) logger.info("Create Index " + index);
          pool.query(sql, eachofcb);
        }, function finalFunction(err) { return cb(err); });
      } else return cb();
    },
    function viewsdrop(cb) {
      debug("viewsdrop");
      if (options.dropView) {
        async.forEachOf(pgObject.viewDefinition, function(sql, view, eachofcb) {
          var dropIndex = "DROP VIEW if exists " + view + ";";
          if (options.verbose) logger.info("Drop View " + view);
          pool.query(dropIndex, eachofcb);
        }, function finalFunction(err) { return cb(err); });
      } else return cb();
    },
    function viewscreation(cb) {
      debug("viewscreation");
      if (options.createView) {
        async.forEachOf(pgObject.viewDefinition, function(sql, view, eachofcb) {
          if (options.verbose) logger.info("Create View " + view);
          pool.query(sql, eachofcb);
        }, function finalFunction(err) { return cb(err); });
      } else return cb();
    }
  ], function finalFunction(err) {
    if (options.verbose) {
      if (err) logger.error(err);
    }
    return callback(err);
  });
};


module.exports.count = function count(sql, callback) {
  debug("count");
  var result;
  pool.query(sql, function (err, pgResult) {
    if (err) return callback(err);
    result = {};
    for (var k in pgResult.rows[0]) {
      result[k] = pgResult.rows[0][k];
    }
    callback(null, result);
  });
};

module.exports.select = function select(sql, callback) {
  debug("select");
  var result = [];
  pool.query(sql, function (err, pgResult) {
    if (err) return callback(err);
    for (var i = 0; i < pgResult.rows.length; i++) {
      let item = {};
      for (var k in pgResult.rows[i]) {
        item[k] = pgResult.rows[i][k];
      }
      result.push(item);
    }
    callback(null, result);
  });
};



