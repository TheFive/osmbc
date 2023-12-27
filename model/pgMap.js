
import db from "../model/db.js";
import { strict as assert } from "assert";
import config from "../config.js";
import util from "../util/util.js";

import { series, each, eachOf } from "async";
import _debug from "debug";
const debug = _debug("OSMBC:model:pgMap");
const sqldebug  = _debug("OSMBC:model:sql");


function generateQuery(table, obj, order) {
  debug("generateQuery %s", table);

  let whereClause = "";

  let paramWhere = obj;
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
      for (const k in obj) {
        let value = obj[k];
        let op = "=";
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

        let n = "data->>'" + k + "'" + op + "'" + value + "'";
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
  let orderby = " order by id";
  if (order) {
    assert(order.column);
    if (order.column !== "id") orderby = " order by data->>'" + order.column + "'";
    if (order.desc) {
      orderby += " desc";
    }
    orderby += " , id ";
    if (order.limit) {
      orderby += " LIMIT " + order.limit;
    }
  }
  const query = "select id,data from " + table + whereClause + orderby;
  sqldebug(query);
  return query;
}


function save(options, callback) {
  debug("save");
  if (typeof options === "function") {
    callback = options;
    options = null;
  }
  const self = this;
  function _save(options, callback) {
    debug("_save");

    const table = self.getTable();

    // store blog Reference not to loose it.
    const blog = self._blog;

    // clean property's with "_"
    for (const k in self) {
      if (k.substring(0, 1) === "_") delete self[k];
    }
    for (const k in self) {
      if (k.substring(0, 1) === "#") delete self[k];
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
      const sqlquery = "insert into " + table + "(data) values ($1) returning id";
      sqldebug("Query %s", sqlquery);
      db.query(sqlquery, [self], function(err, result) {
        if (err) return callback(err);
        assert(result.rows);
        self.id = result.rows[0].id;
        return callback(null, self);
      });
    } else {
      debug("Object will be updated, current version is %s", self.version);
      series([
        function(cb) {
          debug("Check version of object");
          let versionsEqual = false;
          const startTime = new Date().getTime();

          db.query("select (data->>'version')::int as version from " + table + " where id = $1",
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
              const endTime = new Date().getTime();
              sqldebug("SQL get Version: [" + (endTime - startTime) / 1000 + "](" + table + " versionCheck " + versionsEqual + ")");
              if (!versionsEqual && (!options || !options.onlyIfVersionEqual)) {
                err = new Error("Version Number Differs");
                return cb(err, "save");
              }
              if (!versionsEqual && (options && options.onlyIfVersionEqual)) {
                return cb(null, "do-not-save");
              }
              return cb();
            });
        }
      ],
      function finalFunction(err, result) {
        debug("final Function save");
        if (err) {
          return callback(err);
        }
        if (result === "do-not-save") return callback();

        if (!options || !options.noVersionIncrease) {
          self.version += 1;
        }
        db.query("update " + table + " set data = $2 where id = $1", [self.id, self], function(err) {
          if (typeof blog !== "undefined") self._blog = blog;
          return callback(err, self);
        });
      }
      );
    }
  }
  if (callback) {
    return _save(options, callback);
  }
  return new Promise((resolve, reject) => {
    _save(options, (err, result) => err ? reject(err) : resolve(result));
  });
}

function remove(callback) {
  debug("remove");
  const self = this;
  const table = self.getTable();
  // first check, wether ID is known or not
  if (self.id === 0) {
    // we have to create the beer
    callback(new Error("ID is zero, transient object not deleted."));
    return;
  }
  // we have to change the beer
  debug("call delete");

  db.query("delete from " + table + " where id = $1", [self.id], callback);
}

function convertResultFunction(module, callback) {
  debug("convertResultFunction");
  assert(callback);
  return function crs(err, pgResult) {
    debug("crs");
    const result = [];
    if (err) return callback(err);
    pgResult.rows.forEach(function(row) {
      const r = module.create();
      for (const k in row.data) {
        r[k] = row.data[k];
      }
      r.id = row.id;
      if (module.migrateData) module.migrateData(r);
      result.push(r);
    });
    return callback(null, result);
  };
}

