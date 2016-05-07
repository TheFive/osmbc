"use strict";

var express  = require('express');
var router   = express.Router();
var async    = require('async');
var should   = require('should');
var debug    = require('debug')('OSMBC:routes:blog');
var config   = require('../config.js');
var moment   = require('moment');
var help     = require('../routes/help.js');


var blogModule     = require('../model/blog.js');
var blogRenderer   = require('../render/BlogRenderer.js');
var logModule      = require('../model/logModule.js');
var settingsModule = require('../model/settings.js');

function findBlogByRouteId(id,user,callback) {
  var blog;
  should(typeof(user)).eql('object');
  should(typeof(callback)).eql('function');

  async.series([
    function CheckTBC(cb) {
      if (id === "TBC") {
        blog = blogModule.getTBC();
      }
      return cb();
    },
    function findID(cb) {
      blogModule.findById(id,function(err,r) {
        if (err) return cb(err);
        if (r) blog= r;
        return cb();
      });
    },
  function findByName(cb) {
    if (blog) return cb();
    blogModule.find({name:id},function(err,r) {
      if (err) return cb(err);
      if (r.length===0) return cb();
      if (r.length>1) return cb(new Error("Blog >"+id+"< exists twice, internal id of first: "+r[0].id));
      if (r) blog= r[0];
      return cb();
    });
  },
  function countItems(cb) {
    if (blog) return blog.calculateDerived(user,cb);
    return cb();
  }], function(err) {
    if (err) return callback(err);
    if (!blog) return callback(new Error("Blog >"+id+"< not found"));
    callback(null,blog);
  });
}

/* GET users listing. */
function renderBlogId(req, res, next) {
  debug('router.get /:blog_id');
  req.session.articleReturnTo = req.originalUrl;

  var id = req.params.blog_id;

  var tab = req.query.tab;
  var style = req.query.style;

  if (!tab && !style) {
    tab = req.session.lasttab;
    style = req.session.laststyle;
  }
  if (!tab && !style) {
    tab = "Overview";
  }
  req.session.laststyle = style;
  req.session.lasttab = tab;


  if (tab) {

    if (tab==="Overview") return renderBlogTab(req,res,next);
    if (tab==="Review") return renderBlogTab(req,res,next);
    if (tab==="Full") return renderBlogTab(req,res,next);

  }
  var options = settingsModule.getSettings(style,req.user.getMainLang(),req.user.getSecondLang());






  var user = req.user;




  findBlogByRouteId(id,req.user,function(err,blog) {
    if (err) return next(err);
    should.exist(blog);
    id = blog.id;

    var changes = [];
    var articles = {};
    var main_text;
    var clearParams = false;

    async.series([
      function (callback) {
        blog.getPreview(options,user,function(err,result) {
          if (err) return callback(err);
          main_text = result.preview;
          articles = result.articles;
          callback();
        });
      },
      function (callback) {
        if (typeof(req.query.setStatus)!='undefined')
        {
          clearParams = true;
          var changes = {status:req.query.setStatus};
          blog.setAndSave(user,changes,function(err) {
            return callback(err);
          });
        } else return callback();
      },
      function (callback) {
        if (typeof(req.query.reviewComment)!='undefined')
        {
          clearParams = true;
          blog.setReviewComment(options.left_lang,user,req.query.reviewComment,function(err) {
            return callback(err);
          });
        } else return callback();
      },
      function (callback) {
        if (typeof(req.query.closeLang)!='undefined')
        {
          clearParams = true;
          var status = true;
          if (req.query.status && req.query.status == "false") status = false;
          blog.closeBlog(options.left_lang,user,status,function(err) {
            return callback(err);
          });
        } else return callback();
      },
 
 /*    function (callback) {
        articleModule.find({blog:blog.name},function(err,result){
          for (var i=0;i<result.length;i++ ) {
            var r = result[i];
            if (typeof(articles[r.category]) == 'undefined') {
            articles[r.category] = [];
            }
            articles[r.category].push(r);
          }
          callback();
        })
      },*/
      function (callback) {
        logModule.find({oid:id,table:"blog"},{column:"timestamp",desc :true},function(err,result) {
          if (err) return callback(err);
          changes = result;

          callback();
        });
      }],
      function (err) {
        should.exist(res.rendervar);
        if (clearParams) {
          var url = config.getValue('htmlroot')+"/blog/"+blog.name;
          var styleParam = "";
          if (req.param.style) styleParam = "?style="+styleParam;
          res.redirect(url+styleParam);
          return;
        }
        if (err) return next(err);
        res.render('blog',{layout:res.rendervar.layout,
                           main_text:main_text,
                           blog:blog,
                           changes:changes,
                           articles:articles,
                           style:style,
                           left_lang:options.left_lang,
                           right_lang:options.right_lang,
                           categories:blog.getCategories()});
      }
    );
  });
}
 

 function renderBlogStat(req, res, next) {
  debug('renderBlogStat');

  var id = req.params.blog_id;
 
  findBlogByRouteId(id,req.user,function(err,blog) {
    if (err) return next(err);
    should.exist(blog);
    id = blog.id;
    var name = blog.name;
    var logs ={};
    var editors = {};

 
    async.series([
      function readLogs(callback) {
        debug("readLogs");
        logModule.countLogsForBlog(name,function(err,result) {
          debug('countLogsForBlog Function');
          logs = result;
          debug(JSON.stringify(logs));
          if (err) return callback(err);
      
          callback();
        });
      }, function calculateEditors(callback) {
        var addEditors = function (property,min) {  
          for (var user in logs[property]) {
            if (logs[property][user]>=min) {
              if (editors[lang].indexOf(user)<0) {
                editors[lang].push(user);
              }
            }
          }
        };
        for (var i=0;i<config.getLanguages().length;i++) {
          var lang = config.getLanguages()[i];
          editors[lang]=[];
          addEditors("collection",3);
          addEditors("markdown"+lang,2);
          addEditors("review"+lang,1);
          editors[lang].sort();
        }
        callback();
      }
      ],
      function (err) {
        should.exist(res.rendervar);
        if (err) return next(err);
        res.render('blogstat',{layout:res.rendervar.layout,
                           logs:logs,
                           blog:blog,
                           editors:editors,
                           languages:config.getLanguages()});
      }
    );
  });
}


