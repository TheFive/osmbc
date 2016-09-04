"use strict";

var debug = require('debug')('OSMBC:routes:api');
var express = require('express');
var userModule = require('../model/user.js');
var publicRouter = express.Router();

var config = require('../config.js');


// If function is called just return OK
function isServerUp(req,res,next) {
  debug('isServerUp');
  var apiKey = req.params.apiKey;
  console.log(apiKey);
  console.log(config.getValue("ApiKey"));
  if (apiKey != config.getValue("apiKey")) {
    let err = new Error("Not Authorised");
    err.status = 401;
    return next(err);
  }
  res.end("OK");
}

// If function is called query a postgres user,
// and check, wether there is a postgres error
function isPostgresUp(req,res,next) {
  debug('isPostgresUp');
  var apiKey = req.params.apiKey;
  if (apiKey != config.getValue("apiKey")) {
    let err = new Error("Not Authorised");
    err.status = 401;
    return next(err);
  }
  userModule.find({OSMUser:"test"},function(err){
    if (err) return res.end("Postgres Error");
    res.end('OK');
  });
}

publicRouter.get('/monitor/:apiKey', isServerUp);
publicRouter.get('/monitorPostgres/:apiKey', isPostgresUp);

module.exports.publicRouter = publicRouter;
