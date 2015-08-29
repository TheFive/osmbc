

var pg     = require('pg');
var async  = require('async');
var should = require('should');
var path   = require('path');
var debug  = require('debug')('OSMBC:test:user.test');

var config = require('../config.js');

var testutil = require('./testutil.js');

var userModule = require('../model/user.js');







describe('model/user', function() {
  before(function (bddone) {
    testutil.clearDB(bddone);
  }) 

  describe('createNewUser',function() {
    it('should createNewUser with prototype',function(bddone) {
      var newUser = userModule.createNewUser({name:"user"},function (err,result){
        should.not.exist(err);
        var id = result.id;
        testutil.getJsonWithId("usert",id,function(err,result){
          should.not.exist(err);
          should(result.name).equal('user');
          bddone();
        })
      })
    });
    it('should createNewUser without prototype',function(bddone) {
      var newUser = userModule.createNewUser(function (err,result){
        should.not.exist(err);
        var id = result.id;
        testutil.getJsonWithId("usert",id,function(err,result){
          should.not.exist(err);
          bddone();
        })
      });
    })
    it('should create no New User with ID',function(bddone){
      (function() {
        var newUser = userModule.createNewUser({id:2,name:"me again"},function (err,result){
        })
      }).should.throw();
      bddone();
    })
  })
})
