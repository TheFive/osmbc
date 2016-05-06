"use strict";

var express  = require('express');
var async    = require('async');
var router   = express.Router();
var should   = require('should');
var markdown = require('markdown-it')();
var debug    = require('debug')('OSMBC:routes:slack');
var util = require('../util.js');

var config        = require('../config.js');

var node_slack = require('node-slack');

var userModule     = require('../model/user.js');
var htmltitle     = require('../model/htmltitle.js');
var articleModule     = require('../model/article.js');
var blogModule     = require('../model/blog.js');


var slack = new node_slack(config.getValue("slack").article.wn.hook);
var botName = config.getValue("AppName").toLowerCase();

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
    res.status(401).send("Authorisation forbidden");
    return;
  }
  // to not answer to bots

  if (req.body.user_name=="slackbot") {
    res.json({});
    return;
  }
  userModule.find({SlackUser:req.body.user_name},function(err,user){
    if (err) {
      console.log(err);
      return next(err);
    }
    var obj = {};

    obj.token = req.body.token;
    obj.team_id = req.body.team_id;
    obj.channel_id = req.body.channel_id;
    obj.channel_name = req.body.channel_name;
    obj.timestamp = new Date(req.body.timestamp);
    obj.user_id = req.body.user_id;
    obj.user_name = req.body.user_name;
    obj.username = botName;

    if (user.length==0) {
      obj.text = "<@"+obj.user_id+"> I never heard from you. Please enter your Slack Name in <"+osmbcUrl+"/usert/self|OSMBC>";
      res.json(obj);
      return;
    }
    if (user.length>1) {
      obj.text = "<@"+obj.user_id+"> is registered more than once in <"+osmbcUrl+"/usert/self|OSMBC>";
      res.json(obj);
      return;
    }

    req.user = user[0];
    return next();
  });
}


function searchUrlInSlack(text) {
  debug("searchUrlInSlack");
  if (text.search("<")>=0) {
    let from = text.search("<");
    let to = text.search(">");
    if ( from < to) {
      return text.substring(from +1, to );
    }
  }
  return null;
}

function extractTextWithoutUrl(text) {
  debug("extractTextWithoutUrl");
  let url = searchUrlInSlack(text);
  if (url) text = text.replace("<"+url+">","");
  return text;
}

var slackCommunicationStatus = {};


function getUrlFromSlack(req,callback) {
  debug("getUrlFromSlack");
  let text = req.body.text;
  let user_name = req.body.user_name;

  let url=searchUrlInSlack(text);
  let title=extractTextWithoutUrl(text);


  if (url && url != "" && util.isURL(url)) {
    console.log(text +" is an url");
    articleModule.fullTextSearch(text, {column: "blog", desc: true}, function (err, result) {
      if (err) return callback(err);
      console.log("Dublette Search "+JSON.stringify(result));
      if (result.length > 0) {
        let answer = "Found: " + result.length + ((result.length == 1) ? " article" : " articles") + "\n";
        for (let i = 0; i < Math.min(result.length, 3); i++) {
          answer += result[i].blog + " " + articleNameSlack(result[i]) + "\n";
        }
        if (result.length > 3) answer += "and more\n";
        answer += "\nPlease enter yes to proceed.";
        slackCommunicationStatus[user_name].timestamp = new Date();
        slackCommunicationStatus[user_name].url = url;
        slackCommunicationStatus[user_name].waitOnYes = true;
        slackCommunicationStatus[user_name].title = title;
        req.body.handled = true;
        return callback(null, answer);
      } else {
        slackCommunicationStatus[user_name].timestamp = new Date();
        slackCommunicationStatus[user_name].url = url;
        slackCommunicationStatus[user_name].waitOnYes = false;
        slackCommunicationStatus[user_name].title = title;
        req.body.handled = true;
        return callback(null);
      }
    });
  }
  else {
    console.log(text +" is not an url");
    return callback();
  }
}


