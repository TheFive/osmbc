var express = require('express');
var router = express.Router();
var markdown = require('markdown').markdown;
var debug = require('debug')('OSMBC:routes:article');

var articleModule = require('../model/article.js');

/* GET users listing. */
router.get('/:article_id', function(req, res, next) {
  debug('router.get');
  var id = req.params.article_id;
  articleModule.findById(id,function(err,article) {
  	article.de.textHtml = markdown.toHTML(article.de.text)
  	var params = {};
  	params.edit = req.query.edit;
  	res.render('article',{article:article,params:params});
  });
});

router.post('/:article_id', function(req, res, next) {
  debug('router.put');
  var id = req.params.article_id;
  articleModule.findById(id,function(err,article) {
  	var info = {};
    if (typeof(req.body.collection)=='undefined') {
      info.status = 'message'
    }
    else 
    {
      info.status = 'error';
    }
    info.message = "Posting Article "+id + " " + info.status;

    console.log("Collection:"+req.body.collection);
    console.log("Markdown:"+req.body.markdown);

/*    if (typeof(req.body.collection)!='undefined') {
      article.changeCollection("user",req.body.collection);
    }
    if (typeof(req.body.markdown)!='undefined') {
      article.changeMarkdown("user",req.body.collection);
    }*/

  	article.de.textHtml = markdown.toHTML(article.de.text)
  	var params = {};
  	params.edit = req.query.edit;
  	res.render('article',{article:article,params:params,info:info});
  });
});

module.exports = router;

