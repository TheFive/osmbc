"use strict";

var express  = require('express');
var async    = require('async');
var router   = express.Router();
var should   = require('should');
var markdown = require('markdown-it')();
var debug    = require('debug')('OSMBC:routes:article');
var util = require('../util.js');

var config        = require('../config.js');

var node_slack = require('node-slack');

var userModule     = require('../model/user.js');
var articleModule     = require('../model/article.js');


var slack = new node_slack(config.getValue("slack").article.wn.hook);



function ensureAuthentificated(req,res,next) {
  debug('ensureAuthentificated');
  var slackTeam = req.params.team;
  let token = "xx";
  if (config.getValue("slack").article[slackTeam]) {
    token = config.getValue("slack").article[slackTeam].token;
  }
  if (req.body.token !== token) {
    console.log("wrong slack token");
    return next(new Error("Wrong Slack Token"));
  }
  // to not answer to bots

  if (req.body.user_name=="slackbot") {
    res.json({});
    return;
  }
  console.log("search user");
  userModule.findOne({SlackUser:req.body.user_name},function(err,user){
    if (err) {
      console.log(err);
      return next(err);
    }
    if (!user) {
      console.log("User Unknown");
      return next(new Error("User unknown"));
    }
    req.user = user;
  })
  return next();
}





function postSlackCreate(req,res,next) {
  debug('postSlackCreate');

  // prepare answer, should be done by node-slack have to find better module

  var obj = {};

  obj.token = req.body.token;
  obj.team_id = req.body.team_id;
  obj.channel_id = req.body.channel_id;
  obj.channel_name = req.body.channel_name;
  obj.timestamp = new Date(req.body.timestamp);
  obj.user_id = req.body.user_id;
  obj.user_name = req.body.user_name;
  obj.text = req.body.text;

  let text = req.body.text;
  if (text.substring(0,1)=="<") text = text.substring(1,text.length-1);
  if (util.isURL(text)) {
    console.log("will search text"+text);
    articleModule.fullTextSearch(text,{column:"blog",desc:true},function(err,result){
      console.log("searched text");
      if (result.length>0) {
        let answer = "Found:\n";
        for (let i=0;i<Math.min(result.length,3);i++) {
          answer += result[i].blog +" "+result[i].title+"\n";
        }
        if (result.length>3) answer += "and more\n";

        obj.text = answer;
        obj.username= "OSMBC";

        res.json(obj);
        return
      } else {
        obj.text = "new link";
        obj.username = "OSMBC";
        res.json(obj);
        return;
      }
    });
  }else {
    console.log("no url");
    obj.text = 'Please enter an url ' + req.body.user_name;
    obj.username = "OSMBC";
    res.json(obj);
  }
}


router.post('/create/:team', ensureAuthentificated,postSlackCreate);





module.exports.router = router;


