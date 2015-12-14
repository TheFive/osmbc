
var articleModule = require('../model/article.js');
var userModule = require('../model/user.js');
var blogModule = require('../model/blog.js');
var logModule = require('../model/logModule.js');
var config= require('../config.js');
var async = require('async');
var ProgressBar = require('progress');
var pgMap     = require('../model/pgMap.js');


config.initialise();


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
          var save=false;

          // place convert code here
      
          progress.tick();
          if (save) item.save(cb); else cb();
        },function (){done();})
      }
    })},
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
        },function (){done();})
      }
    })},
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
          var save=false;

          // place convert code here
          for (var i=0;i<config.getLanguages().length;i++) {
            var rcl = "reviewComment"+config.getLanguages()[i];
            if (item[rcl]) {
              console.log("Review comment found");
              for (var j=0;j<item[rcl].length;j++){
                console.log("Review comment found" + j);
                
                if (typeof(item[rcl][j].user)=='object'){
                  console.log("Found defect User in blog");
                  console.dir(item[rcl][j]);
                  item[rcl][j].user = item[rcl][j].user.displayName;
                  console.dir(item[rcl][j]);
                  save = true;
                }
              }
            }    
          }
        
         


          progress.tick();
          if (save) item.save(cb); else cb();
        },function (){done();})
      }
    })},
 /*function changes(done) {
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
          if (typeof(item.user)=='object') {
            console.log("Found defect User in log");
            console.dir(item);
            item.user = item.user.displayName;
            console.dir(item);
            save = true;
          }
       
        
         


          progress.tick();
          if (save) {
            item._meta = {table : logModule.table};
            console.dir(item);
            pgMap.save(cb).bind(item); 
          } else cb();
        },function (){done();})
      }
    })},*/
  

],function(err) {console.log("READY.")})