var express = require('express');
var async = require('async');
var userModule = require('../model/user.js');
var debug = require('debug')('OSMBC:router:users');
var router = express.Router();
var util = require('../util.js');
var articleModule = require('../model/article.js');


function renderList(req,res,next) {
  debug('renderList');
  var listOfOrphanBlog;
  var users;
  async.parallel([
     function (callback) {
        articleModule.getListOfOrphanBlog(function(err,result) {
          listOfOrphanBlog = result;
          callback();
        })
      },
      function(callback) {
        userModule.find({},{column:"displayName"},function(err,result) {
          users = result;
          callback();
        })
      }

    ],function(error) {
        res.render('userList',{users:users,
                                  listOfOrphanBlog:listOfOrphanBlog,
                                  util:util,
                                  user:req.user});      
    }
  )

}


/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

router.get('/list',renderList);

module.exports = router;
