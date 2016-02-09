"use strict";


var config = require("../config.js");
var debug = require('debug')("OSMBC:notification:slackreceiver");

config.initialise();


var Slack = require('node-slack');
var slack = new Slack(config.getValue("slack",{}).webhookurl);


function SlackReceiver() {
  debug("MailReceiver::MailReceiver");
}

SlackReceiver.prototype.sendWelcomeMail = function sendWelcomeMail(inviter,callback) {
  debug("SlackReceiver::sendWelcomeMail");
  return callback();
};

SlackReceiver.prototype.sendLanguageStatus = function sendLanguageStatus(user,blog,lang,status,callback) {
  debug("SlackReceiver::sendLanguageStatus");

  var self = this;


  var subject = blog.name +"("+lang+") has been reviewed by user "+user.OSMUser +" ("+status+")";
  if (status === "startreview") {
    subject = blog.name +"("+lang+") review has been started";
  }
  if (status === "markexported") {
    subject = blog.name + "("+lang+") is exported to WordPress";
  }
  slack.send({
    text:subject,
    channel: "#osmbcslacktest",
    username: "osmbcbot"
  });
  return callback();
};

SlackReceiver.prototype.updateArticle = function updateArticle(user,article,change,callback) {
  debug("SlackReceiver::updateArticle");

  should(typeof(change)).eql("object");
 

  var newArticle = articleModule.create();
  var k;
  for (k in article) {
    newArticle[k] = article[k];
    if (change[k]) newArticle[k] = change[k];
  }
  for (k in change) {
    newArticle[k] = change[k];
  }


  var subject;
  var logblog = article.blog;
  if (change.blog) logblog = change.blog;

  if (!article.collection && change.collection) {
     subject = logblog + " added collection";
  }
  if (article.collection && change.collection) {
     subject = logblog + " changed collection";
  }
  if (!article.comment && change.comment) {
     subject = logblog + " added comment";
  }
  if (article.comment && change.comment) {
     subject = logblog + " changed comment";
  }
  slack.send({
    text:subject,
    channel: "#osmbcslacktest",
    username: "osmbcbot"
  });
  return callback();
 
};


SlackReceiver.prototype.updateBlog = function updateBlog(user,blog,change,callback) {
  debug("SlackReceiver::updateBlog");


  var newBlog = blogModule.create();
  var k;
  for (k in blog) {
    newBlog[k] = blog[k];
    if (change[k]) newBlog[k] = change[k];
  }
  for (k in change) {
    newBlog[k] = change[k];
  }


  var subject;
  var blogName = blog.name;
  if (change.name) blogName = change.name;
  var blogName = "<https://thefive.sabic.uberspace.de/"+blogName+"|"+blogName+">";
 
  if (!blog.name && change.name) {
     subject = blogName + " was created";
  } else  {
     subject = blogName + " changed status";
  }
  console.log("Send to slack: "+subject);
  slack.send({
    text:subject,
    channel: "#osmbcslacktest",
    username: "osmbcbot"
  }); 
  return callback();
};


module.exports = SlackReceiver;