function renderBlogList(req, res, next) {
  debug('router.get /list');
  var status = req.query.status;
  var query = {};
  var additionalText;

  if (typeof(status)!='undefined') {
    query.status = status;
    if (status == "IN('open','edit')") {
      additionalText = help.getText( "blog.list.notClosed.md");
    }
  }


  async.auto({
        blogs:function(callback) {
                 blogModule.find(query,{column:"name",desc:true},function(err,blogs) {
                 callback(err,blogs);
              });},
        count:["blogs",function(callback,result) {
                  async.each(result.blogs,function(item,cb){
                    async.parallel([
                      item.calculateDerived.bind(item,req.user),
                      item.calculateTimeToClose.bind(item)
                    ],function finalFunction(err){return cb(err);});
                  },function(err){
                    callback(err);
                  }); }]
      },function(err,result) {
          should.exist(res.rendervar);
          if (err) return next(err);
          res.render('bloglist',{layout:res.rendervar.layout,
                                additionalText:additionalText,
                                blogs:result.blogs});
        });
}

function renderBlogPreview(req, res, next) {
  debug('renderBlogPreview');
  req.session.articleReturnTo = req.originalUrl;

  var id = req.params.blog_id;

  findBlogByRouteId(id,req.user,function(err,blog) {
    if (err) return next(err);
    should.exist(blog);


    var lang = req.query.lang;
    if (typeof(lang)=='undefined') lang = "DE";
    var options = settingsModule.getSettings(lang);
    var markdown = options.markdown;

    var returnToUrl = req.session.articleReturnTo;

    if (blog.status == "help") {
      returnToUrl = res.rendervar.layout.htmlroot + "/blog/"+blog.id;
    }





    async.auto({ 
        converter:function(callback) {
                      debug("converter function");
                      blog.getPreview(lang,function(err,result) {
                        
                        return callback(err,result);
                      });
                  }
      },
      function(err,result) {
        debug("final function");
        if (req.query.download=="true") {
          
          
          if (markdown) {
            res.setHeader('Content-disposition', 'attachment; filename=' + blog.name+'('+lang+')'+moment().locale(lang).format()+".md");
            res.setHeader('Content-type', "text");
            res.end(result.converter.preview,"UTF8");
          } else {
            res.setHeader('Content-disposition', 'attachment; filename=' + blog.name+'('+lang+')'+moment().locale(lang).format()+".html");
            res.setHeader('Content-type', "text/html");
            res.end(result.converter.preview,"UTF8");            
          }
          return;
        } else {
          should.exist(res.rendervar);

         
          res.render('blogpreview',{layout:res.rendervar.layout,
                             blog:blog,
                             articles:result.converter.articles,
                             preview:result.converter.preview,
                             markdown: markdown,
                             lang:lang,
                             left_lang:req.user.left_lang,
                             right_lang:req.user.right_lang,
                             returnToUrl:returnToUrl,
                             categories:blog.getCategories()});
        }
      }
    );
  });
}

