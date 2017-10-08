"use strict";


var config = require("../util/config.js");
var should = require("should");
var debug = require("debug")("OSMBC:notification:slackReceiver");

var configModule = require("../model/config.js");

var messageCenter = require("../notification/messageCenter.js");
var ConfigFilter  = require("../notification/ConfigFilter.js");
var IteratorReceiver = require("../notification/IteratorReceiver.js");

config.initialise();

var botName = config.getValue("AppName").toLowerCase();




var Slack = require("../notification/SlackAPI");

var osmbcUrl = config.getValue("url") + config.getValue("htmlroot");
var iconUrl = osmbcUrl + "/images/osmbc_im_logo.png";


function SlackReceiver(name, slack, channel) {
  debug("SlackReceiver::SlackReceiver");

  should(typeof (name)).eql("string");
  should(typeof (slack)).eql("string");
  // If privat channels should be adressed to,
  // please change condition to
  // (channel.substring(0,1)==="#")||(channel.substring(0,1)==="@")
  should((channel.substring(0, 1) === "#")).be.True();
  this.name = name;
  this.slackName = slack;
  this.hook = slackhook[this.slackName];
  if (this.hook) this.slack = new Slack(this.hook); else this.slack = null;

  this.channel = channel;
  debug("Name: %s", this.name);
  debug("Slack: %s", this.slackName);
  debug("hook: %s", this.hook);
  debug("channel: %s", this.channel);
}

function blogNameSlack(blog, change) {
  debug("blogNameSlack");
  if (change) return "<" + osmbcUrl + "/blog/" + change + "|" + change + ">";
  return "<" + osmbcUrl + "/blog/" + blog + "|" + blog + ">";
}

function articleNameSlack(article, change) {
  debug("articleNameSlack");
  let title = article.title;
  if (change) title = change;
  if (!title) title = "";
  title = title.replace(/(<)/gm, "«");
  title = title.replace(/(>)/gm, "»");

  return "<" + osmbcUrl + "/article/" + article.id + "|" + title + ">";
}


SlackReceiver.prototype.sendInfo = function(object, callback) {
  debug("SlackReceiver::sendInfo %s", this.name);
  return callback();
};
SlackReceiver.prototype.sendWelcomeMail = function sendWelcomeMail(inviter, callback) {
  debug("SlackReceiver::sendWelcomeMail %s", this.name);
  return callback();
};

SlackReceiver.prototype.sendLanguageStatus = function sendLanguageStatus(user, blog, lang, status, callback) {
  debug("SlackReceiver::sendLanguageStatus %s", this.name);

  var subject = blogNameSlack(blog.name);


  let reviewChangesLink = "";
  let reviewChangesWithUserLink = "";

  if (blog["reviewComment" + lang] && blog["reviewComment" + lang][0]) {
    let baselink = osmbcUrl + "/changes/log?blog=" + blog.name + "&table=article&property=markdown" + lang + "&date=GE:" + blog["reviewComment" + lang][0].timestamp;
    reviewChangesLink = "<" + baselink + "|Full Review>";
    reviewChangesWithUserLink = "<" + baselink + "&user=" + user.OSMUser + "|User Review>";
  }


  if (status === "startreview") {
    subject += "(" + lang + ") review has been started (" + reviewChangesLink + ")";
  } else if (status === "markexported") {
    subject += "(" + lang + ") is exported to WordPress";
  } else if (status === "" || status === null) {
    subject += "(" + lang + ") review comment deleted.";
  } else if (status === "reviewing...") {
    subject = "has started Review for: " + subject + "(" + lang + ")";
  } else {
    subject += "(" + lang + ") has been reviewed: " + status + " (" + reviewChangesWithUserLink + ", " + reviewChangesLink + ")";
  }
  var username = botName + "(" + user.OSMUser + ")";


  if (this.slack) {
    this.slack.send({
      text: subject,
      channel: this.channel,
      username: username,
      icon_url: iconUrl
    }, callback);
  } else return callback();
};

