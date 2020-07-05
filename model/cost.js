"use strict";

const debug = require("debug")("OSMBC:model:cost");
const assert = require("assert").strict;
const db = require("../model/db.js");




var pgObject = {};

pgObject.createString = 'CREATE TABLE "cost" ( \
            "date" timestamp(6) NOT NULL, \
            "translator" varchar NOT NULL, \
            "automated" varchar NOT NULL, \
            "blog" varchar NOT NULL, \
            "fromlang" varchar NOT NULL, \
            "tolang" varchar NOT NULL, \
            "osmuser" varchar NOT NULL, \
            "articleid" varchar NOT NULL, \
            "charcount" integer NOT NULL, \
            "message" varchar \
          ) ';

pgObject.indexDefinition = {
};

pgObject.viewDefinition = {


};
pgObject.table = "cost";

module.exports.pg = pgObject;


module.exports.count = function count(object, callback) {
  debug("count");
  if (typeof (object.timestamp) === "undefined") object.timestamp = new Date();
  assert(object.timestamp);
  assert(object.translator);
  assert(object.automated);
  assert(object.blog);
  assert(object.fromLang);
  assert(object.toLang);
  assert(object.user);
  assert(object.articleid);
  assert(object.charcount);
  db.query("insert into cost (date,translator,automated,blog,fromlang,tolang,osmuser,articleid,charcount,message) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ",
    [object.timestamp, object.translator, object.automated, object.blog, object.fromLang, object.toLang, object.user, object.articleid, object.charcount, object.message],
    function(err) {
      return callback(err);
    });
};

module.exports.allCostDetail = function allCostDetail(callback) {
  db.query("select * from cost", function(err, result) {
    if (err) return callback(err);
    return callback(null, result.rows);
  });
};
