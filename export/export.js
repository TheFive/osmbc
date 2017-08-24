"use strict";
var assert = require('assert');

var fs=require('fs');


var articleModule = require( "../model/article.js");
var blogModule = require("../model/blog.js");
var logModule = require("../model/logModule.js");
var configModule = require("../model/config.js");
var async = require('async');

function exportArticle(blog,callback) {
  console.info("export article");
  articleModule.find({blog:blog},function(err,result){
    if (err) return console.error(err);
    if (!result) return console.info("Nothing found");
    fs.writeFileSync("article.json","[");
    for (let i=0;i<result.length;i++) {
      let a=result[i];
      delete a._meta;
      let s=JSON.stringify(a,null,2);
      if (i>0) fs.appendFileSync("article.json",",\n");
      fs.appendFileSync("article.json",s);
    }
    fs.appendFileSync("article.json","]");
    return callback();
  });
}

function exportBlog(blo,callback) {
  console.info("export blog");
  blogModule.find({name:blog},function(err,result){
    if (err) return console.error(err);
    if (!result) return console.info("Nothing found");
    fs.writeFileSync("blog.json","[");
    for (let i=0;i<result.length;i++) {
      let a=result[i];
      delete a._meta;
      let s=JSON.stringify(a,null,2);
      if (i>0) fs.appendFileSync("blog.json",",\n");
      fs.appendFileSync("blog.json",s);
    }
    fs.appendFileSync("blog.json","]");
    return callback();
  });
}

function exportChange(blog,callback) {
  console.info("export change");
  logModule.find({blog:blog},function(err,result){
    if (err) return console.error(err);
    if (!result) return console.info("Nothing found");
    fs.writeFileSync("change.json","[");
    for (let i=0;i<result.length;i++) {
      let a=result[i];
      delete a._meta;
      let s=JSON.stringify(a,null,2);
      if (i>0) fs.appendFileSync("change.json",",\n");
      fs.appendFileSync("change.json",s);
    }
    fs.appendFileSync("change.json","]");
    return callback();
  });
}


var blog = process.argv[2];

assert(typeof(blog)=="string");
assert(blog.length>=3);

async.series([
  configModule.initialise,
  exportArticle.bind(null,blog),
  exportBlog.bind(null,blog),
  exportChange.bind(null,blog)
],function(err){console.error(err);console.info("Fertig");});
