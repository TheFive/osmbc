

import db from "../model/db.js";
import pgMap from "../model/pgMap.js";
import config from "../config.js";



import { diffChars, diffWordsWithSpace, diffLines } from "diff";
import _debug from "debug";
import { createHash } from "node:crypto";
import { reportTableWrite } from "./tableWrites.js";
const debug = _debug("OSMBC:model:logModule");


const maxDiffLength = config.getValue("MaxDiffLength", { mustExist: true });

// htmlDiffText results per content hash, least recently used first
const DIFF_CACHE_SIZE = 5000;
const diffCache = new Map();

function diffCacheKey(change, maxChars) {
  const hash = createHash("sha1");
  for (const part of [change.table, change.from, change.to, maxChars]) {
    hash.update(String(part ?? ""));
    hash.update("\u0000");
  }
  return hash.digest("base64");
}

const stripSpaces = (text) => text.replace(/\s+/g, "");

// "only spaces added" / "only spaces removed", or null. Such a change keeps
// the text without white space, so for any other change the expensive
// character diff is not needed (same answer, see htmlDiffText).
function onlySpacesNote(change, from, to) {
  if (stripSpaces(from) !== stripSpaces(to)) return null;
  const diffTool = (change.table === "config") ? diffLines : diffChars;
  let onlySpacesAdd = true;
  let onlySpacesDel = true;
  diffTool(from, to).forEach(function (part) {
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
  if (onlySpacesAdd) return '<span class="osmbc-inserted">ONLY SPACES ADDED</span>';
  if (onlySpacesDel) return '<span class="osmbc-deleted">Only spaces removed</span>';
  return null;
}

function htmlDiff(change, maxChars) {
  const from = change.from ? String(change.from) : "";
  const to = change.to ? String(change.to) : "";

  if (from.length > maxDiffLength || to.length > maxDiffLength) {
    return "Disabled for texts longer than " + maxDiffLength.toString() + " chars.";
  }
  if (from === to) return "<span>no change</span>";
  const note = onlySpacesNote(change, from, to);
  if (note) return note;

  let result = "";
  let chars = (maxChars === undefined) ? 9999999 : maxChars;
  diffWordsWithSpace(from, to).forEach(function (part) {
    // green for additions, red for deletions, grey for common parts
    let styleColor = 'style="color:grey"';
    if (part.added) styleColor = 'class="osmbc-inserted"';
    if (part.removed) styleColor = 'class="osmbc-deleted"';
    let partstr = part.value;
    if (!(part.added || part.removed)) partstr = "…";
    partstr = partstr.substring(0, chars);
    chars -= Math.max(0, partstr.length);
    result += "<span " + styleColor + ">" + partstr + "</span>\n";
  });
  return result;
}

class Change {
  constructor(proto) {
    debug("Change");
    debug("Prototype %s", JSON.stringify(proto));
    for (const k in proto) {
      this[k] = proto[k];
    }
  }

  /**
   * The change as coloured HTML (inserted / deleted words, common parts as
   * "…"), at most `maxChars` characters of changed text; "only spaces"
   * changes and texts longer than MaxDiffLength get a short note instead.
   * The result depends only on table, texts and `maxChars`, so it is kept
   * under a hash of these (DIFF_CACHE_SIZE entries, least recently used
   * dropped) — not under the id, which a restored or test database reuses.
   * Diffing long texts is the most expensive part of an article page with
   * a long history.
   * @param {number} [maxChars] limit of the shown changed text
   * @returns {string} HTML
   */
  htmlDiffText(maxChars) {
    debug("htmlDiffText");
    const key = diffCacheKey(this, maxChars);
    let result = diffCache.get(key);
    if (result === undefined) {
      result = htmlDiff(this, maxChars);
      if (diffCache.size >= DIFF_CACHE_SIZE) diffCache.delete(diffCache.keys().next().value);
    } else {
      diffCache.delete(key); // re-insert below: most recently used last
    }
    diffCache.set(key, result);
    return result;
  }


  getTable() {
    return "changes";
  }
}

function create(proto) {
  debug("create");
  const v = new Change(proto);

  return v;
}

function log(object, callback) {
  debug("log");
  function _log(object, callback) {
    if (typeof (object.timestamp) === "undefined") object.timestamp = new Date();
    db.query("insert into changes (data) values ($1) ", [object], function(err) {
      reportTableWrite("changes");
      return callback(err);
    });
  }
  if (callback) return _log(object, callback);
  return new Promise((resolve, reject) => {
    _log(object, (err) => (err) ? reject(err) : resolve());
  });
}


function find(obj1, obj2, callback) {
  const self = this;
  function _find(obj1, obj2, callback) {
    debug("find");
    pgMap.find(self, obj1, obj2, callback);
  }
  if (callback) {
    return _find(obj1, obj2, callback);
  }
  return new Promise((resolve, reject) => {
    _find(obj1, obj2, (err, result) => (err) ? reject(err) : resolve(result));
  });
}
function findById(id, callback) {
  debug("findById");
  pgMap.findById(id, this, callback);
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
  changes_timestamp_idx: "CREATE INDEX changes_timestamp_idx ON changes USING btree (((data ->> 'timestamp'::text)))",
  // first change of a user (new users on the start page, model/user.js getNewUsers)
  changes_user_timestamp_idx: "CREATE INDEX changes_user_timestamp_idx ON changes USING btree (((data ->> 'user'::text)), ((data ->> 'timestamp'::text)))",
  // article changes per user (user list column "OSMBC Changes", getCountsForUsers)
  changes_article_user_idx: "CREATE INDEX changes_article_user_idx ON changes USING btree (((data ->> 'user'::text))) WHERE ((data ->> 'table'::text) = 'article'::text)"
};

pgObject.viewDefinition = {};

pgObject.table = "changes";




Change.prototype.save = pgMap.save;




function getCountsForUsers(userNames, callback) {
  debug("getCountsForUsers");
  if (!userNames || userNames.length === 0) return callback(null, {});

  const placeholders = userNames.map((_, i) => `$${i + 1}`).join(",");
  const sqlQuery = `
    SELECT data->>'user' as user, COUNT(*) as count
    FROM changes
    WHERE data->>'table' = 'article' 
    AND data->>'user' IN (${placeholders})
    GROUP BY data->>'user'
  `;

  db.query(sqlQuery, userNames, function(err, result) {
    if (err) return callback(err);

    // Konvertiere zu Map für schnellen Zugriff
    const countsMap = {};
    if (result && result.rows) {
      result.rows.forEach(row => {
        countsMap[row.user] = parseInt(row.count);
      });
    }

    callback(null, countsMap);
  });
}

/**
 * Last change per language-related property of a blog, leaving out the given
 * users (translation services, automatic rules). Looks at article texts
 * (`markdownXX`) and the blog's review comments and close/reopen
 * (`reviewCommentXX`, `closeXX`).
 * @param {string} blogName e.g. "WN851"
 * @param {string[]} ignoredUsers OSMUser names whose changes don't count
 * @param {function(Error|null, Array<{table: string, property: string, last: string}>=)} callback
 *   one row per table/property, `last` is the ISO timestamp of the newest change
 */
function findLastChangesForBlog(blogName, ignoredUsers, callback) {
  debug("findLastChangesForBlog");
  const sqlQuery = `
    SELECT data->>'table' AS table, data->>'property' AS property, MAX(data->>'timestamp') AS last
    FROM changes
    WHERE data->>'blog' = $1
    AND NOT (data->>'user' = ANY($2::text[]))
    AND ((data->>'table' = 'article' AND data->>'property' LIKE 'markdown%')
      OR (data->>'table' = 'blog' AND (data->>'property' LIKE 'reviewComment%' OR data->>'property' LIKE 'close%')))
    GROUP BY 1, 2`;
  db.query(sqlQuery, [blogName, ignoredUsers], function(err, result) {
    if (err) return callback(err);
    callback(null, (result && result.rows) ? result.rows : []);
  });
}

/**
 * Who changed which property of the given articles, without the texts.
 * One row per article, property and user with the user's latest change,
 * ordered by article, property and that timestamp (newest first), so the
 * first row of a property is its last author.
 * Callback style, or a promise without callback.
 * @param {Array<string|number>} oids article ids
 * @param {Function} [callback] (err, rows) with rows {oid, property, user, timestamp}
 * @returns {Promise<Array>|undefined} rows, if no callback is given
 */
function findAuthorSummary(oids, callback) {
  debug("findAuthorSummary");
  function _findAuthorSummary(oids, callback) {
    if (!oids || oids.length === 0) return callback(null, []);
    const sqlQuery = `
      SELECT data->>'oid' AS oid, data->>'property' AS property, data->>'user' AS user,
        MAX(data->>'timestamp') AS timestamp
      FROM changes
      WHERE data->>'table' = 'article' AND data->>'oid' = ANY($1::text[])
      GROUP BY 1, 2, 3
      ORDER BY 1, 2, 4 DESC`;
    db.query(sqlQuery, [oids.map(String)], function(err, result) {
      if (err) return callback(err);
      callback(null, (result && result.rows) ? result.rows : []);
    });
  }
  if (callback) return _findAuthorSummary(oids, callback);
  return new Promise((resolve, reject) => {
    _findAuthorSummary(oids, (err, rows) => (err) ? reject(err) : resolve(rows));
  });
}

/**
 * Find condition on `timestamp` for a date filter of the history log:
 * "2026", "2026-11" or "2026-11-21" become the time range of that year,
 * month or day (timestamps are ISO strings in UTC, so text comparison is
 * time comparison, and the timestamp index is used — a LIKE prefix
 * search reads the whole changes table). Any other text keeps the old
 * meaning, a prefix match.
 * @param {string} date date filter as typed in the URL
 * @returns {string|Array} value for find({ timestamp: … })
 */
function timestampCondition(date) {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(date);
  if (!m) return date + "%";
  const [, y, mo, d] = m;
  const year = Number(y);
  let end;
  if (d) {
    const next = new Date(Date.UTC(year, Number(mo) - 1, Number(d) + 1));
    end = next.toISOString().substring(0, 10);
  } else if (mo) {
    const next = new Date(Date.UTC(year, Number(mo), 1));
    end = next.toISOString().substring(0, 7);
  } else {
    end = String(year + 1);
  }
  return ["GE:" + date, "<" + end];
}

const logModule = {
  table: "changes",
  timestampCondition: timestampCondition,
  findAuthorSummary: findAuthorSummary,
  findLastChangesForBlog: findLastChangesForBlog,
  countLogsForBlog: countLogsForBlog,
  create: create,
  countLogsForUser: countLogsForUser,
  getCountsForUsers: getCountsForUsers,
  log: log,
  find: find,
  findById: findById,
  pg: pgObject,
  Class: Change
};

export default logModule;
