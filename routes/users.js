"use strict";

var should   = require('should');
var async    = require('async');
var debug = require('debug')('OSMBC:routes:users');


var express    = require('express');
var router     = express.Router();
var request = require('request');


var config = require('../config.js');

var userModule = require('../model/user.js');
var logModule = require('../model/logModule.js');
var blogRenderer = require('../render/BlogRenderer.js');




function renderList(req,res,next) {  
  debug('renderList');
  var users;
  var query = {};
  var sort = {column:"OSMUser"};
  if (req.query.access) query.access = req.query.access;
  if (req.query.sort) sort.column = req.query.sort;
  if (req.query.desc) sort.desc = true; 
  if (req.query.lastAccess) query.lastAccess = req.query.lastAccess;

  async.parallel([
      function(callback) {
        userModule.find(query,sort,function(err,result) {
          if (err) return callback(err);
          users = result;
          async.each(users,function (item,eachcb){
            item.calculateChanges(eachcb);
          },function(err){
            return callback(err);
          });
        });
      }
    ],function(error) { 
        if (error) return next(error);
        should.exist(res.rendervar);
        res.set('content-type', 'text/html');
        res.render('userList',{layout:res.rendervar.layout,query:query,
                                users:users});      
    }
  );
}



function renderUserId(req, res, next) {
  debug('renderUserId');
  let redirect = false;
  var id = req.params.user_id;
  if (id === "self") res.redirect(res.rendervar.layout.htmlroot+"/usert/"+req.user.id);
  should.exist(id);
  var params = {};
  var user;
  var changes;
  var userHeatMapArray=null;
  async.series([
    function findAndLoadChanges(cb) {
      debug('findAndLoadChanges');
      logModule.find({table:"usert",oid:id},{column:"timestamp",desc:true},function findAndLoadChanges_CB(err,result){
        debug('findAndLoadChanges_CB');
        if (err) return cb(err);
        changes = result;
        cb();
      });
    },
    function findAndLoaduser(cb){
      debug('findAndLoaduser');
      userModule.findById(id,function findAndLoaduser_CB(err,result) {
        debug('findAndLoaduser_CB');
        if (err) return cb(err);
        user = result;
        if (! user || typeof(user.id) == 'undefined') return cb(new Error("User ID >"+id+"< Not Found"));
        if (req.query.validation) {
          user.validateEmail(req.user,req.query.validation,function (err){
            if (err) return cb(err);
            redirect = true;
            res.redirect(res.rendervar.layout.htmlroot+"/usert/"+user.id);
            return cb();
          });
        } else cb();
      });
    },
    function findAndLoadHeatCalendarData(cb) {
      debug('findAndLoadHeatCalendarData');
      logModule.countLogsForUser(user.OSMUser,function(err,result){
        if (err) console.log(err);
        userHeatMapArray = result;
        cb(null,result);
      });
    }
    ],
    function finalRenderCB(err) {
      debug('finalRenderCB');
      if (err) return next(err);
      if (redirect) return;
      should.exist(res.rendervar);
      res.set('content-type', 'text/html');
      res.render('user',{usershown:user,
                        changes:changes,
                        params:params,
                        userHeatMapArray:userHeatMapArray,
                        langlist: config.getLanguages(),
                        layout:res.rendervar.layout});
    }
  ) ;
}

function postUserId(req, res, next) {
  debug('postUserId');
  var id = req.params.user_id;
  var changes = {OSMUser:req.body.OSMUser,
                 SlackUser:req.body.SlackUser,
                 WNAuthor:req.body.WNAuthor,
                 WeeklyAuthor:req.body.WeeklyAuthor,
                 color:req.body.color,
                 language:req.body.language,
                 mailAllComment:req.body.mailAllComment,
                 mailNewCollection:req.body.mailNewCollection,
                 mailComment:req.body.mailComment,
                 mailBlogLanguageStatusChange:req.body.mailBlogLanguageStatusChange,
                 mailCommentGeneral:req.body.mailCommentGeneral,
                 email:req.body.email,
                 access:req.body.access};

  if (typeof(changes.mailComment)==="string") {
    changes.mailComment = [changes.mailComment];
  }
  if (typeof(changes.mailComment)==="undefined") {
    changes.mailComment = [];
  }
  if (typeof(changes.mailBlogLanguageStatusChange)==="string") {
    changes.mailBlogLanguageStatusChange = [changes.mailBlogLanguageStatusChange];
  }
  if (typeof(changes.mailBlogLanguageStatusChange)==="undefined") {
    changes.mailBlogLanguageStatusChange = [];
  }
  var user;
  async.series([
    function findUser(cb) {
      debug("findUser");
      userModule.findById(id,function(err,result) {
        user = result;
        debug("findById");
        if (typeof(user.id) == 'undefined') return cb(new Error("User ID >"+id+"< Not Found"));
        return cb();
      });
    },
    function getPublicAuthor(cb) {
      debug("getPublicAuthor");
      if (!changes.WNAuthor) return cb();
      if (changes.WNAuthor === user.WNAuthor) return cb();
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
      request('https://blog.openstreetmap.de/blog/author/'+changes.WNAuthor, function(error,response,body) {
        changes.WNPublicAuthor = "Not Found"; 
        if (error) return cb();
        if (response.statusCode != 200) return cb();
         if (body.indexOf('<title>')<0 ) return cb();
        var start = body.indexOf('<title>')+7;
        var end = body.indexOf('</title>');
        var s = body.substring(start,end);
        if (s.indexOf("|")>=0) {
          s= s.substring(0,s.indexOf("|"));
          s=s.trim();
        }
        changes.WNPublicAuthor = s;
        return cb();
            
      });

    }, function saveUser(cb) {
      user.setAndSave(req.user.displayName,changes,function(err) {
        debug("setAndSaveCB");
        cb(err);
      });
    }

    ],function(err){
      if (err) return next(err);
      res.redirect(config.getValue('htmlroot')+"/usert/"+id);    
  
    });

}

function inbox (req,res) {
  debug("inbox");
  var renderer = new blogRenderer.HtmlRenderer(null);
  req.session.articleReturnTo = req.originalUrl;
  res.set('content-type', 'text/html');
  res.render("inbox",{layout:res.rendervar.layout,renderer:renderer});
}

function createUser(req, res, next) {
  debug('createUser');
  var proto = {};
  userModule.createNewUser(proto,function(err,user) {
    if (err) return next(err);
    res.redirect(config.getValue('htmlroot')+'/usert/'+user.id+"?edit=true");
  });
}



router.get('/inbox',inbox);
router.get('/list',renderList);
router.get('/create',createUser);
router.get('/:user_id',renderUserId);
router.post('/:user_id', postUserId);

module.exports.createUser   = createUser;
module.exports.postUserId   = postUserId;
module.exports.renderUserId = renderUserId;
module.exports.renderList   = renderList;

module.exports.router = router;
