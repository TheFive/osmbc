"use strict";

var should   = require('should');
var async    = require('async');
var debug    = require('debug')('OSMBC:routes:config');


var express    = require('express');
var router     = express.Router();
var request = require('request');
var yaml  = require('js-yaml');


var config = require('../config.js');

var configModule = require('../model/config.js');
var logModule = require('../model/logModule.js');




function renderList(req,res,next) {  
  debug('renderList');
  var users;
  var query = {};
  var sort = {column:"name"};

  async.parallel([
      function(callback) {
        configModule.find(query,sort,function(err,result) {
          if (err) return callback(err);
          users = result;
        });
      }
    ],function(error) { 
        if (error) return next(error);
        should.exist(res.rendervar);
        res.render('configList',{layout:res.rendervar.layout,query:query,
                                users:users});      
    }
  );
}



function renderConfigName(req, res, next) {
  debug('renderConfigName');
  var name = req.params.name;
  should.exist(name);
  var params = {};
  var config;
  var changes;
  async.series([
    function findConfig(cb) {
      debug('findAndCreateConfig');
      configModule.find({name:name},function(err,result){
        if (err) return cb(err);
        if (result.length==0) return cb();
        config = result[0];
        return cb();
      });
    },
    function createConfig(cb) {
      if (config) return cb();
      configModule.createNewConfig({name:name},function(err,result){
        if (err) return cb(err);
        config = result;
        config.save(cb);
      });
    },
    function findAndLoadChanges(cb) {
      debug('findAndLoadChanges');
      logModule.find({table:"config",oid:config.id},{column:"timestamp",desc:true},function findAndLoadChanges_CB(err,result){
        debug('findAndLoadChanges_CB');
        if (err) return cb(err);
        changes = result;
        cb();
      });
    }
    ],
    function finalRenderCB(err) {
      debug('finalRenderCB');
      if (err) return next(err);
      should.exist(res.rendervar);
      res.render('config',{config:config,
                        changes:changes,
                        params:params,
                        layout:res.rendervar.layout});
    }
  ) ;
}

function postConfigId(req, res, next) {
  debug('postUserId');
  var id = req.params.id;
  var changes = {yaml:req.body.yaml};
  var configData;
  async.series([
    function findUser(cb) {
      debug("findConfig");
      configModule.findById(id,function(err,result) {
        debug("findById");
        configData = result;
        try {
          configData.json = yaml.safeLoad(changes.yaml);
          console.dir(changes.yaml);
          console.dir(configData.json);
        }
        catch(err) {
          return cb(err);
        }
        if (typeof(configData.id) == 'undefined') return cb(new Error("Config Not Found"));
        return cb();
      });
    },
    function saveUser(cb) {
      configData.setAndSave(req.user.displayName,changes,function(err) {
        debug("setAndSaveCB");
        cb(err);
      });
    }

    ],function(err){
      if (err) return next(err);
      res.redirect(config.getValue('htmlroot')+"/config/"+configData.name);
  
    });

}


router.get('/list',renderList);
router.get('/:name',renderConfigName);
router.post('/:id', postConfigId);


module.exports.router = router;
