"use strict";
var articleModule = require( "../model/article.js");

var fs=require('fs');

articleModule.find({},function(err,result){
  if (err) return console.log(err);
  if (!result) return console.log("Nothing found");
  fs.writeFileSync("article.json","[");
  for (let i=0;i<result.length;i++) {
    let a=result[i];
    delete a._meta;
    let s=JSON.stringify(a);
    if (i>0) fs.appendFileSync("article.json",",");
    fs.appendFileSync("article.json",s);
  }
  fs.appendFileSync("article.json","]");
  return;
});