function convertOneResultFunction(module, callback) {
  assert(callback);
  return function crs(err, pgResult) {
    if (err) return callback(err);
    if (pgResult.rows.length === 0) return callback(null, null);
    const row = pgResult.rows[0];
    const r = module.create();
    for (const k in row.data) {
      r[k] = row.data[k];
    }
    r.id = row.id;
    return callback(null, r);
  };
}

function find(module, obj, order, callback) {
  debug("find %s", module.table);
  if (typeof (obj) === "function") {
    callback = obj;
    obj = null;
    order = null;
  } else if (typeof (order) === "function") {
    callback = order;
    order = null;
  } else if (typeof (obj) === "function") {
    order = null;
    callback = obj;
    obj = null;
  }

  assert(typeof (callback) === "function");
  debug("Connecting to DB");
  const table = module.table;
  const sqlQuery = generateQuery(table, obj, order);
  debug("Query: %s", sqlQuery);

  if (obj && obj.params) {
    db.query(sqlQuery, obj.params, convertResultFunction(module, callback));
  } else {
    db.query(sqlQuery, undefined, convertResultFunction(module, callback));
  }
}



function fullTextSearch(module, search, order, callback) {
  debug("fullTextSearch");
  assert(module.table);
  assert(module.create);
  if (typeof search !== "string") search = "Undefined Search";
  if (typeof (order) === "function") {
    callback = order;
    order = null;
  }


  let orderBy = "";

  if (order) {
    assert(order.column);
    orderBy = " order by data->>'" + order.column + "'";
    if (order.desc) {
      orderBy += " desc";
    }
  }
  let germanVector = "@@ plainto_tsquery('german', $1)";
  let englishVector = "@@ plainto_tsquery('english', $1)";

  if (util.isURL(search)) {
    const http1Url = search;
    if (search.substring(search.length - 1, search.length) === "/") {
      search = search.substring(0, search.length - 1);
    }
    let http2Url;
    if (search.substring(0, 5) === "http:") {
      http2Url = "https:" + search.substring(5, 9999);
    }
    if (search.substring(0, 6) === "https:") {
      http2Url = "http:" + search.substring(6, 9999);
    }
    const h1 = util.toPGString(http1Url);
    const h2 = util.toPGString(http2Url);

    search = `'${h1}' | '(${h1})' | '${h1}/' | '(${h1}/)'`;
    if (http2Url) search = search + `| '${h2}' | '(${h2})' | '${h2}/' | '(${h2}/)'`;

    germanVector = "@@ to_tsquery('german', $1)";
    englishVector = "@@ to_tsquery('english', $1)";
  }

  const sqlQuery =  "select id, data from article \
                        where to_tsvector('german', coalesce(data->>'title','')::text || ' '|| \
                                                    coalesce(data->>'collection','')  || ' '|| \
                                                    coalesce(data->>'markdownDE','')   ) " + germanVector + " \
                          or to_tsvector('english',  coalesce(data->>'collection','')  || ' '|| \
                                                    coalesce(data->>'markdownEN','')   ) " + englishVector +
                      orderBy;
  db.query(sqlQuery, [search], convertResultFunction(module, callback));
}


function findById(id, module, callback) {
  function _findById(id, module, callback) {
    debug("findById %s", id);
    const table = module.table;

    let idToSearch = 0;

    if (id % 1 === 0) idToSearch = id;
    db.query("select id,data from " + table + " where id = $1", [idToSearch], convertOneResultFunction(module, callback));
  }
  if (callback) {
    return _findById(id, module, callback);
  }
  return new Promise((resolve, reject) => {
    _findById(id, module, (err, result) => err ? reject(err) : resolve(result));
  });
}

function findOne(module, obj, order, callback) {
  debug("findOne");
  if (typeof (obj) === "function") {
    callback = obj;
    obj = null;
  }
  if (typeof (order) === "function") {
    callback = order;
    order = null;
  }


  const sqlQuery = generateQuery(module.table, obj, order);


  db.query(sqlQuery + " limit 1", convertOneResultFunction(module, callback));
}


