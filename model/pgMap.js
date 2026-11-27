
import db from "../model/db.js";
import { strict as assert } from "assert";
import config from "../config.js";
import util from "../util/util.js";

import { series, each, eachOf } from "async";
import _debug from "debug";
import { reportTableWrite } from "./tableWrites.js";
const debug = _debug("OSMBC:model:pgMap");
const sqldebug  = _debug("OSMBC:model:sql");


// operator prefixes of a find value, checked in this order: "!=x", "IN(a,b)",
// "<=x", ">=x", "GE:x", ">x", "<x"; a "%" in the value means LIKE
function parseOperator(value) {
  if (typeof (value) !== "string") return { op: "=", value: value };
  if (value.substring(0, 2) === "!=") return { op: "!=", value: value.substring(2, 9999) };
  if (value.substring(0, 2) === "IN") {
    const len = value.length;
    assert(value.substring(2, 3) === "(");
    assert(value.substring(len - 1, len) === ")");
    return { op: "in", value: value.substring(3, len - 1).split(",") };
  }
  if (value.substring(0, 2) === "<=") return { op: "<=", value: value.substring(2) };
  if (value.substring(0, 2) === ">=") return { op: ">=", value: value.substring(2) };
  if (value.substring(0, 3) === "GE:") return { op: ">=", value: value.substring(3, 999999) };
  if (value.substring(0, 1) === ">") return { op: ">", value: value.substring(1, 999999) };
  if (value.substring(0, 1) === "<") return { op: "<", value: value.substring(1, 999999) };
  if (value.indexOf("%") >= 0) return { op: "like", value: value };
  return { op: "=", value: value };
}

function isConditionList(value) {
  return Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === "string");
}

// SQL condition for one field and one find value; adds the parameter
function conditionFor(k, rawValue, parameters) {
  const { op, value } = parseOperator(rawValue);
  if (value === "") {
    if (op === "=") {
      const param = "$" + (parameters.length + 1);
      parameters.push(k);
      return "((data->" + param + ") is null or (data->>" + param + " = ''))";
    }
    if (op === "!=") {
      const param = "$" + (parameters.length + 1);
      parameters.push(k);
      return "((data->" + param + ") is not null) and ((data->>" + param + ") != '')";
    }
  }
  const param = "$" + (parameters.length + 1);
  parameters.push(value);
  if (op === "in") return "((data->'" + k + "') is not null) and ((data->>'" + k + "') = any (" + param + " ))";
  return "data->>'" + k + "'" + op + " " + param;
}

