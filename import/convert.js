"use strict";

var articleModule = require('../model/article.js');
var userModule = require('../model/user.js');
var blogModule = require('../model/blog.js');
var logModule = require('../model/logModule.js');
var config= require('../config.js');
var async = require('async');
var ProgressBar = require('progress');
var pgMap     = require('../model/pgMap.js');
var jsdiff = require('diff');


config.initialise();



function convertComment(article,changes){

  article.commentList = [];
  if (!article.comment) return;
 

  for (var i=0;i<changes.length;i++) {
    var from = "";
    var to = "";

    var change = changes[i];

    if (change.from) from = String(change.from);
    if (change.to) to = String(change.to);



    // first check on only spaces
    var diff = jsdiff.diffChars(from,to);

    for (var k=0;k<diff.length;k++ ) {
      var part = diff[k];
      if (part.added) {
          article.commentList.push(
            {timestamp:change.timestamp,
              user:change.user,
              text:"inserted: "+part.value});
      }
      if (part.removed) { // part deleted
        article.commentList.push(
          {timestamp:change.timestamp,
            user:change.user,
            text:"removed: "+part.value});

      }
    }
  }
}

var blogs = {};
var articlesMap = {};
async.series([
  function articles(done) {
    articleModule.find({},function(err,result){
      if (err) {
        console.log(err);
        return;
      }
      if (result) {
        var length = result.length;
        var progress = new ProgressBar("Converting Articles :bar :percent",{total:length});
        var count = 0;
        async.eachSeries(result,function iterator (item,cb){
          count ++;
          articlesMap[item.id] = item;
          var save=false;

          // place convert code here

          logModule.find({table:"article",oid:item.id,property:"comment"},{column:"timestamp",desc:false},function(err,logs){
            if (err) return cb(err);

              convertComment(item,logs);
              if (item.commentList.length>0) save = true;

            progress.tick();
            if (save) item.save(cb); else cb();
          });
      
        },function (){done();});
      }
    });},
  function users(done) {
    userModule.find({},function(err,result){
      if (err) {
        console.log(err);
        return;
      }
      if (result) {
        var length = result.length;
        var progress = new ProgressBar("Converting Users :bar :percent",{total:length});
        var count = 0;
        async.eachSeries(result,function iterator (item,cb){
          count ++;
          var save=false;
        
        // place convert code here

          progress.tick();
          if (save) item.save(cb); else cb();
        },function (){done();});
      }
    });},
 function blog(done) {
    blogModule.find({},function(err,result){
      if (err) {
        console.log(err);
        return;
      }
      if (result) {
        var length = result.length;
        var progress = new ProgressBar("Converting Blog :bar :percent",{total:length});
        var count = 0;
        async.eachSeries(result,function iterator (item,cb){
          count ++;
          blogs[item.id]=item;
          var save=false;

          // place convert code here
    
        
         


          progress.tick();
          if (save) item.save(cb); else cb();
        },function (){done();});
      }
    });},
   function changes(done) {
    logModule.find({},function(err,result){
      if (err) {
        console.log(err);
        return;
      }
      if (result) {
        var length = result.length;
        var progress = new ProgressBar("Converting Changes :bar :percent",{total:length});
        var count = 0;
        async.eachSeries(result,function iterator (item,cb){
          count ++;
          var save=false;

          // place convert code here


        
         


          progress.tick();
          if (save) {
            item._meta = {table : logModule.table};
            (pgMap.save.bind(item))(cb); 
          } else cb();
        },function (){done();});
      }
    });},
  

],function(err) {if (err) console.dir(err);console.log("READY.");});