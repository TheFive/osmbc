"use strict";

const request  = require("request");
const deferred = require("deferred");
const https = require("https");
const logger    = require("../config.js").logger;


const agentOptions = {

  rejectUnauthorized: true
};

const agent = new https.Agent(agentOptions);


function SlackAPI(hookUrl, httpProxyOptions) {
  this.hook_url = hookUrl;
  this.http_proxy_options = httpProxyOptions;
}

SlackAPI.prototype.send = function(message, cb) {
  if (!message.text) {
    if (cb) cb(null, { message: "No text specified" }, null);
    return;
  }

  const command = this.hook_url;
  const body = {
    text: message.text
  };

  if (message.username) { body.username = message.username; }
  if (message.channel) { body.channel = message.channel; }
  if (message.icon_url) { body.icon_url = message.icon_url; }
  if (message.icon_emoji) { body.icon_emoji = message.icon_emoji; }
  if (message.attachments) { body.attachments = message.attachments; }
  if (message.unfurl_links) { body.unfurl_links = message.unfurl_links; }
  if (message.link_names) { body.link_names = message.link_names; }

  const option = {
    proxy: (this.http_proxy_options && this.http_proxy_options.proxy) || process.env.https_proxy || process.env.http_proxy,
    url: command,
    body: JSON.stringify(body),
    agent: agent
  };
  let d = null;
  if (!cb) d = deferred();


  const req = request.post(option, function(err, res, body) {
    if (!err && body !== "ok") {
      err = { message: body };
      body = null;
    }
    if (err) {
      logger.error(err);
      logger.error("While sending");
      logger.error(JSON.stringify(message));
      logger.error("To Hook: " + command);
      err = null;
    }
    if (d) return err ? d.reject(err) : d.resolve({ res: res, body: body });
    if (cb) return cb(null, err, body);
    return null;
  });

  return d ? d.promise : req;
};


SlackAPI.prototype.respond = function(query, cb) {
  const obj = {};

  obj.token = query.token;
  obj.team_id = query.team_id;
  obj.channel_id = query.channel_id;
  obj.channel_name = query.channel_name;
  obj.timestamp = new Date(query.timestamp);
  obj.user_id = query.user_id;
  obj.user_name = query.user_name;
  obj.text = query.text;

  if (!cb) {
    return { text: "" };
  } else {
    return cb(null, obj);
  }
};

module.exports = SlackAPI;