SlackReceiver.prototype.sendCloseStatus = function sendCloseStatus(user, blog, lang, status, callback) {
  debug("SlackReceiver::sendCloseStatus %s", this.name);

  var subject = blogNameSlack(blog.name);


  if (status === false) {
    subject += "(" + lang + ") has been reopened";
  } else {
    subject += "(" + lang + ") has been closed";
  }
  var username = botName + "(" + user.OSMUser + ")";

  if (this.slack) {
    this.slack.send({
      text: subject,
      channel: this.channel,
      username: username,
      icon_url: iconUrl
    }, callback);
  } else return callback();
};

SlackReceiver.prototype.updateArticle = function updateArticle(user, article, change, callback) {
  debug("SlackReceiver::updateArticle %s", this.name);

  should(typeof (change)).eql("object");

  var blogName = blogNameSlack(article.blog, change.blog);
  var articleTitle = articleNameSlack(article, change.title);

  var text = "";

  if (change.blog && article.blog && change.blog !== article.blog) {
    text += articleTitle + " moved to " + blogName + "\n";
  }

  if (!article.collection && change.collection) {
    text += articleTitle + " added to " + blogName + "\n";
  }
  if (article.collection && change.collection) {
    text += articleTitle + " changed collection" + "\n";
  }
  if (!article.comment && change.comment) {
    text += articleTitle + " added comment" + "\n";
  }
  if (article.comment && change.comment) {
    text += articleTitle + " changed comment" + "\n";
  }
  debug("Sending subject " + text);
  var username = botName + "(" + user.OSMUser + ")";

  if (this.slack) {
    this.slack.send({
      text: text,
      channel: this.channel,
      username: username,
      icon_url: iconUrl
    }, callback);
  } else return callback();
};


SlackReceiver.prototype.addComment = function addComment(user, article, comment, callback) {
  debug("SlackReceiver::addComment %s", this.name);



  var articleTitle = articleNameSlack(article, article.title);

  var text = articleTitle + " added comment:" + "\n" + comment;

  var username = botName + "(" + user.OSMUser + ")";

  if (this.slack) {
    this.slack.send({
      text: text,
      channel: this.channel,
      username: username,
      icon_url: iconUrl
    }, callback);
  } else return callback();
};

SlackReceiver.prototype.editComment = function editComment(user, article, index, comment, callback) {
  debug("SlackReceiver.prototype.editComment");


  var articleTitle = articleNameSlack(article, article.title);

  var text = articleTitle + " changed comment:" + "\n" + comment;

  var username = botName + "(" + user.OSMUser + ")";

  if (this.slack) {
    this.slack.send({
      text: text,
      channel: this.channel,
      username: username,
      icon_url: iconUrl
    }, callback);
  } else return callback();
};

SlackReceiver.prototype.updateBlog = function updateBlog(user, blog, change, callback) {
  debug("SlackReceiver::updateBlog %s", this.name);




  var subject = blogNameSlack(blog.name, change.name);


  if (!blog.name && change.name) {
    subject += " was created\n";
  } else if (blog.status !== change.status) {
    subject += " changed status to " + change.status + "\n";
  }
  var username = botName + "(" + user.OSMUser + ")";

  if (this.slack) {
    this.slack.send({
      text: subject,
      channel: this.channel,
      username: username,
      icon_url: iconUrl
    }, callback);
  } else return callback();
};



var iteratorReceiver = new IteratorReceiver({});
var channelReceiverMap = {};


var registered = false;
var slackhook = null;

function initialise(callback) {
  debug("initialise");
  slackhook = config.getValue("slacktool");
  messageCenter.initialise();
  let channelList = configModule.getConfigObject("slacknotification").getJSON();

  channelReceiverMap = {};
  for (var i = 0; i < channelList.length; i++) {
    var channel = channelList[i];
    if (channel.channel.substring(0, 1) !== "#") continue;
    channelReceiverMap["Slack Connection " + i] = new ConfigFilter(channel, new SlackReceiver(channel.slack + channel.channel, channel.slack, channel.channel));
  }
  iteratorReceiver.receiverMap = channelReceiverMap;
  should.exist(messageCenter.global);
  if (!registered) {
    messageCenter.global.registerReceiver(iteratorReceiver);
    registered = true;
  }
  if (callback) return callback();
}


module.exports.SlackReceiver = SlackReceiver;
module.exports.initialise = initialise;
