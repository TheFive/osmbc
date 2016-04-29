"use strict";


var config = require("../config.js");
var should = require("should");
var debug = require('debug')("OSMBC:notification:slackReceiver");

config.initialise();

var botName = config.getValue("AppName").toLowerCase();


var Slack = require('node-slack');

var osmbcUrl = config.getValue('url')+config.getValue('htmlroot');


function SlackReceiver(name,webhook,channel) {
  debug("MailReceiver::MailReceiver");
  should(typeof(name)).eql("string");
  should(typeof(webhook)).eql("string");
  // If privat channels should be adressed to,
  // please change condition to
  // (channel.substring(0,1)==="#")||(channel.substring(0,1)==="@")
  should((channel.substring(0,1)==="#")).be.True();
  this.name = name;
  this.slack = new Slack(webhook);
  this.channel = channel;
  debug("Name: %s",name);
  debug("Channel: %s",channel);
  debug("Webhook: %s",webhook);
}

function blogNameSlack(blog,change) {
  debug('blogNameSlack');
  if (change ) return "<"+osmbcUrl+"/blog/"+change+"|"+change+">";
  return  "<"+osmbcUrl+"/blog/"+blog+"|"+blog+">";
}

function articleNameSlack(article,change) {
  debug('articleNameSlack');
  if (change ) return "<"+osmbcUrl+"/article/"+article.id+"|"+change+">";
  return  "<"+osmbcUrl+"/article/"+article.id+"|"+article.title+">";
}


SlackReceiver.prototype.sendInfo = function(object,callback) {
  debug("SlackReceiver::sendInfo %s",this.name);
  return callback();
};
SlackReceiver.prototype.sendWelcomeMail = function sendWelcomeMail(inviter,callback) {
  debug("SlackReceiver::sendWelcomeMail %s",this.name);
  return callback();
};

SlackReceiver.prototype.sendLanguageStatus = function sendLanguageStatus(user,blog,lang,status,callback) {
  debug("SlackReceiver::sendLanguageStatus %s",this.name);

  var subject = blogNameSlack(blog.name);

  if (status === "startreview") {
    subject += "("+lang+") review has been started";
  } else if (status === "markexported") {
    subject += "("+lang+") is exported to WordPress";
  } else {
    subject += "("+lang+") has been reviewed: "+status;
  }
  var username = botName + "("+user.OSMUser+")";

  this.slack.send({
    text:subject,
    channel: this.channel,
    username: username
  },callback);
};

SlackReceiver.prototype.sendCloseStatus = function sendCloseStatus(user,blog,lang,status,callback) {
  debug("SlackReceiver::sendCloseStatus %s",this.name);

  var subject = blogNameSlack(blog.name);
 
  if (status === "false") {
    subject +="("+lang+") has been reopened";
  } else {
    subject += "("+lang+") has been closed";
  }
  var username = botName + "("+user.OSMUser+")";
  this.slack.send({
    text:subject,
    channel: this.channel,
    username: username
  },callback);
};

SlackReceiver.prototype.updateArticle = function updateArticle(user,article,change,callback) {
  debug("SlackReceiver::updateArticle %s",this.name);

  should(typeof(change)).eql("object");

  var blogName = blogNameSlack(article.blog,change.blog);
  var articleTitle = articleNameSlack(article,change.title);

  var text="";

  if (change.blog && article.blog && change.blog != article.blog) {
    text += articleTitle +" moved to "+blogName +"\n";
  }

  if (!article.collection && change.collection) {
     text += articleTitle + " added to "+blogName+"\n";
  }
  if (article.collection && change.collection) {
     text += articleTitle + " changed collection"+"\n";
  }
  if (!article.comment && change.comment) {
     text += articleTitle + " added comment"+"\n";
  }
  if (article.comment && change.comment) {
     text += articleTitle + " changed comment"+"\n";
  }
  debug("Sending subject "+text);
  var username = botName + "("+user.OSMUser+")";

  this.slack.send({
    text:text,
    channel: this.channel,
    username: username
  },callback);
};


SlackReceiver.prototype.addComment = function addComment(user,article,comment,callback) {
  debug("SlackReceiver::addComment %s",this.name);



  var articleTitle = articleNameSlack(article,article.title);

  var text=articleTitle + " added comment:"+"\n"+comment;

  var username = botName + "("+user.OSMUser+")";

  this.slack.send({
    text:text,
    channel: this.channel,
    username: username
  },callback);
};

SlackReceiver.prototype.editComment = function editComment(user,article,index,comment,callback) {
  debug("SlackReceiver.prototype.editComment");


  var articleTitle = articleNameSlack(article,article.title);

  var text=articleTitle + " changed comment:"+"\n"+comment;

  var username = botName + "("+user.OSMUser+")";

  this.slack.send({
    text:text,
    channel: this.channel,
    username: username
  },callback);
};

SlackReceiver.prototype.updateBlog = function updateBlog(user,blog,change,callback) {
  debug("SlackReceiver::updateBlog %s",this.name);




  var subject = blogNameSlack(blog.name,change.name);

 
  if (!blog.name && change.name) {
     subject += " was created\n";
  } else if (blog.status !== change.status) {
     subject += " changed status to "+change.status+"\n";
  }
  var username = botName + "("+user.OSMUser+")";

  this.slack.send({
    text:subject,
    channel: this.channel,
    username:username
  },callback);
};


module.exports = SlackReceiver;