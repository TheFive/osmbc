"use strict";


var config = require("../config.js");
var should = require("should");
var debug = require('debug')("OSMBC:notification:slackreceiver");

config.initialise();


var Slack = require('node-slack');



function SlackReceiver(webhook,channel) {
  debug("MailReceiver::MailReceiver");
  this.slack = new Slack(webhook);
  this.channel = channel;
  debug("Channel: %s",channel);
  debug("Webhook: %s",webhook);
}


SlackReceiver.prototype.sendInfo = function(object,callback) {
  debug("SlackReceiver::sendWelcomeMail");
  return callback();
};
SlackReceiver.prototype.sendWelcomeMail = function sendWelcomeMail(inviter,callback) {
  debug("SlackReceiver::sendWelcomeMail");
  return callback();
};

SlackReceiver.prototype.sendLanguageStatus = function sendLanguageStatus(user,blog,lang,status,callback) {
  debug("SlackReceiver::sendLanguageStatus");

 

  var subject = blog.name +"("+lang+") has been reviewed by user "+user.OSMUser +" ("+status+")";
  if (status === "startreview") {
    subject = blog.name +"("+lang+") review has been started";
  }
  if (status === "markexported") {
    subject = blog.name + "("+lang+") is exported to WordPress";
  }
  this.slack.send({
    text:subject,
    channel: this.channel,
    username: "osmbcbot"
  });
  return callback();
};

SlackReceiver.prototype.updateArticle = function updateArticle(user,article,change,callback) {
  debug("SlackReceiver::updateArticle");

  should(typeof(change)).eql("object");
 


  var subject;
  var logblog = article.blog;
  if (change.blog) logblog = change.blog;

  if (!article.collection && change.collection) {
     subject = logblog + " added collection "+change.title;
  }
  if (article.collection && change.collection) {
     subject = logblog + " changed collection "+(change.title)?change.title:article.title;
  }
  if (!article.comment && change.comment) {
     subject = logblog + " added comment "+(change.title)?change.title:article.title;
  }
  if (article.comment && change.comment) {
     subject = logblog + " changed comment "+(change.title)?change.title:article.title;
  }
  debug("Sending subject "+subject);
  this.slack.send({
    text:subject,
    channel: this.channel,
    username: "osmbcbot"
  });
  return callback();
 
};


SlackReceiver.prototype.updateBlog = function updateBlog(user,blog,change,callback) {
  debug("SlackReceiver::updateBlog");




  var subject;
  var blogName = blog.name;
  if (change.name) blogName = change.name;
  blogName = "<https://thefive.sabic.uberspace.de/"+blogName+"|"+blogName+">";
 
  if (!blog.name && change.name) {
     subject = blogName + " was created";
  } else  {
     subject = blogName + " changed status";
  }

  this.slack.send({
    text:subject,
    channel: this.channel,
    username: "osmbcbot"
  });
  return callback();
};


module.exports = SlackReceiver;