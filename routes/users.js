var express = require('express');
var should = require('should');
var async = require('async');
var userModule = require('../model/user.js');
var debug = require('debug')('OSMBC:routes:users');
var router = express.Router();
var logModule = require('../model/logModule.js');
var settingsModule = require('../model/settings.js');
var config = require('../config.js');
var request = require('request');


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
  debug('router.get');
  var id = req.params.user_id;
  should.exist(id);
  var params = {};
  if (req.query.edit) params.edit = req.query.edit;
  if (req.query.numberconfig) params.numberconfig = req.query.numberconfig;
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
      var i;
      userModule.findById(id,function findAndLoaduser_CB(err,result) {
        debug('findAndLoaduser_CB');
        if (err) return cb(err);
        user = result;

        if (!params.numberconfig) {
          params.numberconfig = 3; 
          for (i =0;i<99;i++) {
            if (user && typeof(user["blogSetting"+i])== 'undefined') break;
            if (user &&(user["blogSetting"+i])!= '-') {
              params.numberconfig=i;
            }
          }
        } else {
          for (i =0;i<=params.numberconfig;i++) {
             if (typeof(user["blogSetting"+i])== 'undefined') user["blogSetting"+i]="-";
          }
        }
        cb();
      });
    }
    ],
    function finalRenderCB(err) {
      debug('finalRenderCB');
      if (err) return next(err);
      if (! user || typeof(user.id) == 'undefined') return next(new Error("User ID not Found"));
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
                 access:req.body.access};
  async.series([
    function getPublicAuthor(cb) {
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
        userModule.findById(id,function(err,user) {
          if (typeof(user.id) == 'undefined') return next();
         
         
          for (var i =0;i<15;i++) {
            if (req.body["blogSetting"+i]) {
              changes["blogSetting"+i] = req.body["blogSetting"+i];
              changes["blogLanguages"+i] = req.body["blogLanguages"+i];
            }
          }

          user.setAndSave(req.user.displayName,changes,function(err) {
            if (err) {
              return next(err);
            }
            res.redirect(config.getValue('htmlroot')+"/usert/"+id);    
          });
        });      
    }

    ],function(){return;})

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

module.exports.createUser = createUser;
module.exports.postUserId = postUserId;
module.exports.renderUserId = renderUserId;
module.exports.renderList = renderList;

module.exports.router = router;
