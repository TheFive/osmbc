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

var osmbcUrl = config.getValue('url')+config.getValue('htmlroot');

function articleNameSlack(article) {
  debug('articleNameSlack');
  return  "<"+osmbcUrl+"/article/"+article.id+"|"+article.title+">";
}

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


var slackCommunicationStatus = {};


function getUrlFromSlack(req,callback) {
  debug("getUrlFromSlack");
  let text = req.body.text;
  let user_name = req.body.user_name;

  if (text.substring(0,1)=="<") text = text.substring(1,text.length-1);
  if (util.isURL(text)) {
    console.log("will search text"+text);
    articleModule.fullTextSearch(text,{column:"blog",desc:true},function(err,result){
      if (err) return callback(err);
      console.log("searched text");
      if (result.length>0) {
        let answer = "Found: "+result.length+ ((result.length==1)?" article":" articles")+"\n";
        for (let i=0;i<Math.min(result.length,3);i++) {
          answer += result[i].blog +" "+articleNameSlack(result[i]);
        }
        if (result.length>3) answer += "and more\n";
        answer +="\nPlease enter yes to proceed."
        slackCommunicationStatus[user_name]={timestamp:new Date(),url:text,waitOnYes:true};
        console.log("found and reply");
        console.log(slackCommunicationStatus);
        return callback(null,answer);
      } else {
        console.log("not found and reply");
        slackCommunicationStatus[user_name]={timestamp:new Date(),url:text,waitOnTitle:true};
        return callback(null,"Thanks, please enter a title:");
      }
    });
  } else
  return callback(null,"I did not understand, i am expecting an URL.");
}


function getYesFromSlack(req,callback) {
  debug("getYesFromSlack");
  let text = req.body.text;
  let user_name = req.body.user_name;

  if (text.toUpperCase()=="YES") {
    slackCommunicationStatus[user_name].waitOnYes = false;
    slackCommunicationStatus[user_name].waitOnTitle = true;
    slackCommunicationStatus[user_name].timestamp = new Date();
    return callback(null,"Please enter a title for the collection:");
  } else {
    slackCommunicationStatus[user_name] ={};
    return callback(null,"You have cancelled your collection.");
  }
}

function getTitleFromSlack(req,callback) {
  debug("getTitleFromSlack");
  let text = req.body.text;
  let user_name = req.body.user_name;

  if (text.length>=5 && text.length <= 40) {
    let changes = {title:slackCommunicationStatus[user_name].title,collection:slackCommunicationStatus[user_name].collection};
    slackCommunicationStatus[user_name] = {};
    console.log("Creating article blog is missing !!");
    articleModule.createNewArticle(function(err,result){
      if (err) return callback(err);
      changes.version = result.version;
      result.setAndSave(req.user,changes,function(err){
        if (err) return callback(err);
        console.log("article saved");
        return callback(null,articleNameSlack(result)+" created");
      });

    });
  } else {
    slackCommunicationStatus[user_name] = {};
    return callback(null,"Sorry, title looks unplausible.");
  }
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

  let currentstatus = slackCommunicationStatus[req.body.user_name];
  if (typeof(currentstatus)=="undefined") {
    slackCommunicationStatus[req.body.user_name] = {};
    currentstatus = slackCommunicationStatus[req.body.user_name];
  }
  if (typeof(currentstatus)=="object") {
    /*if ((currentstatus.timestamp -new Date())<120*1000) {
      delete slackCommunicationStatus[req.body.user_name];
      currentstatus = slackCommunicationStatus[req.body.user_name];
    }*/
  }
  console.log("STATUS");
  console.dir(slackCommunicationStatus);
  async.auto({
    new:function(cb) {
      if (typeof(currentstatus.url)=="undefined") {
        getUrlFromSlack(req,cb);
      }
      else cb(null,"");
    },
    yes:["title",function(cb) {

      if (currentstatus.waitOnYes) {
        getYesFromSlack(req,cb);
      }
      else cb(null,"");
    }],
    title:function(cb) {
      if (currentstatus.waitOnTitle) {
        getTitleFromSlack(req,cb);
      }
      else cb(null,"");
    }
  },function sendResult(err,result){
    let text ="-- should not appear text ---";
    if (err) {
      text = err;
      console.log(err);
    } else {
      text = result.new+result.yes+result.title;
    }
    obj.text = text;
    obj.username = "OSMBC";
    console.log("Result");
    console.dir(result);
    console.dir("Send Back");
    console.log(obj);
    res.json(obj);

  });
}


router.post('/create/:team', ensureAuthentificated,postSlackCreate);





module.exports.router = router;


