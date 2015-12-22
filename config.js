

module.exports.pgstring = "UNDEFINED";



var path    = require('path');
var fs      = require('fs');
var debug   = require('debug')('configuration');
var should  = require('should');
var env = process.env.NODE_ENV || 'development';

var pg = require('pg');





// the configurationfile should be in the "running" directory
var configurationFile = path.resolve(__dirname, 'config.'+env+'.json');
var configuration;
var configurationInitialised = false;




function getPostgresDBString() {
  debug('getPostgresDBString');
  configuration=exports.getConfiguration();
  var userString = "";
  if (configuration.postgres.username != "") {
    userString = configuration.postgres.username + ':'
                 + configuration.postgres.password +'@';
  }
  var connectStr ='postgres://'
             + userString
             + configuration.postgres.database;
  if ((typeof(configuration.postgres.connectstr)!='undefined' ) &&
      (configuration.postgres.connectstr != '' )) {
        connectStr = configuration.postgres.connectstr;
      }
  return connectStr;
}

exports.getLanguages = function() {
  debug('getLanguages');
  configuration=exports.getConfiguration();
  return configuration.languages;
}








exports.initialise = function(callback) {
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

  should(typeof(configuration["ReviewInWP"])).equal("object");
  should(typeof(configuration.languages)).equal("object");

  exports.pgstring = getPostgresDBString();
	if (callback) callback();
}



exports.getConfiguration = function() {
    if (typeof(configuration)=='undefined')
    {
    	exports.initialise();
    }
	return configuration;
}
exports.getValue = function(key,defValue) {
    if (typeof(configuration)=='undefined')
    {
    	exports.initialise();
    }
    var result = defValue;
    if (typeof(configuration[key]) != 'undefined') {
    	result = configuration[key];
    }
    return result;
}







exports.getServerPort = function() {
  if (typeof(configuration)=='undefined')
  {
    exports.initialise();
  }
	return configuration.serverport;
}
exports.getCallbackUrl = function() {
  if (typeof(configuration)=='undefined')
  {
    exports.initialise();
  }
  return configuration.callbackUrl;
}

exports.env = env;


