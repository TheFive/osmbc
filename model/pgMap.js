var pg = require('pg');
var should = require('should');
var async  = require('async');
var debug = require('debug')('OSMBC:pgMap')

var config = require('../config.js');

function generateQuery(table,obj,order) {
  debug(generateQuery);
  var whereClause = "";

  if (typeof(obj)=='string') {
    whereClause = obj;
  } else {
    if (obj) {
      for (var k in obj) {
        var n = "data->>'"+k+"'= '"+obj[k]+"'"; 

        if (obj[k]=="") {
          n = "("+n+" or (data->'"+k+"') is null)";
        }
        if (whereClause =="") whereClause = " where "+n;
        else whereClause += " and "+n;
      }    
    }
  }
  var orderby = " order by id";
  if (order) {
    if (order) {
      orderby = " order by data->>'"+order.column+"'";
      if (order.desc) {
        orderby += " desc";
      }
      orderby += " , id ";
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
      var query = client.query(sqlquery, [self]);
      query.on('row',function(row) {
        debug("Created Row ID %s",row.id);
        self.id = row.id;
      })
      query.on('end',function (result) {
        
        pgdone();
        callback(null,self);
      })
    })
  } else {
    debug("Object will be updated");
    // we have to change the beer
    pg.connect(config.pgstring, function(err, client, pgdone) {
      if (err) {
        pgdone();
        return (callback(err));
      }
      async.series([
        function(callback) {
          var versionsEqual = false;
          var query = client.query("select (data->>'version')::int as version from "+table+" where id = $1",[self.id]);
          query.on('row',function(row) {
            if (row.version == self.version) {
              versionsEqual = true;
            }
          })
          query.on('end',function(result){
            var err = null;
            if (!versionsEqual) err = new Error("Version Nummber differs");
            callback(err);
          })
        }
        ],
        function(err) {
          if (err) {
            pgdone();
            callback(err);
          }
          self.version += 1;
          var query = client.query("update "+table+" set data = $2 where id = $1", [self.id,self]);
          /*query.on('row',function(row) {
            results.push(row);
          })*/
          query.on('end',function (result) {
            pgdone();
            callback(null,result);
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
  }
  if (typeof(order) == 'function') {
    callback = order;
    order = null;
  }
  pg.connect(config.pgstring, function(err, client, pgdone) {
    if (err) {
      console.log("Connection Error")

      pgdone();
      return (callback(err));
    }
    var table = module.table;
    sqlQuery = generateQuery(table,obj,order);

    var result = [];

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
      callback(null,result);
    })
  })
}



module.exports.findById = function findById(id,module,callback) {
  debug("findById %s",id);
  var table = module.table;

  pg.connect(config.pgstring, function(err, client, pgdone) {
    if (err) {
      console.log("Connection Error")

      pgdone();
      return (callback(err));
    }
    var result = {};
    var idToSearch = 0;

    if (id % 1 === 0) idToSearch = id;



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


