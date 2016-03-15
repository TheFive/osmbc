"use strict";

var should = require('should');
var async  = require('async');
var fs     = require('fs');
var path = require('path');

var testutil = require('./testutil.js');
var logModule = require('../model/logModule.js');



describe('model/changes',function() {
  context('Change Constructor',function(){
    it('should create a Change object',function(){
      var change = logModule.create({oid:"Test"});
      should(change.oid).eql("Test");
      should(typeof(change)).eql('object');
      should(change instanceof logModule.Class).be.True();
    });
  });
  context('find',function() {
    beforeEach(function (bddone) {
      testutil.clearDB(bddone);
    });
    it('should find nothing',function (bddone) {
      logModule.find({table:"usert",oid:1},{column:"oid"},function(err,result){
        should.not.exist(err);
        should(result).eql([]);
        bddone();
      });
    });
  });
  context('countLogsForBlog',function(){
    beforeEach(function(bddone){
      testutil.clearDB(bddone);
    });
    it('should count the different logs',function(bddone){
      async.parallel([
        function writeLog1(cb){logModule.log({user:"Test1",blog:"Test",property:"field1"},cb);},
        function writeLog2(cb){logModule.log({user:"Test1",blog:"Test",property:"field1"},cb);},
        function writeLog3(cb){logModule.log({user:"Test2",blog:"Test",property:"field2"},cb);},
        function writeLog4(cb){logModule.log({user:"Test2",blog:"Test",property:"field3"},cb);},
        function writeLog5(cb){logModule.log({user:"Test2",blog:"Test",property:"field4"},cb);},
        function writeLog6(cb){logModule.log({user:"Test2",blog:"OtherTest",property:"field1"},cb);}

      ],function(err){
        should.not.exist(err);
        logModule.countLogsForBlog("Test",function(err,result){
          should.not.exist(err);
          should(result).eql({"field1":{"Test1":2},"field2":{"Test2":1},"field3":{"Test2":1},"field4":{"Test2":1}});
          bddone();
        });
      });
    });
  });
  context('htmlDiffText',function() {
    it('should generate a colored word based diff',function(){
      var change = new logModule.Class({from:"This is The origin text",to:"And This is the changed text"});
      should(change.htmlDiffText(40)).equal('<span class="osmbc-inserted">And </span>\n<span style="color:grey">…</span>\n<span class="osmbc-deleted">The</span>\n<span class="osmbc-inserted">the</span>\n<span style="color:grey">…</span>\n<span class="osmbc-deleted">origin</span>\n<span class="osmbc-inserted">changed</span>\n<span style="color:grey">…</span>\n');
    });
    it('should handle emptry from',function(){
      var change = new logModule.Class({to:"And This is the changed text"});
      should(change.htmlDiffText(40)).equal('<span class="osmbc-inserted">And This is the changed text</span>\n');
    });
    it('should handle emptry to',function(){
      var change = new logModule.Class({from:"And This is the changed text"});
      should(change.htmlDiffText(40)).equal('<span class="osmbc-deleted">And This is the changed text</span>\n');
    });
    it('should handle bool Value',function(){
      var change = new logModule.Class({to:true});
      should(change.htmlDiffText(40)).equal('<span class="osmbc-inserted">true</span>\n');
    });
    it('should find out only inserted spaces',function(){
      var change = new logModule.Class({from:"This is The origin text with [markup](www.google.de)",to:"This is The origin text with [markup] (www.go ogle.de)"});
      should(change.htmlDiffText(40)).eql('<span class="osmbc-inserted">ONLY SPACES ADDED</span>');
    });
    it('should find out only deleted spaces',function(){
      var change = new logModule.Class({to:"This is The origin text with [markup](www.google.de)",from:"This is The origin text with [markup] (www.go ogle.de)"});
      should(change.htmlDiffText(40)).eql('<span class="osmbc-deleted">Only spaces removed</span>');
    });

    it('should find find changes in long text',function(){
      var markdownDE = fs.readFileSync(path.resolve(__dirname,"data","model.longmarkdownDE.txt"),"UTF8");
      var markdownDE2 = fs.readFileSync(path.resolve(__dirname,"data","model.longmarkdownDE2.txt"),"UTF8");

      var change = new logModule.Class({to:markdownDE,from:markdownDE2});
      should(change.htmlDiffText(40)).eql('Disabled for texts longer than 2000 chars.');
    });
  });
});
