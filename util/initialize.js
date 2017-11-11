"use strict";


var debug = require("debug")("OSMBC:util:initialize");
var async = require("async");
var logger  = require('../config.js').logger;


var configModule = require('../model/config.js');
var userModule = require('../model/user.js');
var messageCenter = require('../notification/messageCenter.js');
var mailReceiver  = require('../notification/mailReceiver.js');
var slackReceiver  = require('../notification/slackReceiver.js');


// do not know where to place this stuff,
// so i start here to have one initialisation function, which does all


// Initialise Mail Module with all users
function startMailReceiver(callback) {
  debug("startMailReceiver");
  userModule.find({access:"full"},function initUsers(err,result) {
    if (err) {
      return callback(new Error("Error during User Initialising for Mail "+err.message));
    }
    mailReceiver.initialise(result);
    logger.info("Mail Receiver initialised.");
    return callback();
  });
}



function startSlackReceiver(param,callback) {
  debug("startSlackReceiver");

  slackReceiver.initialise(callback);
}




exports.initialiseModules = function(callback) {
  debug("initialiseModules");
  async.auto({
    configModule:configModule.initialise,
    messageCenter:["configModule",function(param,callback){messageCenter.initialise(callback);}],
    startMailReceiver:startMailReceiver,
    startSlackReceiver:["configModule",startSlackReceiver]
  },callback);
};
function startSlackReceiver(param,callback) {
  debug("startSlackReceiver");

  slackReceiver.initialise(callback);
}
