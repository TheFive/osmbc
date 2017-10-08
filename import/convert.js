"use strict";

var articleModule = require('../model/article.js');
var logger   = require("../config.js").logger;
var userModule = require('../model/user.js');
var blogModule = require('../model/blog.js');
var logModule = require('../model/logModule.js');
var config= require('../config.js');
var configModule= require('../model/config.js');
var async = require('async');
var ProgressBar = require('progress');


config.initialise();





var blogs = {};
var articlesMap = {};
async.series([
  configModule.initialise,
  function articles(done) {
    articleModule.find({},function(err,result){
      if (err) {
        logger.error(err);
        return;
      }
      if (result) {
        var length = result.length;
        var progress = new ProgressBar("Converting Articles :bar :percent",{total:length});
        var count = 0;
        async.eachSeries(result,function iterator (item,cb){

          articlesMap[item.id] = item;
          var save=false;

          // place convert code here




          progress.tick();
          if (save) {
            count ++;
            item.save(cb);
          } else cb();

      
        },function (){
          console.info();
          console.info(count + " from "+length+ " Article changed");
          done();
        });
      }
    });},
  function users(done) {
    userModule.find({},function(err,result){
      if (err) {
        console.error(err);
        return;
      }
      if (result) {
        var length = result.length;
        var progress = new ProgressBar("Converting Users :bar :percent",{total:length});
        var count = 0;
        async.eachSeries(result,function iterator (item,cb){

          var save=false;
        
        // place convert code here

          progress.tick();
          if (save) {
            count ++;
            item.save(cb);
          } else cb();
        },function (){
          console.info();
          console.info(count + " from "+length+ " Users changed");
          done();});
      }
    });},
 function blog(done) {
    blogModule.find({},function(err,result){
      if (err) {
        console.error(err);
        return;
      }
      if (result) {
        var length = result.length;
        var progress = new ProgressBar("Converting Blog :bar :percent",{total:length});
        var count = 0;
        async.eachSeries(result,function iterator (item,cb){

          blogs[item.id]=item;
          var save=false;

          // place convert code here
    
        
         


          progress.tick();
          if (save) {
            count ++;
            item.save(cb);
          } else cb();
        },function (){
          console.info();
          console.info(count + " from "+length+ " Blogs changed");
          done();});
      }
    });},
   function changes(done) {
    logModule.find({},function(err,result){
      if (err) {
        console.error(err);
        return;
      }
      if (result) {
        var length = result.length;
        var progress = new ProgressBar("Converting Changes :bar :percent",{total:length});
        var count = 0;
        async.eachSeries(result,function iterator (item,cb){

          var save=false;

          // place convert code here

          if ((typeof item.user == "object") && item.user.OSMUser) {
            item.user = item.user.OSMUser;
            save = true;
          }






          progress.tick();
          if (save) {
            count ++;
            item.save(cb);
          } else cb();
        },function (){
          console.info();
          console.info(count + " from "+length+ " Changes changed");
          done();});
      }
    });},
  

],function(err) {if (err) console.error(err);console.info("READY.");});