

import should from "should";
import async from "async";
import fs from "fs";
import path from "path";

import testutil from "./testutil.js";
import logModule from "../model/logModule.js";
import initialiseModules from "../util/initialise.js";
import config from "../config.js";




describe("model/changes", function() {
  before(function(bddone) {
    initialiseModules(bddone);
  });
  context("Change Constructor", function() {
    /* eslint-disable mocha/no-synchronous-tests */
    it("should create a Change object", function() {
      const change = logModule.create({ oid: "Test" });
      should(change.oid).eql("Test");
      should(typeof (change)).eql("object");
      should(change instanceof logModule.Class).be.True();
    });
  });
  context("find", function() {
    beforeEach(function (bddone) {
      testutil.clearDB(bddone);
    });
    it("should find nothing", function (bddone) {
      logModule.find({ table: "usert", oid: 1 }, { column: "oid" }, function(err, result) {
        should.not.exist(err);
        should(result).eql([]);
        bddone();
      });
    });
  });
  context("countLogsForBlog", function() {
    beforeEach(function(bddone) {
      testutil.clearDB(bddone);
    });
    it("should count the different logs", function(bddone) {
      async.parallel([
        function writeLog1a(cb) { logModule.log({ user: "Test1", blog: "Test", oid: "1", property: "field1" }, cb); },
        function writeLog1b(cb) { logModule.log({ user: "Test1", blog: "Test", oid: "1", property: "field1" }, cb); },
        function writeLog2(cb) { logModule.log({ user: "Test1", blog: "Test", oid: "2", property: "field1" }, cb); },
        function writeLog3(cb) { logModule.log({ user: "Test2", blog: "Test", oid: "3", property: "field2" }, cb); },
        function writeLog4(cb) { logModule.log({ user: "Test2", blog: "Test", oid: "4", property: "field3" }, cb); },
        function writeLog5(cb) { logModule.log({ user: "Test2", blog: "Test", oid: "5", property: "field4" }, cb); },
        function writeLog6(cb) { logModule.log({ user: "Test2", blog: "Test", oid: "6", property: "comment1" }, cb); },
        function writeLog7(cb) { logModule.log({ user: "Test2", blog: "Test", oid: "6", property: "comment2" }, cb); },
        function writeLog8(cb) { logModule.log({ user: "Test2", blog: "Test", oid: "7", property: "comment1" }, cb); },
        function writeLog9(cb) { logModule.log({ user: "Test2", blog: "OtherTest", oid: "6", property: "field1" }, cb); }

      ], function(err) {
        should.not.exist(err);
        logModule.countLogsForBlog("Test", function(err, result) {
          should.not.exist(err);
          should(result).eql({ field1: { Test1: 2 }, field2: { Test2: 1 }, field3: { Test2: 1 }, field4: { Test2: 1 }, comment: { Test2: 2 } });
          bddone();
        });
      });
    });
  });
  context("htmlDiffText", function() {
    it("should generate a colored word based diff", function() {
      const change = new logModule.Class({ from: "This is The origin text", to: "And This is the changed text" });
      should(change.htmlDiffText(40)).equal('<span class="osmbc-inserted">And </span>\n<span style="color:grey">…</span>\n<span class="osmbc-deleted">The</span>\n<span class="osmbc-inserted">the</span>\n<span style="color:grey">…</span>\n<span class="osmbc-deleted">origin</span>\n<span class="osmbc-inserted">changed</span>\n<span style="color:grey">…</span>\n');
    });
    it("should handle emptry from", function() {
      const change = new logModule.Class({ to: "And This is the changed text" });
      should(change.htmlDiffText(40)).equal('<span class="osmbc-inserted">And This is the changed text</span>\n');
    });
    it("should handle emptry to", function() {
      const change = new logModule.Class({ from: "And This is the changed text" });
      should(change.htmlDiffText(40)).equal('<span class="osmbc-deleted">And This is the changed text</span>\n');
    });
    it("should handle bool Value", function() {
      const change = new logModule.Class({ to: true });
      should(change.htmlDiffText(40)).equal('<span class="osmbc-inserted">true</span>\n');
    });
    it("should find out only inserted spaces", function() {
      const change = new logModule.Class({ from: "This is The origin text with [markup](www.google.de)", to: "This is The origin text with [markup] (www.go ogle.de)" });
      should(change.htmlDiffText(40)).eql('<span class="osmbc-inserted">ONLY SPACES ADDED</span>');
    });
    it("should find out only deleted spaces", function() {
      const change = new logModule.Class({ to: "This is The origin text with [markup](www.google.de)", from: "This is The origin text with [markup] (www.go ogle.de)" });
      should(change.htmlDiffText(40)).eql('<span class="osmbc-deleted">Only spaces removed</span>');
    });

    it("should find find changes in long text", function() {
      const markdownDE = fs.readFileSync(path.resolve(config.getDirName(), "test", "data", "model.longmarkdownDE.txt"), "UTF8");
      const markdownDE2 = fs.readFileSync(path.resolve(config.getDirName(), "test", "data", "model.longmarkdownDE2.txt"), "UTF8");

      const change = new logModule.Class({ to: markdownDE, from: markdownDE2 });
      should(change.htmlDiffText(40)).eql("Disabled for texts longer than 1500 chars.");
    });
    /* eslint-enable mocha/no-synchronous-tests */
  });
});
