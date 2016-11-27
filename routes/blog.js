"use strict";

var express  = require('express');
var router   = express.Router();
var async    = require('async');
var should   = require('should');
var debug    = require('debug')('OSMBC:routes:blog');
var config   = require('../config.js');
var moment   = require('moment');
var help     = require('../routes/help.js');
var yaml     = require('js-yaml');
var configModule = require('../model/config.js');

var BlogRenderer   = require('../render/BlogRenderer.js');

var blogModule     = require('../model/blog.js');
var blogRenderer   = require('../render/BlogRenderer.js');
var logModule      = require('../model/logModule.js');
var userModule     = require('../model/user.js');


// Internal Function to find a blog by an ID
// it accepts an internal Blog ID of OSMBC and a blog name
// Additional the fix blog name TBC is recognised.
function findBlogByRouteId(id,user,callback) {
  debug("findBlogByRouteId(%s)",id);
  var blog;
  should(typeof(user)).eql('object');
  should(typeof(callback)).eql('function');

  async.series([
    function CheckTBC(cb) {
      // check and return TBC Blog.
      debug("findBlogByRouteId->CheckTBC");
      if (id === "TBC") {
        blog = blogModule.getTBC();
      }
      return cb();
    },
    function findID(cb) {
      debug("findBlogByRouteId->findID");
      // Check and return blog by ID
      blogModule.findById(id,function(err,r) {
        if (err) return cb(err);
        if (r) blog= r;
        return cb();
      });
    },
  function findByName(cb) {
    debug("findBlogByRouteId->findByName");
    // Check and return blog by name
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
    // start calculation of derived fields for the current user.
    // these fields are stored in an temporary _xxx field in the blog object
    if (blog) return blog.calculateDerived(user,cb);
    return cb();
  }], function(err) {
    debug("findBlogByRouteId->final function");
    if (err) return callback(err);
    callback(null,blog);
  });
}

function findBlogId(req,res,next,id) {
  debug('findBlogId');
  findBlogByRouteId(id,req.user,function(err,result) {
    if (err) return next(err);
    req.blog = result;
    return next();
  });
}


function renderBlogStat(req, res, next) {
  debug('renderBlogStat');
  let blog = req.blog;
  if (!blog) return next();

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
      res.set('content-type', 'text/html');
      res.rendervar.layout.title = blog.name+"/statistic";
      res.render('blogstat',{layout:res.rendervar.layout,
                         logs:logs,
                         blog:blog,
                         editors:editors,
                         languages:config.getLanguages()});
    }
  );
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
          res.set('content-type', 'text/html');
          res.rendervar.layout.title = "blog/list";
          res.render('bloglist',{layout:res.rendervar.layout,
                                additionalText:additionalText,
                                blogs:result.blogs});
        });
}