function generateQuery(table, obj, order) {
  debug("generateQuery %s", table);



  let whereClause = "";

  let parameters = [];
  let paramWhere = obj;
  if (obj && typeof (obj) === "object" && obj.sql) {
    paramWhere = obj.sql;
    parameters = obj.params;
  }
  if (typeof (paramWhere) === "string") {
    whereClause = " " + paramWhere;

    // if there is a select statement, expect and id and data, and take it.
    if (paramWhere.substring(0, 6) === "select") {
      debug(paramWhere);
      return [paramWhere, parameters];
    }
  } else {
    if (obj) {
      for (const k in obj) {
        // a list of operator strings puts several conditions on one field,
        // e.g. a time range: { timestamp: ["GE:2026-11-21", "<2026-11-22"] }
        const values = isConditionList(obj[k]) ? obj[k] : [obj[k]];
        for (const value of values) {
          const operation = conditionFor(k, value, parameters);
          if (whereClause === "") whereClause = " where " + operation;
          else whereClause += " and " + operation;
        }
      }
    }
  }
  let orderby = " order by id";
  if (order) {
    assert(order.column);
    const param = "$" + (parameters.length + 1);
    if (order.column !== "id") {
      parameters.push(order.column);
      orderby = " order by data->>" + param;
    }
    if (order.desc) {
      orderby += " desc";
    }
    orderby += " , id ";
    if (order.limit) {
      orderby += " LIMIT " + order.limit;
    }
  }

  const query = "select id,data from " + table + whereClause + orderby;
  return [query, parameters];
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
  // report every write attempt, also a failed one (see model/tableWrites.js)
  const reported = (cb) => (err, result) => {
    reportTableWrite(self.getTable());
    cb(err, result);
  };
  if (callback) {
    return _save(options, reported(callback));
  }
  return new Promise((resolve, reject) => {
    _save(options, reported((err, result) => err ? reject(err) : resolve(result)));
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

  db.query("delete from " + table + " where id = $1", [self.id], function(err, result) {
    reportTableWrite(table);
    callback(err, result);
  });
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
  const preparedQuery = generateQuery(table, obj, order);
  const sqlQuery = preparedQuery[0];
  const sqlParams = preparedQuery[1];

  sqldebug(sqlQuery);

  debug("Query: %s", sqlQuery);
  db.query(sqlQuery, sqlParams, convertResultFunction(module, callback));
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


  const preparedQuery = generateQuery(module.table, obj, order);
  const sqlQuery = preparedQuery[0];
  const sqlParams = preparedQuery[1];

  sqldebug(sqlQuery);


  db.query(sqlQuery + " limit 1", sqlParams, convertOneResultFunction(module, callback));
}


// --createTables / --createTable <name> create the table; --updateIndex
// creates it only if analyseIndexes found it missing (e.g. a dump from a
// version before the table existed).
function shouldCreateTable(pgObject, options, analyse) {
  if (options.createTables) return true;
  if (options.createTable && options.createTable === pgObject.table) return true;
  return !!(options.updateIndex && analyse.tableMissing);
}

// Adds the primary keys analyseIndexes found missing. Fails (and reports
// it) if the column holds duplicates or NULLs.
function addPrimaryKeys(missingPrimaryKey, options, callback) {
  eachOf(missingPrimaryKey, function(sql, name, eachofcb) {
    if (options.verbose) config.logger.info("Add Primary Key " + name);
    db.query(sql, eachofcb);
  }, callback);
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
        db.query(dropString, function(err) {
          reportTableWrite(pgObject.table);
          cb(err);
        });
      } else return cb();
    },
    function tablecreation(cb) {
      if (shouldCreateTable(pgObject, options, analyse)) {
        debug("tablecreation");
        if (options.verbose)config.logger.info("Create Table " + pgObject.table);
        if (options.verbose)config.logger.info("Query: " + pgObject.createString);
        db.query(pgObject.createString, cb);
      } else return cb();
    },
    function primarykeycreation(cb) {
      if (!options.updateIndex) return cb();
      addPrimaryKeys(analyse.missingPrimaryKey || {}, options, cb);
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
        // indexes unknown to OSMBC are kept ("keep existing")
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


/**
 * Reads the primary key a model's table is created with from its
 * `createString` (`CONSTRAINT <name> PRIMARY KEY (<column>)`), so the
 * create statement stays the only place that defines it.
 * @param {object} pgObject table definition of a model (`module.pg`)
 * @returns {{name: string, sql: string}|null} constraint name and the
 *   ALTER TABLE statement that adds it; null if the table has none
 */
function primaryKeyOf(pgObject) {
  const match = /CONSTRAINT\s+"?(\w+)"?\s+PRIMARY KEY\s*\(\s*"?(\w+)"?\s*\)/i.exec(pgObject.createString);
  if (!match) return null;
  const [, name, column] = match;
  return { name, sql: `ALTER TABLE "${pgObject.table}" ADD CONSTRAINT "${name}" PRIMARY KEY ("${column}")` };
}

/**
 * Compares the table, the indexes of `pgObject.indexDefinition` and the
 * primary key of its `createString` with the database. Indexes are read from pg_indexes
 * without constraint indexes; definitions count as equal when they differ
 * only in the schema prefix "public." or in white space. Used by
 * import/createdb.js (--verbose, --updateIndex) and at start to warn about
 * missing indexes.
 * @param {object} pgObject table definition of a model (`module.pg`)
 * @param {Function} callback (err, {foundOK, foundNOK, foundUnnecessary,
 *   expected, tableMissing, missingPrimaryKey}) — `expected` holds the
 *   missing indexes (all of them if `tableMissing`);
 *   every entry maps index name to its definition (database definition for
 *   foundUnnecessary). `missingPrimaryKey` maps the name of a primary key
 *   the table lacks to the statement that adds it (old databases had
 *   tables without one), else it is empty.
 */
function analyseIndexes(pgObject, callback) {
  debug("analyseIndexes %s", pgObject.table);
  const normalise = (sql) => sql.replace(/\bpublic\./g, "").replace(/\s+/g, " ").trim();
  const result = { foundOK: {}, foundNOK: {}, foundUnnecessary: {}, expected: {}, tableMissing: false, missingPrimaryKey: {} };
  for (const k in pgObject.indexDefinition) result.expected[k] = pgObject.indexDefinition[k];
  const sql = "select indexname, indexdef from pg_indexes where tablename = $1 and indexname not in (select conname from pg_constraint)";
  db.query(sql, [pgObject.table], function(err, res) {
    if (err) return callback(err);
    for (const row of res.rows) {
      const expected = result.expected[row.indexname];
      if (!expected) {
        result.foundUnnecessary[row.indexname] = row.indexdef;
        continue;
      }
      if (normalise(expected) === normalise(row.indexdef)) result.foundOK[row.indexname] = expected;
      else result.foundNOK[row.indexname] = expected;
      delete result.expected[row.indexname];
    }
    checkTable(pgObject, function(err, check) {
      if (err) return callback(err);
      result.tableMissing = check.tableMissing;
      result.missingPrimaryKey = check.missingPrimaryKey;
      return callback(null, result);
    });
  });
}

// {tableMissing, missingPrimaryKey}: whether the table doesn't exist, and
// {name: sql} if the existing table has no primary key (else {}). A
// missing table gets its key from createString.
function checkTable(pgObject, callback) {
  const sql = "select exists (select 1 from pg_class where relname = $1 and relkind = 'r') as table_exists, " +
    "exists (select 1 from pg_constraint c join pg_class t on t.oid = c.conrelid where t.relname = $1 and c.contype = 'p') as has_key";
  db.query(sql, [pgObject.table], function(err, res) {
    if (err) return callback(err);
    const { table_exists: tableExists, has_key: hasKey } = res.rows[0];
    const primaryKey = primaryKeyOf(pgObject);
    const missingPrimaryKey = (tableExists && !hasKey && primaryKey) ? { [primaryKey.name]: primaryKey.sql } : {};
    return callback(null, { tableMissing: !tableExists, missingPrimaryKey });
  });
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
  createTables: createTables,
  analyseIndexes: analyseIndexes,
  primaryKeyOf: primaryKeyOf,
  select: select
};

export default pgMap;
