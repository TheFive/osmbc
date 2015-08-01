var express = require('express');
var async   = require('async');
var moment = require('moment');
var router = express.Router();
var markdown = require('markdown').markdown;
var debug = require('debug')('OSMBC:routes:article');

var articleModule = require('../model/article.js');
var logModule = require('../model/logModule.js');

/* GET users listing. */
router.get('/:article_id', function(req, res, next) {
  debug('router.get');
  var id = req.params.article_id;
  articleModule.findById(id,function(err,article) {
    if (typeof(article.id) == 'undefined') return next();


   var params = {};
    params.edit = req.query.edit;
    var changes = [];


    async.series([
      function (callback) {
        if (typeof(req.query.setCategory)!='undefined')
        {
          var changes = {category:req.query.setCategory};
          article.setAndSave(req.user.displayName,changes,function(err) {
            var info = {};
            info.message = "Category Changed";
            info.status = "message";
            if (err) {
              console.dir(err);
              info.message = JSON.stringify(err);
              info.status = 'error';
            }
            return callback();
          })
        } else return callback();
      },
      function (callback) {
        logModule.find({id:id},{column:"timestamp",desc :true},function(err,result) {
          if (err) return callback(err);
          changes = result;

          callback();
        })
      },
      function (callback){
        if (typeof(params.edit)!='undefined') {
          article.lock={};
          article.lock.user = req.user.displayName;
          article.lock.timestamp = new Date();
          article.save(callback);
        } else { 
          return callback()
        }
      }],
        function (err) {
          if (typeof(article.markdown)!='undefined') {
            var text = article.markdown;
            text = "###"+article.category+"\n* ...\n"+text+"\n* ...";
            article.textHtml = markdown.toHTML(text)
          } 
          if (typeof(article.comment)!='undefined') {
            article.commentHtml = markdown.toHTML(article.comment)
          } 

 
          res.render('article',{article:article,params:params,user:req.user,changes:changes,moment:moment});
        }
    );
  });
});
 
router.post('/:article_id', function(req, res, next) {
  debug('router.put');
  var id = req.params.article_id;
  articleModule.findById(id,function(err,article) {
    if (typeof(article.id) == 'undefined') return next();
  	var changes = {markdown:req.body.markdown,
                   collection:req.body.collection,
                   comment:req.body.comment,
                   category:req.body.category};

    article.setAndSave(req.user.displayName,changes,function(err) {
      var info = {};
      info.message = "Everything saved";
      info.status = "message";
      if (err) {
        console.dir(err);
        info.message = JSON.stringify(err);
        info.status = 'error';
      }
      if (typeof(article.markdown)!='undefined') {
        article.textHtml = markdown.toHTML(article.markdown)
      } 
      if (typeof(article.comment)!='undefined') {
        article.commentHtml = markdown.toHTML(article.comment)
      } 


      var params = {};
      params.edit = req.query.edit;
      res.render('article',{article:article,params:params,info:info,user:req.user});      
    })
  });
});

module.exports = router;


