var pg = require('pg');
var async = require('async');
var config = require('../config.js');
var pgMap = require('../model/pgMap.js');
var debug = require('debug')('OSMBC:model:logModule');

var articleModule = require('../model/article.js');
var blogModule = require('../model/blog.js');
var userModule = require('../model/user.js');

var jsdiff = require('diff');



function Change(proto)
{
  debug("Change");
  console.log(proto);
  debug("Prototype %s",JSON.stringify(proto));
  for (var k in proto) {
    this[k] = proto[k];
  }
}

function create(proto) {
  debug('create');
  console.log(proto);
  var v = new Change(proto);

  return v;
}
module.exports.log = function log(object,callback) {
	debug("log");
  async.series([
    function checkOid(oidcb) {
      debug("checkOid");
      
      if (typeof(object.oid)!="object") return oidcb();

      var table = object.oid.table;
      var reference = object.oid;
      delete reference.table;
      var module;


      switch (table) {
        case "article": module = articleModule;break;
        case "blog": module = blogModule;break;
        case "user": module = userModule;break;
        default: module = null;
      }
      pgMap.find(module,reference,function findObject(err,result) {
        debug("findObject");
        if (err) return callback(err);
        if (result ===null) return callback(new Error("Object Id Not Found in Log Module"));
        if (result.length != 1) return callback(new Error("Object Reference nicht eindeutig"));
        object.oid = result[0].id;
        oidcb(); 
      });
    },
    function saveData(savecb) {
      debug("saveData");
      pg.connect(config.pgstring, function(err, client, pgdone) {
      	if (err) {
      		pgdone();
      		return (savecb(err));
      	}
        if (typeof(object.timestamp)=='undefined') object.timestamp = new Date();
        debug(object);
      	var query = client.query("insert into changes (data) values ($1) ", [object]);
      	query.on('end',function () {  		
      		pgdone();
      		savecb();
      	});
      });
    }],
    function(err) {callback(err);}
  );
};


module.exports.find = function(obj1,obj2,callback) {
  debug('find');
  pgMap.find(this,obj1,obj2,callback);
};
module.exports.findById = function(id,callback) {
  debug('findById');
  pgMap.findById(id,this,callback);
};


module.exports.create = function() {
  return new Change();
};


Change.prototype.htmlDiffText = function htmlDiffText(maxChars){
  debug("htmlDiffText");
  var from = "";
  var to = "";
  if (this.from) from = this.from;
  if (this.to) to = this.to;
  var diff = jsdiff.diffWordsWithSpace(from, to);
  
  var result = "";
  var chars = maxChars;
  diff.forEach(function(part){
    // green for additions, red for deletions
    // grey for common parts
    var styleColor               = 'style="color:grey"';
    if (part.added) styleColor   = 'class="osmbc-inserted"';
    if (part.removed) styleColor = 'class="osmbc-deleted"';
    var partstr = part.value;
    if (!(part.added || part.removed)) partstr = "…";
    partstr = partstr.substring(0,chars);
    chars -= Math.max(0,partstr.length);
    result += '<span '+styleColor+'>'+partstr+'</span>';
  });  
  result+="\n";
  return result;
};



function countLogsForBlog(blog,callback) {
  debug("countLogsForBlog");
 
  pg.connect(config.pgstring, function(err, client, pgdone) {
    if (err) {
      console.log("Connection Error");
      console.dir(err);

      pgdone();
      return (callback(err));
    }
    var sqlQuery =  "select data->>'user' as user,data->>'property' as property, count(*) as change_nr from changes where (((data->>'to' != 'startreview') and (data->>'to' != 'markexported'))or ((data->'to') is null))  and (data->>'blog' = $1) group by data->>'blog',data->>'user',data->>'property'";
    var sqlArray = [blog];
    var startTime = new Date().getTime();
    var result = [];

    var query = client.query(sqlQuery,sqlArray);
    debug(sqlQuery);

    query.on('row',function(row) {
      var r ={};
      for (var k in row) {
        r[k]=row[k];
      }
      
       result.push(r);
    });
    query.on('end',function () {    
      pgdone();
      var endTime = new Date().getTime();
      debug("SQL: ["+ (endTime - startTime)/1000 +"]("+result.length+" rows)"+ sqlQuery);

      var logs={};
      for (var i =0;i<result.length;i++) {
        var o = result[i];
        if (!logs[o.property]) logs[o.property]={};
        logs[o.property][o.user] = parseInt(o.change_nr);
      }
      for (i=0;i<config.getLanguages().length;i++){
        var l = config.getLanguages()[i];
        if (blog["reviewComment"+l]) {
          for (var j=0;j<blog["reviewComment"+l].length;j++) {
            if (!logs["review"+l]) logs["review"+l]={};
            logs["review"+l][blog["reviewComment"+l][j].user] = 1;
          }
        }
      }
      callback(null,logs);
    });
    query.on('error',function (err) {    
      pgdone();
      callback(err);
    });
  });
}



function createTable(cb) {
  debug('createTable');
  var createString = 'CREATE TABLE changes (  id bigserial NOT NULL,  data json,  \
                  CONSTRAINT changes_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);';
  var createView = "drop index if exists changes_table_oid_idx; \
                create index changes_table_oid_idx on changes((data->>'table'),(data->>'oid')); \
                drop index if exists changes_id_idx; \
                CREATE INDEX changes_id_idx ON changes USING btree (id);";
  pgMap.createTable('changes',createString,createView,cb);
}

function dropTable(cb) {
  debug('dropTable');
  pgMap.dropTable('changes',cb);
}



module.exports.table = "changes";
module.exports.countLogsForBlog = countLogsForBlog;
module.exports.createTable = createTable;
module.exports.dropTable = dropTable;
module.exports.create = create;
module.exports.Class = Change;