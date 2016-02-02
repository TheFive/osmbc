"use strict";

var debug = require("debug")("passport-stub");
var done, passportStub;

done = function(user, req, next) {
  return next(null, user);
};

passportStub = (function(_this) {
  debug("passportStub");
  return function(req, res, next) {
    var passport;
    if (!_this.active) {
      return next();
    }
    passport = {
      deserializeUser: done,
      serializeUser: done,
      _userProperty: 'user',
      _key: 'passport'
    };
    req.__defineGetter__('_passport', function() {
      return {
        instance: passport,
        session: {
          user: _this.user
        }
      };
    });
    req.__defineGetter__('user', function() {
      return _this.user;
    });
    req.__defineSetter__('user', function(val) {
      _this.user = val;
      return val; 
    });
    return next();
  };
})(this); //jshint ignore:line

exports.install = function(app) {
  debug("passportStub");
  this.app = app;
  return this.app._router.stack.unshift({
    match: function() {
      return true;
    },
    path: '',
    handle: passportStub,
    handle_request: passportStub,
    _id: 'passport.stub'
  });
};

exports.uninstall = function() {
  debug("uninstall");
  if (this.app === null) {
    return;
  }
  return this.app._router.stack.forEach(function(middleware, index, stack) {
    if (middleware._id === 'passport.stub') {
      return stack.splice(index, 1);
    }
  });
};

exports.login = function(user) {
  debug("login");
  if (this.app === null) {
    throw new Error('Passport Stub not installed. Please run "passportStub.install(app)" first.');
  }
  this.active = true;
  this.user = user;
  return user; 
};

exports.logout = function() {
  debug("logout");
  this.active = false;
  return false; 
};
