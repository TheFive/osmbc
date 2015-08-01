var pg = require('pg');
var config = require('../config.js');
var debug = require('debug')('OSMBC:pgMap')



 
module.exports.save = function(callback) {
	debug("save");
  var self = this;

  console.dir(self);

  var table = self._meta.table;

	// first check, wether ID is known or not
	if (self.id == 0) {
		// we have to create the beer
		console.log(config.pgstring);
    pg.connect(config.pgstring, function(err, client, pgdone) {
    	if (err) {
    		pgdone();
    		return (callback(err));
    	}
    	var query = client.query("insert into "+table+"(data) values ($1) returning id", [self]);
    	query.on('row',function(row) {
    		self.id = row.id;
    	})
    	query.on('end',function (result) {
    		
    		pgdone();
    		callback(null,result);
    	})
    })
	} else {
		// we have to change the beer
    pg.connect(config.pgstring, function(err, client, pgdone) {
    	if (err) {
    		pgdone();
    		return (callback(err));
    	}


    	var query = client.query("update "+table+" set data = $2 where id = $1", [self.id,self]);
    	/*query.on('row',function(row) {
    		results.push(row);
    	})*/
    	query.on('end',function (result) {
     		pgdone();
    		callback(null,result);
    	})
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
		console.log(table+ " not stored, so it is not deleted");
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

    var whereClause = "";
    var objects = [];
    var i =1;
    for (var k in obj) {
      var n = "data->>'"+k+"'= $"+i; 
      i++;
      objects.push(obj[k]);
      if (whereClause =="") whereClause = " where "+n;
      else whereClaues += " and "+n;
    }
    var orderby = "";
    if (order) {
      orderby = " order by data->>'"+order.column+"'";
      if (order.desc) {
        orderby += " desc";
      }
    }
    var result = [];

    var query = client.query("select id,data from "+table+whereClause+orderby, objects);
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

module.exports.findOne = function findOne(obj,module,callback) {
	debug("findOne");
	var table = module.table;

  pg.connect(config.pgstring, function(err, client, pgdone) {
  	if (err) {

  		pgdone();
  		return (callback(err));
  	}
  	var result = null;

  	var whereClause = "";
  	var objects = [];
    var i =1;
  	for (var k in obj) {
      var n = "data->>'"+k+"'= $"+i; 
      i++;
      objects.push(obj[k]);
      if (whereClause =="") whereClause = " where "+n;
      else whereClaues += " and "+n;
  	}
  	console.log("select id,data from "+table+whereClause);
  	console.dir(objects);

  	var query = client.query("select id,data from "+table+whereClause, objects);
  	query.on('row',function(row) {
  		result = module.create();
      for (var k in row.data) {
      	result[k]=row.data[k];
      }
      result.id = row.id;
  	})
  	query.on('end',function (result) {
  		
  		pgdone();
  		console.log("Found");
  		console.dir(result);
  		callback(null,result);
  	})
  })
}



