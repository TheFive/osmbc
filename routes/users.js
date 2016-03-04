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
var settingsModule = require('../model/settings.js');




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
          users = result;
          callback();
        });
      }

    ],function(error) { 
        if (error) return next(error);
        should.exist(res.rendervar);
        res.render('userList',{layout:res.rendervar.layout,
                                users:users});      
    }
  );
}



function renderUserId(req, res, next) {
  debug('renderUserId');
  var id = req.params.user_id;
  should.exist(id);
  var params = {};
  var user;
  var changes;
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
        if (! user || typeof(user.id) == 'undefined') return cb(new Error("User ID not Found"));
        if (req.query.validation) {
          user.validateEmail(req.user,req.query.validation,function (err){
            if (err) return cb(err);
            res.redirect(res.rendervar.layout.htmlroot+"/usert/"+user.id);
            return cb();
          });
        } else cb();
      });
    }
    ],
    function finalRenderCB(err) {
      debug('finalRenderCB');
      if (err) return next(err);
      should.exist(res.rendervar);
      res.render('user',{usershown:user,
                        changes:changes,
                        params:params,
                        langlist: config.getLanguages(),
                        settings:settingsModule.listSettings,
                        languages:settingsModule.listLanguages,
                        layout:res.rendervar.layout});
    }
  ) ;
}

function postUserId(req, res, next) {
  debug('postUserId');
  var id = req.params.user_id;
  var changes = {OSMUser:req.body.OSMUser,
                 WNAuthor:req.body.WNAuthor,
                 WeeklyAuthor:req.body.WeeklyAuthor,
                 language:req.body.language,
                 mailAllComment:req.body.mailAllComment,
                 mailNewCollection:req.body.mailNewCollection,
                 mailComment:req.body.mailComment,
                 mailBlogLanguageStatusChange:req.body.mailBlogLanguageStatusChange,
                 email:req.body.email,
                 access:req.body.access};
  if (typeof(changes.mailComment)==="string") {
    changes.mailComment = [changes.mailComment];
  }
  if (typeof(changes.mailBlogLanguageStatusChange)==="string") {
    changes.mailBlogLanguageStatusChange = [changes.mailBlogLanguageStatusChange];
  }
  async.series([
    function getPublicAuthor(cb) {
      debug("getPublicAuthor");
      if (!changes.WNAuthor) return cb();
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

    }, function findUser(cb) {
      debug("findUser");
        userModule.findById(id,function(err,user) {
          debug("findById");
          if (typeof(user.id) == 'undefined') return next();
         
         
          for (var i =0;i<15;i++) {
            if (req.body["blogSetting"+i]) {
              changes["blogSetting"+i] = req.body["blogSetting"+i];
              changes["blogLanguages"+i] = req.body["blogLanguages"+i];
            }
          }
          user.setAndSave(req.user.displayName,changes,function(err) {
            debug("setAndSaveCB");
            cb(err);
          });
        });      
    }

    ],function(err){
      if (err) return next(err);
      res.redirect(config.getValue('htmlroot')+"/usert/"+id);    
  
    });

}

function createUser(req, res, next) {
  debug('createUser');
  var proto = {};
  userModule.createNewUser(proto,function(err,user) {
    if (err) return next(err);
    res.redirect(config.getValue('htmlroot')+'/usert/'+user.id+"?edit=true");
  });
}

router.get('/list',renderList);
router.get('/create',createUser);
router.get('/:user_id',renderUserId);
router.post('/:user_id', postUserId);

module.exports.createUser   = createUser;
module.exports.postUserId   = postUserId;
module.exports.renderUserId = renderUserId;
module.exports.renderList   = renderList;

module.exports.router = router;
