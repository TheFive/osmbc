"use strict";

var express  = require('express');
var router   = express.Router();
var async    = require('async');
var should   = require('should');
var debug    = require('debug')('OSMBC:routes:blog');
var config   = require('../config.js');
var moment   = require('moment');
var help     = require('../routes/help.js');

var BlogRenderer   = require('../render/BlogRenderer.js');

var blogModule     = require('../model/blog.js');
var blogRenderer   = require('../render/BlogRenderer.js');
var logModule      = require('../model/logModule.js');
var userModule     = require('../model/user.js');

function findBlogByRouteId(id,user,callback) {
  debug("findBlogByRouteId");
  var blog;
  should(typeof(user)).eql('object');
  should(typeof(callback)).eql('function');

  async.series([
    function CheckTBC(cb) {
      debug("findBlogByRouteId->CheckTBC");
      if (id === "TBC") {
        blog = blogModule.getTBC();
      }
      return cb();
    },
    function findID(cb) {
      debug("findBlogByRouteId->findID");
      blogModule.findById(id,function(err,r) {
        if (err) return cb(err);
        if (r) blog= r;
        return cb();
      });
    },
  function findByName(cb) {
    debug("findBlogByRouteId->findByName");
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
    debug("findBlogByRouteId->countItems");
    if (blog) return blog.calculateDerived(user,cb);
    return cb();
  }], function(err) {
    debug("findBlogByRouteId->final function");
    if (err) return callback(err);
    if (!blog) return callback(new Error("Blog >"+id+"< not found"));
    callback(null,blog);
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
  debug('renderBlogList');
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
    var asMarkdown = (req.query.markdown==="true");
    if (typeof(lang)=='undefined') lang = "DE";
    if (config.getLanguages().indexOf(lang)<0) lang = "DE";


    var returnToUrl = req.session.articleReturnTo;






    async.auto({ 
        converter:function(callback) {
                      debug("converter function");
                      blog.getPreviewData({lang:lang,createTeam:true,disableNotranslation:true},function(err,data) {

                        let renderer=new BlogRenderer.HtmlRenderer(blog);
                        if (asMarkdown) renderer = new BlogRenderer.MarkdownRenderer(blog);
                        let result = renderer.renderBlog(lang,data);
                        return callback(err,result);
                      });
                  }
      },
      function(err,result) {
        debug("renderBlogPreview->final function");
        console.log("Start Rendering1");
        if (req.query.download=="true") {
          if (asMarkdown) {
            res.setHeader('Content-disposition', 'attachment; filename=' + blog.name+'('+lang+')'+moment().locale(lang).format()+".md");
            res.setHeader('Content-type', "text");

            res.end(result.converter,"UTF8");
          } else {
            res.setHeader('Content-disposition', 'attachment; filename=' + blog.name+'('+lang+')'+moment().locale(lang).format()+".html");
            res.setHeader('Content-type', "text/html");
            res.end(result.converter,"UTF8");
          }
          return;
        } else {
          should.exist(res.rendervar);

          console.log("Start Rendering2");

         
          res.render('blogpreview',{layout:res.rendervar.layout,
                             blog:blog,
                             asMarkdown:asMarkdown,
                             preview:result.converter,
                             lang:lang,
                             returnToUrl:returnToUrl,
                             categories:blog.getCategories()});
        }
      }
    );
  });
}

function renderBlogTab(req, res, next) {
  debug('renderBlogTab');

  var id = req.params.blog_id;
  var tab = req.query.tab;


  if (!tab) tab = req.session.lasttab;
  if (!tab) tab = "Overview";

  req.session.lasttab = tab;
  
  if (id === "TBC") tab = "TBC";

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
        userMap:function(callback){
          debug("userColors");
          let userMap = {};
          userModule.find({},function(err,userlist){
            if (err) return callback(err);
            for (let i=0;i<userlist.length;i++) {
              userMap[userlist[i].OSMUser]=userlist[i];
            }
            return callback(null,userMap);
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
        },
        closeLang: function (callback) {
          if (typeof(req.query.closeLang)!='undefined')
          {
            clearParams = true;
            var status = true;
            if (req.query.status && req.query.status == "false") status = false;
            blog.closeBlog(lang,req.user,status,function(err) {
              return callback(err);
            });
          } else return callback();
        }


      },
      function(err,result) {
        debug("renderBlogTab->final function");
        should.exist(res.rendervar);
        if (clearParams) {
          var url = config.getValue('htmlroot')+"/blog/"+blog.name;
          var styleParam = "";
          if (req.param.style) styleParam = "?style="+styleParam;
          res.redirect(url+styleParam);
          return;
        }

        var renderer = new blogRenderer.HtmlRenderer(blog);

        console.log("Rendering: "+'blog_'+tab.toLowerCase());

        res.render('blog_'+tab.toLowerCase(),{layout:res.rendervar.layout,
            blog:blog,
            articles:result.dataCollect.articles,
            futureArticles:result.dataCollect.futureArticles,
            teamString:result.teamString,
            userMap:result.userMap,
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
  debug('createBlog');

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
router.get('/:blog_id', renderBlogTab);
router.get('/:blog_id/stat', renderBlogStat);
router.get('/:blog_id/preview', renderBlogPreview);
router.get('/:blog_id/:tab', renderBlogTab);
router.get('/:blog_id/preview_:blogname_:downloadtime', renderBlogPreview);
//router.post('/edit/:blog_id',postBlogId);

module.exports.router = router;


// the following modules are exported for test reasons
module.exports.renderBlogPreview = renderBlogPreview;
module.exports.renderBlogTab = renderBlogTab;


