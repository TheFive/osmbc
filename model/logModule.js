"use strict";

var db = require("../model/db.js");
var config = require("../config.js");
var pgMap = require("../model/pgMap.js");
var debug = require("debug")("OSMBC:model:logModule");


var jsdiff = require("diff");



function Change(proto) {
  debug("Change");
  debug("Prototype %s", JSON.stringify(proto));
  for (var k in proto) {
    this[k] = proto[k];
  }
}

function create(proto) {
  debug("create");
  var v = new Change(proto);

  return v;
}
module.exports.log = function log(object, callback) {
  debug("log");
  if (typeof (object.timestamp) === "undefined") object.timestamp = new Date();
  db.query("insert into changes (data) values ($1) ", [object], function(err) {
    return callback(err);
  });
};


module.exports.find = function(obj1, obj2, callback) {
  debug("find");
  pgMap.find(this, obj1, obj2, callback);
};
module.exports.findById = function(id, callback) {
  debug("findById");
  pgMap.findById(id, this, callback);
};


module.exports.create = function() {
  return new Change();
};


Change.prototype.htmlDiffText = function htmlDiffText(maxChars) {
  debug("htmlDiffText");
  var from = "";
  var to = "";

  if (this.from) from = String(this.from);
  if (this.to) to = String(this.to);

  if (from.length > 2000 || to.length > 2000) {
    return "Disabled for texts longer than 2000 chars.";
  }

  // first check on only spaces
  var diff = jsdiff.diffChars(from, to);
  var onlySpacesAdd = true;
  var onlySpacesDel = true;
  diff.forEach(function(part) {
    var partOnlySpace = (part.value.trim() === "");
    if (part.removed) {
      onlySpacesAdd = false;
      if (!partOnlySpace) onlySpacesDel = false;
    }

    if (part.added) {
      onlySpacesDel = false;
      if (!partOnlySpace) onlySpacesAdd = false;
    }
  });
  if (onlySpacesAdd) {
    return '<span class="osmbc-inserted">ONLY SPACES ADDED</span>';
  }
  if (onlySpacesDel) {
    return '<span class="osmbc-deleted">Only spaces removed</span>';
  }
  diff = jsdiff.diffWordsWithSpace(from, to);

  var result = "";
  var chars = maxChars;
  diff.forEach(function(part) {
    // green for additions, red for deletions
    // grey for common parts
    var styleColor               = 'style="color:grey"';
    if (part.added) {
      styleColor = 'class="osmbc-inserted"';
    }
    if (part.removed) {
      styleColor = 'class="osmbc-deleted"';
    }
    var partstr = part.value;
    if (!(part.added || part.removed)) partstr = "…";
    partstr = partstr.substring(0, chars);
    chars -= Math.max(0, partstr.length);
    result += "<span " + styleColor + ">" + partstr + "</span>\n";
  });
  return result;
};



function countLogsForBlog(blog, callback) {
  debug("countLogsForBlog");


  var sqlQuery =  "select username as user,property,count(*) as change_nr from (select data->>'user' as username,case when data->>'property' like 'comment%' then 'comment' else data->>'property' end as property, data->>'oid' as oid from changes where (((data->>'to' != '') and (data->>'to' != 'no translation') and (data->>'to' != 'startreview') and (data->>'to' != 'markexported'))or ((data->'to') is null))  and (data->>'blog' = $1)  group by data->>'blog',data->>'user',property,data->>'oid') as listoffields group by username,property";
  var sqlArray = [blog];
  var startTime = new Date().getTime();
  var result = [];

  debug(sqlQuery);
  db.query(sqlQuery, sqlArray, function(err, queryResult) {
    if (err) return callback(err);
    if (queryResult) {
      queryResult.rows.forEach(function(item) {
        var r = {};
        for (var k in item) {
          r[k] = item[k];
        }

        result.push(r);
      });
    }
    var endTime = new Date().getTime();
    debug("SQL: [" + (endTime - startTime) / 1000 + "](" + result.length + " rows)" + sqlQuery);

    var logs = {};
    for (var i = 0; i < result.length; i++) {
      var o = result[i];
      if (!logs[o.property]) logs[o.property] = {};
      logs[o.property][o.user] = parseInt(o.change_nr);
    }
    for (i = 0; i < config.getLanguages().length; i++) {
      var l = config.getLanguages()[i];
      if (blog["reviewComment" + l]) {
        for (var j = 0; j < blog["reviewComment" + l].length; j++) {
          if (!logs["review" + l]) logs["review" + l] = {};
          logs["review" + l][blog["reviewComment" + l][j].user] = 1;
        }
      }
    }
    callback(null, logs);
  });
}

function countLogsForUser(user, callback) {
  debug("countLogsForUser");


  var sqlQuery =  "select to_char(date(data->>'timestamp'),'YYYY-MM-DD') as date,count(*) as count from changes where data->>'user'  like $1 and data->>'table'::text in ('article','blog') group by date";
  var sqlArray = [user];
  var startTime = new Date().getTime();
  var result = [];
  debug(sqlQuery);
  db.query(sqlQuery, sqlArray, function(err, queryResult) {
    if (err) return callback(err);
    if (queryResult) {
      queryResult.rows.forEach(function(item) {
        var r = {};
        r.date = item.date;
        r.count = parseInt(item.count);
        result.push(r);
      });
    }

    var endTime = new Date().getTime();
    debug("SQL: [" + (endTime - startTime) / 1000 + "](" + result.length + " rows)" + sqlQuery);

    callback(null, result);
  });
}

var pgObject = {};
pgObject.createString = "CREATE TABLE changes (  id bigserial NOT NULL,  data json,  \
                  CONSTRAINT changes_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);";
pgObject.indexDefinition = {
  "changes_table_oid_idx": "CREATE INDEX changes_table_oid_idx ON changes USING btree (((data ->> 'table'::text)), ((data ->> 'oid'::text)))",
  "changes_blog_to_idx": "CREATE INDEX changes_blog_to_idx ON changes USING btree (((data ->> 'blog'::text)))",
  "changes_user_to_idx": "CREATE INDEX changes_user_to_idx ON changes USING btree (((data ->> 'user'::text)))",
  "changes_timestamp_idx": "CREATE INDEX changes_timestamp_idx ON changes USING btree (((data ->> 'timestamp'::text)))"
};

pgObject.viewDefinition = {};

pgObject.table = "changes";

module.exports.pg = pgObject;


Change.prototype.getTable = function getTable() {
  return "changes";
};

Change.prototype.save = pgMap.save;


module.exports.table = "changes";
module.exports.countLogsForBlog = countLogsForBlog;
module.exports.create = create;
module.exports.Class = Change;
module.exports.countLogsForUser = countLogsForUser;
