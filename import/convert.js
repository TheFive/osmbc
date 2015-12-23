
var articleModule = require('../model/article.js');
var userModule = require('../model/user.js');
var blogModule = require('../model/blog.js');
var logModule = require('../model/logModule.js');
var config= require('../config.js');
var async = require('async');
var ProgressBar = require('progress');
var pgMap     = require('../model/pgMap.js');


config.initialise();

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
          blogs[item.id]=item;
          var save=false;

          // place convert code here
    
        
         


          progress.tick();
          if (save) item.save(cb); else cb();
        },function (){done();})
      }
    })},
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

          // check for objects i log history.
          if (typeof(item.user)=='object') {
            console.log("Found defect User in log");
            item.user = item.user.displayName;
            save = true;
          }

          // try to set the blog field for the log
          if (item.table == "article" && item.oid) {
            if (articlesMap[item.oid]) {
              item.blog = articlesMap[item.oid].blog;
              save = true;
            }
          }
          if (item.property=="blog") {
                item.blog = item.to;
                save = true;
          }   
        
       
        
         


          progress.tick();
          if (save) {
            item._meta = {table : logModule.table};
            (pgMap.save.bind(item))(cb); 
          } else cb();
        },function (){done();})
      }
    })},
  

],function(err) {console.log("READY.")})