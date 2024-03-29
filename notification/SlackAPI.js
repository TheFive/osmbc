import axios from "axios";


import config from "../config.js";





class SlackAPI {
  constructor(hookUrl, httpProxyOptions) {
    this.hook_url = hookUrl;
    this.http_proxy_options = httpProxyOptions;
  }

  send(message, cb) {
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

    let err = null;
    axios.post(command, body)
      .then(response => {
        if (response.data !== "ok") {
          err = { message: response.data };
          config.logger.error(JSON.stringify(err));
          config.logger.error("While sending");
          config.logger.error(JSON.stringify(message));
          config.logger.error("To Hook: " + command);
        }
        if (cb) return cb(null, err, body);
      })
      .catch(error => {
        err = error;
        config.logger.error(JSON.stringify(err));
        config.logger.error("While sending");
        config.logger.error(JSON.stringify(message));
        config.logger.error("To Hook: " + command);
        if (cb) return cb(null, err, body);
      });
  }

  respond(query, cb) {
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
  }
}




export default SlackAPI;
