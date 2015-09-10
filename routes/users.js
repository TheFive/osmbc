var express = require('express');
var async = require('async');
var userModule = require('../model/user.js');
var debug = require('debug')('OSMBC:router:users');
var router = express.Router();
var util = require('../util.js');
var moment = require('moment');
var articleModule = require('../model/article.js');
var logModule = require('../model/logModule.js');


function renderList(req,res,next) {
  debug('renderList');
  var listOfOrphanBlog;
  var users;
  var query = {};
  if (req.query.access) query.access = req.query.access;
  async.parallel([
     function (callback) {
        articleModule.getListOfOrphanBlog(function(err,result) {
          listOfOrphanBlog = result;
          callback();
        })
      },
      function(callback) {
        userModule.find(query,{column:"displayName"},function(err,result) {
          users = result;
          callback();
        })
      }

    ],function(error) {
        res.render('userList',{users:users,
                                  listOfOrphanBlog:listOfOrphanBlog,
                                  util:util,
                                  moment:moment,
                                  user:req.user});      
    }
  )

}



router.get('/:user_id', function(req, res, next) {
  debug('router.get');
  var id = req.params.user_id;
  var params = {};
  if (req.query.edit) params.edit = req.query.edit;
  var user;
  var changes;
  async.parallel([
    function findAndLoaduser(cb){
      userModule.findById(id,function(err,result) {
        if (err) return cb(err);
        user = result;
        cb();
      })
    },
    function findAndLoadChanges(cb) {
      logModule.find({table:"usert",oid:id},{column:"timestamp",desc:true},function(err,result){
        if (err) return cb(err);
        changes = result;
        cb();
      })
    }
    ],
    function finalRenderCB(err) {
      if (err) return next(err);
      if (! user || typeof(user.id) == 'undefined') return next();
      res.render('user',{usershown:user,changes:changes,params:params,user:req.user,moment:moment,util:util});
    }
  )
});

function postUserId(req, res, next) {
  debug('postUserId');
  var id = req.params.user_id;
  userModule.findById(id,function(err,user) {
    if (typeof(user.id) == 'undefined') return next();
    var changes = {OSMUser:req.body.OSMUser,
                   access:req.body.access};

    user.setAndSave(req.user.displayName,changes,function(err) {
      if (err) {
        return next(err);
      }
      res.redirect("/users/"+id);    
    })
  });
}

function createUser(req, res, next) {
  debug('createUser');
  var proto = {};
  userModule.createNewUser(proto,function(err,user) {
    res.redirect('/users/'+user.id+"?edit=true");
  });
};

router.get('/list',renderList);
router.post('/:user_id', postUserId);
router.get('/create',createUser);

module.exports.createUser = createUser;
module.exports.postUserId = postUserId;



module.exports.router = router;
