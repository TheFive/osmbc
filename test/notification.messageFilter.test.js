"use strict";



var should = require('should');

var UserConfigFilter = require('../notification/UserConfigFilter.js');






describe('notification/messagefilter', function() {
  describe('UserConfigFilter',function(){
    var dummy;
    var called;
    beforeEach(function(){
      called = false;
      dummy = {addComment:function(user,article,comment,callback){
        called = true;
        callback();
      },editComment:function(user,article,index,comment,callback) {
        called = true;
        callback();
      }};
    });

    it('should filter comments that are addressed (Language)',function(bddone){
      var ucf = new UserConfigFilter({mailComment:["DE","TheFive"]},dummy);
      ucf.addComment({OSMUser:"TheFive"},{},"Comment for @DE ",function (err){
        should.not.exist(err);
        should(called).be.True();
        bddone();
      });
    });
    it('should filter comments that are addressed (user)',function(bddone){
      var ucf = new UserConfigFilter({mailComment:["DE","TheFive"]},dummy);
      ucf.addComment({OSMUser:"TheFive"},{},"Comment for @TheFive test",function (err){
        should.not.exist(err);
        should(called).be.True();
        bddone();
      });
    });
    it('should filter comments that are not addressed',function(bddone){
      var ucf = new UserConfigFilter({mailComment:["DE","TheFive"]},dummy);
      ucf.addComment({OSMUser:"TheFive"},{},"Comment for @tester test",function (err){
        should.not.exist(err);
        should(called).be.False();
        bddone();
      });
    });
    it('should filter comments that start with search key',function(bddone){
      var ucf = new UserConfigFilter({mailComment:["DE","TheFive"]},dummy);
      ucf.addComment({OSMUser:"TheFive"},{},"Comment for @derTom test",function (err){
        should.not.exist(err);
        should(called).be.False();
        bddone();
      });
    });
    it('should filter comments that are addressed (Language)',function(bddone){
      var ucf = new UserConfigFilter({mailComment:["DE","TheFive"]},dummy);
      ucf.editComment({OSMUser:"TheFive"},{},0,"Comment for @DE ",function (err){
        should.not.exist(err);
        should(called).be.True();
        bddone();
      });
    });
    it('should filter comments that are addressed (user)',function(bddone){
      var ucf = new UserConfigFilter({mailComment:["DE","TheFive"]},dummy);
      ucf.editComment({OSMUser:"TheFive"},{},0,"Comment for @TheFive test",function (err){
        should.not.exist(err);
        should(called).be.True();
        bddone();
      });
    });
    it('should filter comments that are not addressed',function(bddone){
      var ucf = new UserConfigFilter({mailComment:["DE","TheFive"]},dummy);
      ucf.editComment({OSMUser:"TheFive"},{},0,"Comment for @tester test",function (err){
        should.not.exist(err);
        should(called).be.False();
        bddone();
      });
    });
    it('should filter comments that start with search key',function(bddone){
      var ucf = new UserConfigFilter({mailComment:["DE","TheFive"]},dummy);
      ucf.editComment({OSMUser:"TheFive"},{},0,"Comment for @derTom test",function (err){
        should.not.exist(err);
        should(called).be.False();
        bddone();
      });
    });
  });
});
