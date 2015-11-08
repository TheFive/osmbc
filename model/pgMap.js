var pg     = require('pg');
var should = require('should');
var async  = require('async');
var debug  = require('debug')('OSMBC:model:pgMap')

var config = require('../config.js');
var util = require('../util.js');

function generateQuery(table,obj,order) {
  debug('generateQuery');
  var whereClause = "";

  if (typeof(obj)=='string') {
    whereClause = obj;
  } else {
    if (obj) {
      for (var k in obj) {
        var value = obj[k];
        var op = "=";
        if (typeof(value)=='string') {
          // escape the Apostroph
          value = value.replace("'","''");
          // check first operator in string
          if (value.substring(0,2)=="!=") {
            op = "!=";
            value = value.substring(2,9999);
          }           
        }

        var n = "data->>'"+k+"'"+op+"'"+value+"'"; 

        if (value=="") {
          if (op == "=") {
            n = "("+n+" or (data->'"+k+"') is null)";
          }
          if (op == "!=") {
            n = "("+n+" and (data->'"+k+"') is not null)";
          }
        }
        if (whereClause =="") whereClause = " where "+n;
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

  var table = self._meta.table;

  // first check, wether ID is known or not
  if (self.id == 0) {
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
      })
      query.on('end',function (result) {

        var endTime = new Date().getTime();
       // console.log("SQL: ["+ (endTime - startTime)/1000 +"] insert to "+ table);
        
        pgdone();
        return callback(null,self);
      })
    })
  } else {
    debug("Object will be updated, current version is %s",self.version);
    // we have to change the beer
    pg.connect(config.pgstring, function(err, client, pgdone) {
      if (err) {
        pgdone();
        return (callback(err));
      }
      async.series([
        function(cb) {
          var versionsEqual = false;

          var query = client.query("select (data->>'version')::int as version from "+table+" where id = $1",[self.id]);
            var startTime = new Date().getTime();
            query.on('row',function(row) {
            debug('Version in Database %s',row.version)
            if (row.version==null) {
              // No Data in Database, so no conflict.
              versionsEqual = true;
            }
            else if (row.version == self.version) {
              debug('No Error');
              versionsEqual = true;
            }
          })
          query.on('end',function(result){
            var err = null;
            var endTime = new Date().getTime();
         //   console.log("SQL: ["+ (endTime - startTime)/1000 +"]("+table+" versionCheck");
            if (!versionsEqual) {
              debug('send error')
              err = new Error("Version Number differs");
            }
            return cb(err);
          })
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
          query.on('end',function (result) {
            pgdone();
            return callback(null,result);
          })
        }
      )
    })
  }
}

module.exports.remove = function(callback) {
  debug("remove");
  var self = this;
  var table = self._meta.table;
  // first check, wether ID is known or not
  if (self.id == 0) {
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
    })
  })
}

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
      console.log("Connection Error")
      console.dir(err);
      pgdone();
      return (callback(err));
    }
    var table = module.table;
    var sqlQuery = generateQuery(table,obj,order);

    var result = [];

    var startTime = new Date().getTime();

    var query = client.query(sqlQuery);
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
    query.on('end',function findEndFunction(pgresult) {   
      debug('findEndFunction');
      var endTime = new Date().getTime();
     // console.log("SQL: ["+ (endTime - startTime)/1000 +"]("+result.length+" rows)"+ sqlQuery);
      pgdone();
      callback(null,result);
    });
  })
}



module.exports.fullTextSearch = function fullTextSearch(module,search,order,callback) {
  debug("fullTextSearch");
  should.exist(module);
  should.exist(module.create);
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
    var table = module.table;

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
      var r = module.create();
      for (var k in row.data) {
        r[k]=row.data[k];
      }
      r.id = row.id;
      result.push(r);
    })
    query.on('end',function (pgresult) {    
      pgdone();
      var endTime = new Date().getTime();
     // console.log("SQL: ["+ (endTime - startTime)/1000 +"]("+result.length+" rows)"+ sqlQuery);
      callback(null,result);
    })
    query.on('error',function (err) {    
      pgdone();
      callback(err);
    })
  })
}


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
    })
    query.on('end',function (pgresult) {    
      pgdone();
      var endTime = new Date().getTime();
     // console.log("SQL: ["+ (endTime - startTime)/1000 +"] Select by id from "+ table);
      callback(null,result);
    })
  })
}

module.exports.findOne = function findOne(module,obj,order,callback) {
  debug("findOne");
  var table = module.table;
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
    })
    query.on('end',function (pgresult) {
      pgdone();
      var endTime = new Date().getTime();
     // console.log("SQL: ["+ (endTime - startTime)/1000 +"]"+ sqlQuery);
      callback(null,result);      
    })
  })
}


exports.createTable = function(table,createString,createView,cb) {
  debug('createTable');
  should(typeof(table)).equal('string');
  should(typeof(createString)).equal('string');
  should(typeof(createView)).equal('string');

  pg.connect(config.pgstring,function(err,client,pgdone) {
    if (err) {
      cb(err);
      pgdone();
      return;
    }
    client.query(createString,function(err) {
      if (err) {
        pgdone();
        cb(err);
        return;
      }
      debug('%s Table Created',table);
      if (typeof(createView)!='') {
        client.query(createView,function(err){
          debug('%s Index Created',table);
          cb(err);
          pgdone();
        })
      } else {
        // No Index to be defined, close Function correct
        cb(err);
        pgdone();
      }
    })
  })
} 

exports.dropTable = function dropTable(table,cb) {
  debug('dropTable');

  pg.connect(config.pgstring,function(err,client,pgdone) {
    debug('exports.dropTable->connected');
    if (err) {
      cb(err);
      pgdone();
      return;
    }
    var dropString = "DROP TABLE IF EXISTS "+table+ " CASCADE";
  
    var query = client.query(dropString);
    query.on('error',function(err){
      debug("%s Table Dropped",table);
      cb(err);
      pgdone();
    });
    query.on('end',function(){cb(null);pgdone();})
  })
}


