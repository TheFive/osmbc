


import _debug from "debug";
import config from "../config.js";


import configModule from "../model/config.js";
import userModule from "../model/user.js";
import messageCenter from "../notification/messageCenter.js";
import { initialiseMailReceiver } from "../notification/mailReceiver.js";
import { initialiseSlackReceiver } from "../notification/slackReceiver.js";
import async from "async";
const debug = _debug("OSMBC:util:initialize");


// do not know where to place this stuff,
// so i start here to have one initialisation function, which does all


// Initialise Mail Module with all users
function startMailReceiver(callback) {
  debug("startMailReceiver");
  userModule.find({ access: "IN('full','guest')" }, function initUsers(err, result) {
    if (err) {
      return callback(new Error("Error during User Initialising for Mail " + err.message));
    }
    initialiseMailReceiver(result);
    config.logger.info("Mail Receiver initialised.");
    return callback();
  });
}

function startSlackReceiver(param, callback) {
  debug("startSlackReceiver");

  initialiseSlackReceiver(callback);
}


function initialiseModules(callback) {
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

export default initialiseModules;
