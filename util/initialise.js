"use strict";


const debug = require("debug")("OSMBC:util:initialize");
const async = require("async");
const logger  = require("../config.js").logger;


const configModule = require("../model/config.js");
const userModule = require("../model/user.js");
const messageCenter = require("../notification/messageCenter.js");
const mailReceiver  = require("../notification/mailReceiver.js");
const slackReceiver  = require("../notification/slackReceiver.js");


// do not know where to place this stuff,
// so i start here to have one initialisation function, which does all


// Initialise Mail Module with all users
function startMailReceiver(callback) {
  debug("startMailReceiver");
  userModule.find({ access: "IN('full','guest')" }, function initUsers(err, result) {
    if (err) {
      return callback(new Error("Error during User Initialising for Mail " + err.message));
    }
    mailReceiver.initialise(result);
    logger.info("Mail Receiver initialised.");
    return callback();
  });
}

function startSlackReceiver(param, callback) {
  debug("startSlackReceiver");

  slackReceiver.initialise(callback);
}


exports.initialiseModules = function(callback) {
  function _initialiseModules(callback) {
    debug("_initialiseModules");
    async.auto({
      configModule: configModule.initialise,
      messageCenter: ["configModule", function(param, callback) { messageCenter.initialise(callback); }],
      startMailReceiver: startMailReceiver,
      startSlackReceiver: ["configModule", startSlackReceiver]
    }, callback);
  }
  if (callback) return _initialiseModules(callback);
  return new Promise((resolve, reject) => {
    _initialiseModules((err, result) => err ? reject(err) : resolve(result));
  });
};