function renderBlogPreview(req, res,next) {
  debug('renderBlogPreview');
  req.session.articleReturnTo = req.originalUrl;
  let blog = req.blog;
  if (!blog) return next();


  var lang = req.query.lang;
  var asMarkdown = (req.query.markdown==="true");
  if (typeof(lang)=='undefined') lang = "DE";
  if (config.getLanguages().indexOf(lang)<0) lang = "DE";


  var returnToUrl = req.session.articleReturnTo;






  async.auto({
      converter:function(callback) {
                    debug("converter function");
                    blog.getPreviewData({lang:lang,createTeam:true,disableNotranslation:true,warningOnEmptyMarkdown:true},function(err,data) {
                      if (err) return callback(err);
                      let renderer=new BlogRenderer.HtmlRenderer(blog);
                      if (asMarkdown) renderer = new BlogRenderer.MarkdownRenderer(blog);
                      let result = renderer.renderBlog(lang,data);
                      return callback(null,result);
                    });
                }
    },
    function(err,result) {
      debug("renderBlogPreview->final function");
      if (err) return next(err);
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
      } else {
        should.exist(res.rendervar);
        res.rendervar.layout.title = blog.name+"/preview";
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
}

function setReviewComment(req,res,next) {
  debug('setReviewComment');

  var lang = req.body.lang;
  var user = req.user;
  var data = req.body.text;


  if (!req.blog) return next();
  req.blog.setReviewComment(lang,user,data,function(err){
    if (err) return next(err);
    let referer=req.header('Referer') || '/';
    res.redirect(referer);
  });
}

function editReviewComment(req,res,next) {
  debug('editReviewComment');

  var lang = req.body.lang;
  var user = req.user;
  var data = req.body.text;
  var index = req.params.index;


  if (!req.blog) return next();
  req.blog.editReviewComment(lang,user,index,data,function(err){
    if (err) return next(err);
    let referer=req.header('Referer') || '/';
    res.redirect(referer);
  });
}

function setBlogStatus(req,res,next) {
  debug('setBlogStatus');

  var lang = req.body.lang;
  var user = req.user;
  if (!req.blog) return next();

  function finalFunction(err) {
    if (err) return next(err);
    let referer=req.header('Referer') || '/';
    res.redirect(referer);
  }

  // Start Review
  if (req.body.action=="startreview") {
    return req.blog.setReviewComment(lang,user,"startreview",finalFunction);
  }
  // Mark Exported
  if (req.body.action=="markexported") {
    return req.blog.setReviewComment(lang,user,"markexported",finalFunction);
  }

  // Close Language
  if (req.body.action=="closelang") {
    return req.blog.closeBlog(lang,user,true,finalFunction);
  }
  // reopen Language
  if (req.body.action=="editlang") {
    return req.blog.closeBlog(lang,user,false,finalFunction);
  }
  return next(new Error("Unkown Status Combination, Please Contact the Author"));
}

function renderBlogTab(req, res,next) {
  debug('renderBlogTab');

  let blog = req.blog;
  if (!blog) return next();
  var tab = req.query.tab;
  var votes = configModule.getConfig("votes");

  if (!tab) tab = req.session.lasttab;
  if (!tab) tab = "Overview";

  req.session.lasttab = tab;
  
  if (req.params.blog_id === "TBC") tab = "TBC";

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
          return callback(new Error("?reviewComment= parameter is not supported any longer"));
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
          return callback(new Error("?closelang= parameter is not supported any longer"));
        } else return callback();
      }


    },
    function(err,result) {
      debug("renderBlogTab->final function");
      if(err) return next(err);
      should.exist(res.rendervar);
      if (clearParams) {
        var url = config.getValue('htmlroot')+"/blog/"+blog.name;
        var styleParam = "";
        if (req.param.style) styleParam = "?style="+styleParam;
        res.redirect(url+styleParam);
        return;
      }

      var renderer = new blogRenderer.HtmlRenderer(blog);
      res.rendervar.layout.title = blog.name+"/"+tab.toLowerCase();
      res.render('blog_'+tab.toLowerCase(),{layout:res.rendervar.layout,
          blog:blog,
          articles:result.dataCollect.articles,
          futureArticles:result.dataCollect.futureArticles,
          teamString:result.teamString,
          userMap:result.userMap,
          lang:lang,
          tab:tab,
          votes:votes,
          left_lang:req.user.getMainLang(),
          right_lang:req.user.getSecondLang(),
          renderer:renderer,
          categories:blog.getCategories()});
      }
    );
}

function createBlog(req, res, next) {
  debug('createBlog');

  blogModule.createNewBlog(req.user,function(err) {
    if (err) return next(err);
    res.redirect(config.getValue('htmlroot')+'/blog/list?status=open');
    //res.render('bloglist',{blogs:blogs,user:req.user});
  });
}

function editBlogId(req,res) {
  debug('editBlogId');
  var blog = req.blog;
  should.exist(res.rendervar);
  should.exist(blog);
  var params = {};
  if (req.query.edit) params.edit = req.query.edit;
  if (params.edit && params.edit=="false") {
     res.redirect(config.getValue('htmlroot')+"/blog/edit/"+req.params.blog_id);
  }
  blog._categories_yaml = yaml.safeDump(blog.categories);
  res.set('content-type', 'text/html');
  res.render('editblog',{layout:res.rendervar.layout,
                     blog:blog,
                     params:params,
                     categories:blog.getCategories()});

}

function postBlogId(req, res, next) {
  debug('postBlogId');
  var blog = req.blog;
  if (!blog) return next();

  var categories;
  try {
    categories = yaml.load(req.body.categories_yaml);
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
    res.redirect(config.getValue('htmlroot')+"/blog/edit/"+req.params.blog_id);
  });
}




router.param("blog_id",findBlogId);
router.route('/edit/:blog_id')
  .get(editBlogId)
  .post(postBlogId);
router.post('/:blog_id/setReviewComment',setReviewComment);
router.post('/:blog_id/editReviewComment/:index',editReviewComment);
router.post('/:blog_id/setLangStatus',setBlogStatus);


router.get('/create', createBlog);
router.get('/list', renderBlogList);
router.get('/:blog_id', renderBlogTab);
router.get('/:blog_id/stat', renderBlogStat);
router.get('/:blog_id/preview', renderBlogPreview);
router.get('/:blog_id/:tab', renderBlogTab);
router.get('/:blog_id/preview_:blogname_:downloadtime', renderBlogPreview);



module.exports.router = router;


// the following modules are exported for test reasons
module.exports.renderBlogPreview = renderBlogPreview;
module.exports.renderBlogTab = renderBlogTab;


