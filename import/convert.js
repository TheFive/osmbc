
var articleModule = require('../model/article.js');
var userModule = require('../model/user.js');
var blogModule = require('../model/blog.js');
var config= require('../config.js');
var async = require('async');
var ProgressBar = require('progress');

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
          if (item.markdown) {
            item.markdownDE = item.markdown;
            delete item.markdown;
            save = true; 
          } 
          if (item.categoryEN) {
            if (item.categoryEN == "-- not categorised --") {
              item.categoryEN = "-- no category yet --";
              save = true;
            }
          }
          if (item.category) {
            item.categoryDE=item.category;
            delete item.category;
            save = true;
          }
          if (item.markdownDE && item.markdownDE == "english only") {
            item.markdownDE = "no translation";
            save = true;
          }
          if (item.markdownEN && item.markdownEN == "german only") {
            item.markdownDE = "no translation";
            save = true;
          }
   

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
          if (typeof(item.blogSetting0) =='undefined') {
            item.blogSetting0 = "overview";
            item.blogLanguages0 = "DE";
            save = true;        
          }// set settins
          if (typeof(item.blogSetting1) =='undefined') {
            item.blogSetting1 = "overview";
            item.blogLanguages1 = "EN"
            save = true;
          }// set settins
          if (typeof(item.blogSetting2) =='undefined') {
            item.blogSetting2 = "full";
            item.blogLanguages2 = "DE.EN"
          save = true;
          }// set settins
          if (typeof(item.blogSetting3) =='undefined') {
            item.blogSetting3 = "full";
            item.blogLanguages3 = "EN.ES"
            save = true;
          }// set settins
          if (typeof(item.blogSetting4) =='undefined') {
            item.blogSetting4 = "fullfinal";
            item.blogLanguages4 = "DE"
            save = true;
          }// set settins

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
          if (item.reviewComment) {
            item.reviewCommentDE = item.reviewComment;
            delete item.reviewComment;
            save = true;
          }  
          if (item.status) {
            if (item.status=='published') {
              item.status = "closed";
              save = true;
            }
            if (item.status=='close') {
              item.status = "closed";
              save = true;
            }
            if (item.status=='review') {
              item.status = "edit";
              save = true;
            }
          }  


          progress.tick();
          if (save) item.save(cb); else cb();
        },function (){done();})
      }
    })},
 

],function(err) {console.log("READY.")})