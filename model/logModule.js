"use strict";

const db = require("../model/db.js");
const language = require("../model/language.js");
const pgMap = require("../model/pgMap.js");
const debug = require("debug")("OSMBC:model:logModule");


const jsdiff = require("diff");



function Change(proto) {
  debug("Change");
  debug("Prototype %s", JSON.stringify(proto));
  for (const k in proto) {
    this[k] = proto[k];
  }
}

function create(proto) {
  debug("create");
  const v = new Change(proto);

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
  let from = "";
  let to = "";

  if (this.from) from = String(this.from);
  if (this.to) to = String(this.to);

  if (from.length > 2000 || to.length > 2000) {
    return "Disabled for texts longer than 2000 chars.";
  }

  // first check on only spaces
  let diff = jsdiff.diffChars(from, to);
  let onlySpacesAdd = true;
  let onlySpacesDel = true;
  if (from === to) {
    return "<span>no change</span>";
  }
  diff.forEach(function(part) {
    const partOnlySpace = (part.value.trim() === "");
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

  let result = "";
  let chars = maxChars;
  diff.forEach(function(part) {
    // green for additions, red for deletions
    // grey for common parts
    let styleColor               = 'style="color:grey"';
    if (part.added) {
      styleColor = 'class="osmbc-inserted"';
    }
    if (part.removed) {
      styleColor = 'class="osmbc-deleted"';
    }
    let partstr = part.value;
    if (!(part.added || part.removed)) partstr = "…";
    partstr = partstr.substring(0, chars);
    chars -= Math.max(0, partstr.length);
    result += "<span " + styleColor + ">" + partstr + "</span>\n";
  });
  return result;
};



function countLogsForBlog(blog, callback) {
  debug("countLogsForBlog");


  const sqlQuery =  "select username as user,property,count(*) as change_nr from (select data->>'user' as username,case when data->>'property' like 'comment%' then 'comment' else data->>'property' end as property, data->>'oid' as oid from changes where (((data->>'to' != '') and (data->>'to' != 'no translation') and (data->>'to' != 'startreview') and (data->>'to' != 'markexported'))or ((data->'to') is null))  and (data->>'blog' = $1)  group by data->>'blog',data->>'user',property,data->>'oid') as listoffields group by username,property";
  const sqlArray = [blog];
  const startTime = new Date().getTime();
  const result = [];

  debug(sqlQuery);
  db.query(sqlQuery, sqlArray, function(err, queryResult) {
    if (err) return callback(err);
    if (queryResult) {
      queryResult.rows.forEach(function(item) {
        const r = {};
        for (const k in item) {
          r[k] = item[k];
        }

        result.push(r);
      });
    }
    const endTime = new Date().getTime();
    debug("SQL: [" + (endTime - startTime) / 1000 + "](" + result.length + " rows)" + sqlQuery);

    const logs = {};
    for (let i = 0; i < result.length; i++) {
      const o = result[i];
      if (!logs[o.property]) logs[o.property] = {};
      logs[o.property][o.user] = parseInt(o.change_nr);
    }
    for (let i = 0; i < language.getLid().length; i++) {
      const l = language.getLid()[i];
      if (blog["reviewComment" + l]) {
        for (let j = 0; j < blog["reviewComment" + l].length; j++) {
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



  const sqlQuery =  "select * from (select day::date  from generate_series($2::date - interval '1 year',$2::date, interval ' 1 day') day) d left join ( select date(data->>'timestamp')::date as day,count(*) as count from changes where data->>'user'  like $1 and data->>'table'::text in ('article','blog') group by 1) t using (day) order by day";

  const startTime = new Date().getTime();
  const sqlArray = [user, new Date()];
  const result = [];
  debug(sqlQuery);
  db.query(sqlQuery, sqlArray, function(err, queryResult) {
    if (err) return callback(err);
    if (queryResult) {
      queryResult.rows.forEach(function(item) {
        const r = {};
        r.date = item.day;
        r.count = parseInt(item.count);
        result.push(r);
      });
    }

    const endTime = new Date().getTime();
    debug("SQL: [" + (endTime - startTime) / 1000 + "](" + result.length + " rows)" + sqlQuery);

    callback(null, result);
  });
}

const pgObject = {};
pgObject.createString = "CREATE TABLE changes (  id bigserial NOT NULL,  data json,  \
                  CONSTRAINT changes_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);";
pgObject.indexDefinition = {
  changes_table_oid_idx: "CREATE INDEX changes_table_oid_idx ON changes USING btree (((data ->> 'table'::text)), ((data ->> 'oid'::text)))",
  changes_blog_to_idx: "CREATE INDEX changes_blog_to_idx ON changes USING btree (((data ->> 'blog'::text)))",
  changes_user_to_idx: "CREATE INDEX changes_user_to_idx ON changes USING btree (((data ->> 'user'::text)))",
  changes_timestamp_idx: "CREATE INDEX changes_timestamp_idx ON changes USING btree (((data ->> 'timestamp'::text)))"
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
