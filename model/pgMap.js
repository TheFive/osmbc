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
    	query.on('end',function (err) {
    		
    		pgdone();
    		callback(err);
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
    	query.on('end',function (err) {
     		pgdone();
    		callback(err);
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
  	query.on('end',function (err) {
  		debug("end called");
  		
  		pgdone();
  		callback(err);
  	})
	})
}

module.exports.find = function find(module,callback) {
	debug("find");
	var table = module.table;
  pg.connect(config.pgstring, function(err, client, pgdone) {
  	if (err) {

  		pgdone();
  		return (callback(err));
  	}
  	var result = [];

  	var query = client.query("select id,data from "+table);
  	query.on('row',function(row) {
  		object = module.create();
      for (var k in row.data) {
      	object[k]=row.data[k];
      }
      object.id=row.id;
      result.push(object);
  	})
  	query.on('end',function (err) {
  		
  		pgdone();
  		callback(null,result);
  	})
  })}


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

  	var query = client.query("select id,data from "+table+" where id = $1", [id]);
  	query.on('row',function(row) {
  		result = module.create();
      for (var k in row.data) {
      	result[k]=row.data[k];
      }
      result.id = row.id;
  	})
  	query.on('end',function (err) {
  		
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
  	query.on('end',function (err) {
  		
  		pgdone();
  		console.log("Found");
  		console.dir(result);
  		callback(null,result);
  	})
  })
}