function createTables(pgObject, options, analyse, callback) {
  debug("pgMap.createTables %s %s", pgObject.table, JSON.stringify(options));
  assert(typeof (options) === "object");
  if (typeof (analyse) === "function") {
    callback = analyse;
    analyse = { foundNOK: {}, expected: {} };
  }
  assert(typeof (analyse) === "object");

  series([
    function tabledrop(cb) {
      if (options.dropTables || (options.dropTable && options.dropTable === pgObject.table)) {
        debug("tabledrop");
        if (options.verbose)config.logger.info("Drop Table " + pgObject.table);
        const dropString = "DROP TABLE IF EXISTS " + pgObject.table + " CASCADE";
        db.query(dropString, cb);
      } else return cb();
    },
    function tablecreation(cb) {
      if (options.createTables || (options.createTable && options.createTable === pgObject.table)) {
        debug("tablecreation");
        if (options.verbose)config.logger.info("Create Table " + pgObject.table);
        if (options.verbose)config.logger.info("Query: " + pgObject.createString);
        db.query(pgObject.createString, cb);
      } else return cb();
    },
    function indexdrop(cb) {
      const toBeDropped = [];
      let k;
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
      each(toBeDropped, function ftoBeDropped(index, eachofcb) {
        debug("ftoBeDropped");
        if (options.verbose)config.logger.info("Drop Index " + index);
        const dropIndex = "DROP INDEX if exists " + index + ";";
        db.query(dropIndex, eachofcb);
      }, function finalFunction(err) {
        debug("finalFunction");
        return cb(err);
      });
    },
    function indexcreation(cb) {
      if (options.createIndex || options.updateIndex) {
        debug("indexcreation");
        if (options.verbose)config.logger.info("Creating Indexes for " + pgObject.table);
        eachOf(pgObject.indexDefinition, function(sql, index, eachofcb) {
          let createIt = false;
          if (options.createIndex) createIt = true;
          if (analyse.foundNOK[index]) createIt = true;
          if (analyse.expected[index]) createIt = true;

          if (!createIt) return eachofcb();
          if (options.verbose)config.logger.info("Create Index " + index);
          db.query(sql, eachofcb);
        }, function finalFunction(err) { return cb(err); });
      } else return cb();
    },
    function viewsdrop(cb) {
      debug("viewsdrop");
      if (options.dropView) {
        eachOf(pgObject.viewDefinition, function(sql, view, eachofcb) {
          const dropIndex = "DROP VIEW if exists " + view + ";";
          if (options.verbose)config.logger.info("Drop View " + view);
          db.query(dropIndex, eachofcb);
        }, function finalFunction(err) { return cb(err); });
      } else return cb();
    },
    function viewscreation(cb) {
      debug("viewscreation");
      if (options.createView) {
        eachOf(pgObject.viewDefinition, function(sql, view, eachofcb) {
          if (options.verbose)config.logger.info("Create View " + view);
          db.query(sql, eachofcb);
        }, function finalFunction(err) { return cb(err); });
      } else return cb();
    }
  ], function finalFunction(err) {
    if (options.verbose) {
      if (err)config.logger.error(err);
    }
    return callback(err);
  });
}


function count(sql, values, callback) {
  debug("count");
  if (typeof values === "function") {
    callback = values;
    values = undefined;
  }
  let result;

  function resultFunction(err, pgResult) {
    if (err) return callback(err);
    result = {};
    for (const k in pgResult.rows[0]) {
      result[k] = pgResult.rows[0][k];
    }
    callback(null, result);
  }

  if (values) {
    db.query(sql, values, resultFunction);
  } else {
    db.query(sql, resultFunction);
  }
}

function select(sql, data, callback) {
  debug("select");
  if (typeof data === "function") {
    callback = data;
    data = undefined;
  }
  const result = [];
  db.query(sql, data, function (err, pgResult) {
    if (err) return callback(err);
    for (let i = 0; i < pgResult.rows.length; i++) {
      const item = {};
      for (const k in pgResult.rows[i]) {
        item[k] = pgResult.rows[i][k];
      }
      result.push(item);
    }
    callback(null, result);
  });
}


const pgMap = {
  save: save,
  remove: remove,
  find: find,
  fullTextSearch: fullTextSearch,
  findById: findById,
  findOne: findOne,
  count: count,
  createTables: createTables,
  select: select
};

export default pgMap;