function getYesFromSlack(req,callback) {
  debug("getYesFromSlack");
  let text = req.body.text;
  let user_name = req.body.user_name;
  req.body.handled = true;
  if (text.toUpperCase()=="YES") {
    slackCommunicationStatus[user_name].waitOnYes = false;
    //slackCommunicationStatus[user_name].waitOnTitle = true;
    slackCommunicationStatus[user_name].timestamp = new Date();
    return callback(null,"Please enter a title for the collection:");
  } else {
    delete slackCommunicationStatus[user_name];
    return callback(null,"You have cancelled your collection.");
  }
}

function getTitleFromSlack(req,callback) {
  debug("getTitleFromSlack");
  let text = req.body.text;
  let user_name = req.body.user_name;

  if (text.length>=5 && text.length <= 140) {
    slackCommunicationStatus[user_name].waitOnTitle=false;
    slackCommunicationStatus[user_name].title=text;
    req.body.handled = true;
    return callback();

  } else {
    delete slackCommunicationStatus[user_name];
    req.body.handled = true;
    return callback(null,"Sorry, title to long or to short.");
  }
}

function createArticle(req,callback) {
  debug("createArticle");
  let user_name = req.body.user_name;

  let changes = {title:slackCommunicationStatus[user_name].title,
                  collection:slackCommunicationStatus[user_name].url,
                  categoryEN:"-- no category yet --",
                  blog:slackCommunicationStatus[user_name].blog};
  delete slackCommunicationStatus[user_name];
  articleModule.createNewArticle(function(err,result){
    if (err) return callback(err);
    changes.version = result.version;
    result.setAndSave(req.user,changes,function(err){
      if (err) return callback(err);
      return callback(null,articleNameSlack(result)+" created.");
    });

  });
}


function undefined(value) {
  if (typeof(value)!="string") return true;
  if (value != "") return false;
  return true;
}

function postSlackCreateUseTBC(req,res,next) {
  debug("postSlackCreateUseTBC");
  if (!(req.user.slackMode === "useTBC")) return next();

  var obj = {};

  obj.token = req.body.token;
  obj.team_id = req.body.team_id;
  obj.channel_id = req.body.channel_id;
  obj.channel_name = req.body.channel_name;
  obj.timestamp = new Date(req.body.timestamp);
  obj.user_id = req.body.user_id;
  obj.user_name = req.body.user_name;
  obj.text = req.body.text;
  obj.username = botName;

  let url=searchUrlInSlack(obj.text);
  let title=extractTextWithoutUrl(obj.text);
  let blog = "TBC";


  async.series([function calcTitle(cb){
    if (typeof(title)=="undefined" || title == "") {
      htmltitle.getTitle(url,function (err,t){
        if (err) return cb(err);
        title = t;
        return cb();
      });
    } else return cb();
  }],function createArticle(err){
    let changes = {title:title,
      collection:url,
      categoryEN:"-- no category yet --",
      blog:blog};
    articleModule.createNewArticle(function(err,result){
      if (err) return callback(err);
      changes.version = result.version;
      result.setAndSave(req.user,changes,function(err){
        if (err) return callback(err);
        obj.text = articleNameSlack(result)+" created.\n";
        res.json(obj);
      });
    });
  });
}

