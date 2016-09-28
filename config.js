"use strict";


module.exports.pgstring = "UNDEFINED";



var path    = require('path');
var fs      = require('fs');
var debug   = require('debug')('configuration');
var should  = require('should');
var env = process.env.NODE_ENV || 'development';






// the configurationfile should be in the "running" directory
var configurationFile = path.resolve(__dirname, 'config.'+env+'.json');
var configuration;
var configurationInitialised = false;




function getPostgresDBString() {
  debug('getPostgresDBString');
  configuration=exports.getConfiguration();
  var userString = "";
  if (configuration.postgres.username !== "") {
    userString = configuration.postgres.username + ':' + configuration.postgres.password +'@';
  }
  var connectStr ='postgres://' +
              userString +
              configuration.postgres.database;
  if ((typeof(configuration.postgres.connectstr)!='undefined' ) &&
      (configuration.postgres.connectstr !== '' )) {
        connectStr = configuration.postgres.connectstr;
      }
  if (!connectStr) {
    console.log("Could not build a connection string for postgres. App is terminating");
    process.exit(1);
  }
  return connectStr;
}

exports.getLanguages = function() {
  debug('getLanguages');
  configuration=exports.getConfiguration();
  return configuration.languages;
};








exports.initialise = function initialise(callback) {
  debug("initialise");
  if (configurationInitialised) {
    if (callback) callback();
    return;
  }
  configurationInitialised = true;
	console.log("Reading Config from: "+configurationFile);
	configuration = JSON.parse(fs.readFileSync(configurationFile));
  //pg.defaults.poolSize = 40;
  //console.log("Postgres Poolsize = 40");

  // Do some tests with the types

  should(typeof(configuration.ReviewInWP)).equal("object");
  should(typeof(configuration.languages)).equal("object");

  exports.pgstring = getPostgresDBString();
	if (callback) callback();
};



exports.getConfiguration = function() {
  exports.initialise();
	return configuration;
};
exports.getValue = function(key,options) {
  exports.initialise();
  if (options) should(typeof(options)).eql("object");
  var result;
  if (options) {
    result = options.default;
  }
  if (typeof(configuration[key]) != 'undefined') {
    result = configuration[key];
  }
  if (options && options.mustExist && ! result) {
    console.log("Missing Value in config.*.json. Name: '"+key+"'");
    process.exit(1);
  }
  return result;
};







exports.getServerPort = function() {
  exports.initialise();
  return exports.getValue("serverport",{mustExist:true});
};

exports.getCallbackUrl = function() {
  exports.initialise();
  return configuration.callbackUrl;
};

exports.env = env;