function renderBlogTab(req, res, next) {
  debug('renderBlogPreviewAndEdit');

  var id = req.params.blog_id;
  var tab = req.query.tab;


  if (!tab) tab = req.session.lasttab;
  if (!tab) tab = "Overview";


  findBlogByRouteId(id,req.user,function(err,blog) {
    if (err) return next(err);
    should.exist(blog);

    var lang = req.user.getMainLang();
    if (typeof(lang)=='undefined') lang = "DE";


   let clearParams=false;


    async.auto({
        dataCollect:function(callback) {
          debug("converter function");
          blog.getPreviewData({lang:lang,collectors:true},function(err,result) {
            return callback(err,result);
          });
        },
        review: function (callback) {
          if (typeof(req.query.reviewComment)!='undefined')
          {
            clearParams = true;
            blog.setReviewComment(lang,req.user,req.query.reviewComment,function(err) {
              return callback(err);
            });
          } else return callback();
        },
        setStatus: function (callback) {
          if (typeof(req.query.setStatus)!='undefined')
          {
            clearParams = true;
            var changes = {status:req.query.setStatus};
            blog.setAndSave(req.user,changes,function(err) {
              if (err) return callback(err);
              let referer=req.header('Referer') || '/';
              res.redirect(referer);
            });
          } else return callback();
        }


      },
      function(err,result) {
        debug("final function");
        should.exist(res.rendervar);
        if (clearParams) {
          var url = config.getValue('htmlroot')+"/blog/"+blog.name;
          var styleParam = "";
          if (req.param.style) styleParam = "?style="+styleParam;
          res.redirect(url+styleParam);
          return;
        }

        var renderer = new blogRenderer.HtmlRenderer(blog);


        res.render('blog_'+tab.toLowerCase(),{layout:res.rendervar.layout,
            blog:blog,
            articles:result.dataCollect.articles,
            futureArticles:result.dataCollect.futureArticles,
            teamString:result.teamString,
            lang:lang,
            tab:tab,
            left_lang:req.user.getMainLang(),
            right_lang:req.user.getSecondLang(),
            renderer:renderer,
            categories:blog.getCategories()});
        }
      );
  });
}

function createBlog(req, res, next) {
  debug('router.get /create');

  blogModule.createNewBlog(req.user,function(err) {
    if (err) return next(err);
    res.redirect(config.getValue('htmlroot')+'/blog/list?status=open');
    //res.render('bloglist',{blogs:blogs,user:req.user});
  });
}

function editBlogId(req,res,next) {
  debug('editBlogId');
  var id = req.params.blog_id;
  var params = {};
  if (req.query.edit) params.edit = req.query.edit;
  if (params.edit && params.edit=="false") {
     res.redirect(config.getValue('htmlroot')+"/blog/edit/"+id);  
  }
  findBlogByRouteId(id,req.user,function(err,blog) {
    if (err) return next(err);
    should.exist(blog);
    should.exist(res.rendervar);
    res.render('editblog',{layout:res.rendervar.layout,
                       blog:blog,
                       params:params,
                       categories:blog.getCategories()});
  });
}

function postBlogId(req, res, next) {
  debug('postBlogId');
  var id = req.params.blog_id;
  findBlogByRouteId(id,req.user,function(err,blog) {
    if (err) return next(err);
    should.exist(blog);
    var categories;
    try {
      categories = JSON.parse(req.body.categories);      
    } catch (err) {
      return next(err);
    }
    var changes = {name:req.body.name,
                   startDate:req.body.startDate,
                   endDate:req.body.endDate,
                   status:req.body.status,
                   markdownImage:req.body.markdownImage,
                   categories:categories};
    blog.setAndSave(req.user,changes,function(err) {
      if (err) {
        return next(err);
      }
      res.redirect(config.getValue('htmlroot')+"/blog/edit/"+id);    
    });
  });
}


router.get ('/edit/:blog_id',editBlogId);
router.post('/edit/:blog_id',postBlogId);
router.get('/create', createBlog);
router.get('/list', renderBlogList);
router.get('/:blog_id', renderBlogId);
router.get('/:blog_id/stat', renderBlogStat);
router.get('/:blog_id/previewNEdit',renderBlogTab);
router.get('/:blog_id/:tab', renderBlogPreview);
router.get('/:blog_id/preview_:blogname_:downloadtime', renderBlogPreview);
//router.post('/edit/:blog_id',postBlogId);

module.exports.router = router;


// the following modules are exported for test reasons
module.exports.renderBlogPreview = renderBlogPreview;
module.exports.renderBlogId = renderBlogId;