function postSlackCreateInteractive(req,res,next) {
  debug('postSlackCreateInteractive');

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

  req.body.handled = false;

  let currentstatus = slackCommunicationStatus[req.body.user_name];
  if (typeof(currentstatus)=="undefined") {
    slackCommunicationStatus[req.body.user_name] = {timestamp:new Date()};
    currentstatus = slackCommunicationStatus[req.body.user_name];
  }
  if (typeof(currentstatus)=="object") {
    if ((new Date().getTime() - currentstatus.timestamp.getTime())>=4*60*1000) {


      slackCommunicationStatus[req.body.user_name] = {timestamp:new Date()};
      currentstatus = slackCommunicationStatus[req.body.user_name];
    }
  }
  console.log("Received Message:")
  console.log(req.body.text);
  console.log("STATUS before parsing.");
  console.dir(slackCommunicationStatus);
  async.auto({
    checkblog:function(cb){
      debug("checkblog");
      if (!undefined(slackCommunicationStatus[req.body.user_name].blog)) return cb();
      if (req.user.slackMode === "useTBC") {
        console.log("Slack Mode is not interactive");
        slackCommunicationStatus[req.body.user_name].blog = "TBC";

        return cb();
      }
      console.log("Slack Mode is interactive");
      blogModule.find({status:"open"},function(err,result) {

        if (err) return callback(err);
        if (result.length > 0) {
          console.log(result[0].name+" Blogs found")
          slackCommunicationStatus[req.body.user_name].blog = result[0].name;
          console.dir(slackCommunicationStatus);
          return cb();
        }
        else {
          slackCommunicationStatus[req.body.user_name].blog = "TBC";
          return cb();
        }
      });
    },
    new:function(cb) {
      debug("new");
      console.log("handled: "+req.body.handled);
      if (req.body.handled) return cb();
      if (typeof(slackCommunicationStatus[req.body.user_name].url)=="undefined") {
        getUrlFromSlack(req,cb);
      }
      else cb(null,"");
    },
    yes:["new",function(cb) {
      debug("yes");
      if (req.body.handled) return cb();
      if (currentstatus.waitOnYes) {
        getYesFromSlack(req,cb);
      }
      else cb(null,"");
    }],
    title:["new",function(cb) {
      debug("title");
      if (req.body.handled) return cb();
      if (currentstatus.waitOnTitle) {
        getTitleFromSlack(req,cb);
      } else return cb();
      }
    ],
    checkAllExist:["title","yes","new","checkblog",function(cb,result){
      debug("checkAllExist");
      console.log("STATUS after parsing.");
      console.dir(slackCommunicationStatus);
      if (!slackCommunicationStatus[req.body.user_name]) return cb();

      if (slackCommunicationStatus[req.body.user_name].waitOnYes) return cb();
      if (slackCommunicationStatus[req.body.user_name].waitOnTitle) return cb();
      if (result.yes) return cb();
      if (undefined(slackCommunicationStatus[req.body.user_name].url)) {
        return cb(null,"Please start with an url");
      }
      if (undefined(slackCommunicationStatus[req.body.user_name].blog)) {
        slackCommunicationStatus[req.body.user_name] = {timestamp: new Date()};
        return cb(null,"No open blog found, please use <"+osmbcUrl+"/index.html|OSMBC>")
      }
      if (undefined(slackCommunicationStatus[req.body.user_name].title)) {
        slackCommunicationStatus[req.body.user_name].waitOnTitle = true;
        return cb(null,"Please enter a title:");
      }
      return cb();
    }],
    createArticle:["checkAllExist",function(cb) {
      debug("createArticle");
      if (  (!undefined(slackCommunicationStatus[req.body.user_name].title))
          &&(!undefined(slackCommunicationStatus[req.body.user_name].url))
          &&(!undefined(slackCommunicationStatus[req.body.user_name].blog)
          &&(!slackCommunicationStatus[req.body.user_name].waitOnYes)))
       {

         createArticle(req,cb);
      }
      else cb(null,"");
    }]
  },function sendResult(err,result){
    console.log("STATUS Final");
    console.dir(slackCommunicationStatus);
    let text ="-- should not appear text ---";
    if (err) {
      text = err;
      console.log(err);
    } else {
      text = "";
      for (let k in result) {
        if (k) {
          if (result[k])
            text += result[k]+"\n";
        }
      }
    }
    if (text!=="") obj.text = "<@"+obj.user_id+"> "+text;
    else obj.text ="";
    obj.username = botName;
    console.log("Result");
    console.dir(result);
    res.json(obj);

  });
}


router.post('/create/:team', ensureAuthentificated,postSlackCreateUseTBC);
router.post('/create/:team', ensureAuthentificated,postSlackCreateInteractive);





module.exports.router = router;

module.exports.fortestonly = {};
module.exports.fortestonly.searchUrlInSlack = searchUrlInSlack;
module.exports.fortestonly.extractTextWithoutUrl = extractTextWithoutUrl;
module.exports.fortestonly.undefined = undefined;
module.exports.fortestonly.slackCommunicationStatus = slackCommunicationStatus;



