
import { strict as assert } from "assert";

import fs from "fs";


import articleModule from "../model/article.js";
import blogModule from "../model/blog.js";
import logModule from "../model/logModule.js";
import configModule from "../model/config.js";
import async from "async";

function exportArticle(blog, callback) {
  console.info("export article");
  articleModule.find({ blog: blog }, function(err, result) {
    if (err) return console.error(err);
    if (!result) return console.info("Nothing found");
    fs.writeFileSync("article.json", "[");
    for (let i = 0; i < result.length; i++) {
      const a = result[i];
      delete a._meta;
      const s = JSON.stringify(a, null, 2);
      if (i > 0) fs.appendFileSync("article.json", ",\n");
      fs.appendFileSync("article.json", s);
    }
    fs.appendFileSync("article.json", "]");
    return callback();
  });
}

function exportBlog(blo, callback) {
  console.info("export blog");
  blogModule.find({ name: blog }, function(err, result) {
    if (err) return console.error(err);
    if (!result) return console.info("Nothing found");
    fs.writeFileSync("blog.json", "[");
    for (let i = 0; i < result.length; i++) {
      const a = result[i];
      delete a._meta;
      const s = JSON.stringify(a, null, 2);
      if (i > 0) fs.appendFileSync("blog.json", ",\n");
      fs.appendFileSync("blog.json", s);
    }
    fs.appendFileSync("blog.json", "]");
    return callback();
  });
}

function exportChange(blog, callback) {
  console.info("export change");
  logModule.find({ blog: blog }, function(err, result) {
    if (err) return console.error(err);
    if (!result) return console.info("Nothing found");
    fs.writeFileSync("change.json", "[");
    for (let i = 0; i < result.length; i++) {
      const a = result[i];
      delete a._meta;
      const s = JSON.stringify(a, null, 2);
      if (i > 0) fs.appendFileSync("change.json", ",\n");
      fs.appendFileSync("change.json", s);
    }
    fs.appendFileSync("change.json", "]");
    return callback();
  });
}


const blog = process.argv[2];

assert(typeof (blog) === "string");
assert(blog.length >= 3);

async.series([
  configModule.initialise,
  exportArticle.bind(null, blog),
  exportBlog.bind(null, blog),
  exportChange.bind(null, blog)
], function(err) { console.error(err); console.info("Fertig"); });
