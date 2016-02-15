"use strict";


var config = require("../config.js");
var should = require("should");
var debug = require('debug')("OSMBC:notification:slackReceiver");

config.initialise();


var Slack = require('node-slack');

var osmbcUrl = config.getValue('url')+config.getValue('htmlroot');


function SlackReceiver(webhook,channel) {
  debug("MailReceiver::MailReceiver");
  this.slack = new Slack(webhook);
  this.channel = channel;
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
  if (change ) return "<"+osmbcUrl+"/blog/"+article.id+"|"+change+">";
  return  "<"+osmbcUrl+"/blog/"+article.id+"|"+article.title+">";
}


SlackReceiver.prototype.sendInfo = function(object,callback) {
  debug("SlackReceiver::sendInfo");
  return callback();
};
SlackReceiver.prototype.sendWelcomeMail = function sendWelcomeMail(inviter,callback) {
  debug("SlackReceiver::sendWelcomeMail");
  return callback();
};

SlackReceiver.prototype.sendLanguageStatus = function sendLanguageStatus(user,blog,lang,status,callback) {
  debug("SlackReceiver::sendLanguageStatus");

  var subject = blogNameSlack(blog.name);

  if (status === "startreview") {
    subject += "("+lang+") review has been started by "+user.OSMUser;
  } else if (status === "markexported") {
    subject += "("+lang+") is exported to WordPress by "+user.OSMUser;
  } else {
    subject += "("+lang+") has been reviewed by "+user.OSMUser +" ("+status+")";
  }
  this.slack.send({
    text:subject,
    channel: this.channel,
    username: "osmbcbot"
  },callback);
};

SlackReceiver.prototype.sendCloseStatus = function sendCloseStatus(user,blog,lang,status,callback) {
  debug("SlackReceiver::sendCloseStatus");

  var subject = blogNameSlack(blog.name);
 
  if (status === "false") {
    subject +="("+lang+") has been reopened by "+user.OSMUser;
  } else {
    subject += "("+lang+") has been closed by "+user.OSMUser;
  }
  this.slack.send({
    text:subject,
    channel: this.channel,
    username: "osmbcbot"
  },callback);
};

SlackReceiver.prototype.updateArticle = function updateArticle(user,article,change,callback) {
  debug("SlackReceiver::updateArticle");

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
  if (text !== "") text = user.displayName + "\n"+text;
  debug("Sending subject "+text);
  this.slack.send({
    text:text,
    channel: this.channel,
    username: "osmbcbot"
  },callback);
};


SlackReceiver.prototype.updateBlog = function updateBlog(user,blog,change,callback) {
  debug("SlackReceiver::updateBlog");




  var subject = blogNameSlack(blog.name,change.name);

 
  if (!blog.name && change.name) {
     subject += " was created\n";
  } else if (blog.status !== change.status) {
     subject += " changed status to "+change.status+"\n";
  }

  this.slack.send({
    text:subject,
    channel: this.channel,
    username: "osmbcbot"
  },callback);
};


module.exports = SlackReceiver;