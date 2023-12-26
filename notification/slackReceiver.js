


import config from "../config.js";
import assert from "assert";

import configModule from "../model/config.js";

import messageCenter from "../notification/messageCenter.js";
import ConfigFilter from "../notification/ConfigFilter.js";
import IteratorReceiver from "../notification/IteratorReceiver.js";

import Slack from "../notification/SlackAPI.js";


import _debug from "debug";
const debug = _debug("OSMBC:notification:slackReceiver");

config.initialise();

const botName = config.getValue("AppName").toLowerCase();

const osmbcUrl = config.getValue("url") + config.htmlRoot();
const iconUrl = osmbcUrl + "/images/osmbc_im_logo.png";

export function SlackReceiver(name, slack, channel) {
  debug("SlackReceiver::SlackReceiver");

  assert(typeof (name) === "string");
  assert(typeof (slack) === "string");
  // If privat channels should be adressed to,
  // please change condition to
  // (channel.substring(0,1)==="#")||(channel.substring(0,1)==="@")
  assert((channel.substring(0, 1) === "#"));
  this.name = name;
  this.slackName = slack;
  this.hook = slackhook[this.slackName];
  if (this.hook) this.slack = new Slack(this.hook); else this.slack = null;

  this.channel = channel;
  debug("Name: %s", this.name);
  debug("Slack: %s", this.slackName);
  debug("hook: %s", this.hook);
  debug("channel: %s", this.channel);
};

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

SlackReceiver.prototype.sendReviewStatus = function sendReviewStatus(user, blog, lang, status, callback) {
  debug("SlackReceiver::sendReviewStatus %s", this.name);
  let subject = blogNameSlack(blog.name);


  let reviewChangesLink = "";
  let reviewChangesWithUserLink = "";

  if (blog["reviewComment" + lang] && blog["reviewComment" + lang][0]) {
    const baselink = osmbcUrl + "/changes/log?blog=" + blog.name + "&table=article&property=markdown" + lang + "&date=GE:" + blog["reviewComment" + lang][0].timestamp;
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
  const username = botName + "(" + user.OSMUser + ")";

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

  let subject = blogNameSlack(blog.name);


  if (status === false) {
    subject += "(" + lang + ") has been reopened";
  } else {
    subject += "(" + lang + ") has been closed";
  }
  const username = botName + "(" + user.OSMUser + ")";

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

  assert(typeof (change) === "object");

  const blogName = blogNameSlack(article.blog, change.blog);
  const articleTitle = articleNameSlack(article, change.title);

  let text = "";

  if (change.blog && article.blog && change.blog !== article.blog) {
    text += articleTitle + " moved to " + blogName + "\n";
  }

  if (!article.collection && change.collection) {
    text += articleTitle + " added to " + blogName + "\n";
  }
  if (article.collection && change.collection) {
    text += articleTitle + " changed collection" + "\n";
  }
  debug("Sending subject " + text);
  const username = botName + "(" + user.OSMUser + ")";

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



  const articleTitle = articleNameSlack(article, article.title);

  const text = articleTitle + " added comment:" + "\n" + comment;

  const username = botName + "(" + user.OSMUser + ")";

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


  const articleTitle = articleNameSlack(article, article.title);

  const text = articleTitle + " changed comment:" + "\n" + comment;

  const username = botName + "(" + user.OSMUser + ")";

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




  let subject = blogNameSlack(blog.name, change.name);


  if (!blog.name && change.name) {
    subject += " was created\n";
  } else if (blog.status !== change.status) {
    subject += " changed status to " + change.status + "\n";
  }
  const username = botName + "(" + user.OSMUser + ")";

  if (this.slack) {
    this.slack.send({
      text: subject,
      channel: this.channel,
      username: username,
      icon_url: iconUrl
    }, callback);
  } else return callback();
};



const iteratorReceiver = new IteratorReceiver({});
let channelReceiverMap = {};


let registered = false;
let slackhook = null;

export const initialiseSlackReceiver = function initialiseSlackReceiver(callback) {
  debug("initialiseSlackReceiver");
  slackhook = config.getValue("slacktool");
  messageCenter.initialise();
  configModule.getConfigObject("slacknotification", function(err, slackConfig) {
    if (err) return callback(err);
    const channelList = slackConfig.getJSON();

    channelReceiverMap = {};
    for (let i = 0; i < channelList.length; i++) {
      const channel = channelList[i];
      if (channel.channel.substring(0, 1) !== "#") continue;
      channelReceiverMap["Slack Connection " + i] = new ConfigFilter(channel, new SlackReceiver(channel.slack + channel.channel, channel.slack, channel.channel));
    }
    iteratorReceiver.receiverMap = channelReceiverMap;
    assert(messageCenter.global);
    if (!registered) {
      messageCenter.global.registerReceiver(iteratorReceiver);
      registered = true;
    }
    if (callback) return callback();
  });
};


