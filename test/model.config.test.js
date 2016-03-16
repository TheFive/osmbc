"use strict";

var async  = require('async');
var should = require('should');

var sinon  = require('sinon');

var testutil = require('./testutil.js');

var configModule = require('../model/config.js');
var logModule = require('../model/logModule.js');






describe('model/config', function() {
  before(function (bddone) {
    testutil.clearDB(bddone);
  }); 
  describe('createNewConfig',function() {
    it('should createNewConfig with prototype',function(bddone) {
      configModule.createNewConfig({name:"name",yaml:"yaml text"},function (err,result){
        should.not.exist(err);
        var id = result.id;
        testutil.getJsonWithId("config",id,function(err,result){
          should.not.exist(err);
          should(result.name).equal('name');
          should(result.yaml).equal('yaml text');
          bddone();
        });
      });
    });
    it('should createNewUser without prototype',function(bddone) {
      configModule.createNewConfig(function (err,result){
        should.not.exist(err);
        var id = result.id;
        testutil.getJsonWithId("config",id,function(err){
          should.not.exist(err);
          bddone();
        });
      });
    });
    it('should create no New Config with ID',function(bddone){
      (function() {
        configModule.createNewConfig({id:2,name:"test"},function (){
        });
      }).should.throw();
      bddone();
    });
    it('should create no New Config with existing name',function(bddone){
      configModule.createNewConfig({name:"config"},function (err){
        should.not.exist(err);
        configModule.createNewConfig({name:"config"},function(err){
          should.exist(err);
          should(err.message).eql("Config >config< already exists.");
          bddone();
        });
      });
    });
  });
  describe('findFunctions',function() {
    var idToFindLater;
    before(function (bddone) {
      // Initialise some Test Data for the find functions
      async.series([
        testutil.clearDB,
        function c1(cb) {configModule.createNewConfig({name:"Name1",yaml:"1"},cb);},
        function c2(cb) {configModule.createNewConfig({name:"Name2",yaml:"2"},cb);},
        function c3(cb) {configModule.createNewConfig({name:"Name3",yaml:"1"},
                         function(err,result){
                          should.not.exist(err);
                          idToFindLater = result.id;
                          cb(err);
                         });}

        ],function(err) {
          should.not.exist(err);
          bddone();
        });
    });
    describe('find',function() {
      it('should find multiple objects with sort',function(bddone){
        configModule.find({yaml:"1"},{column:"name"},function(err,result){
          should.not.exist(err);
          should.exist(result);
          should(result.length).equal(2);
          delete result[0]._meta;
          delete result[0].id;
          delete result[1]._meta;
          delete result[1].id;
          should(result[0]).eql({name:"Name1",yaml:"1",version:1});
          should(result[1]).eql({name:"Name3",yaml:"1",version:1});
          bddone();
        });
      });
    });
    describe('findOne',function() {
      it('should findOne object with sort',function(bddone){
        configModule.findOne({name:"Name3"},function(err,result){
          should.not.exist(err);
          should.exist(result);
          delete result._meta;
          delete result.id;
          should(result).eql({name:"Name3",yaml:"1",version:1});
          bddone();
        });
      });
    });
    describe('findById',function() {
      it('should find saved Object',function(bddone){
        configModule.findById(idToFindLater,function(err,result){
          should.not.exist(err);
          should.exist(result);
          delete result._meta;
          delete result.id;
          should(result).eql({name:"Name3",yaml:"1",version:1});
          bddone();
        });
      });
    });
  });
  describe('setAndSave',function() {
    beforeEach(function(bddone){
      testutil.clearDB(bddone);
    });
    it('should set only the one Value in the database', function (bddone){
      var newConfig;
      configModule.createNewConfig({name:"Test",yaml:"123"},function(err,result){
        should.not.exist(err);
        newConfig = result;
        var id =result.id;
        newConfig.yaml = "not logged";
        newConfig.setAndSave("user",{version:1,name:"Test2",yaml:"not logged"},function(err) {
          should.not.exist(err);
          testutil.getJsonWithId("config",id,function(err,result){
            should.not.exist(err);
            delete result._meta;
            should(result).eql({id:id,yaml:"not logged",name:"Test2",version:2});
            logModule.find({},{column:"property"},function (err,result){
              should.not.exist(err);
              should.exist(result);
              should(result.length).equal(1);
              var r0id = result[0].id;
              var t0 = result[0].timestamp;
              var now = new Date();
              var t0diff = ((new Date(t0)).getTime()-now.getTime());
         
              // The Value for comparison should be small, but not to small
              // for the test machine.
              should(t0diff).be.below(10);
              should(result[0]).eql({id:r0id,timestamp:t0,oid:id,user:"user",table:"config",property:"name",from:"Test",to:"Test2"});

              // There should be no mail
              bddone();
            });
          });
        });
      });
    }); 
    it('should ignore unchanged Values', function (bddone){
      var newConfig;
      configModule.createNewConfig({name:"Test",yaml:"1234"},function(err,result){
        should.not.exist(err);
        newConfig = result;
        var id =result.id;
        var changeValues = {};
        changeValues.name = newConfig.name;
        changeValues.yaml = newConfig.yaml;
        changeValues.version = 1;
        newConfig.setAndSave("user",changeValues,function(err) {
          should.not.exist(err);
          testutil.getJsonWithId("config",id,function(err,result){
            should.not.exist(err);
            should(result).eql({id:id,name:"Test",yaml:"1234",version:2});
            logModule.find({},{column:"property"},function (err,result){
              should.not.exist(err);
              should.exist(result);
              console.log(result);
              should(result.length).equal(0);
             bddone();
            });
          });
        });
      });
    }); 
  });
});

