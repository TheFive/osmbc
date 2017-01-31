"use strict";

var should = require("should");
var async = require("async");
var sinon = require("sinon");
var logRoutes = require("../routes/changes.js");
var logModule = require("../model/logModule.js");
var testutil = require("./testutil.js");

describe("routes/changes", function() {
  describe("renderChangeId", function() {
    beforeEach(function(bddone) {
      testutil.clearDB(bddone);
    });
    it("should call next if change not exist", function(bddone) {
      logModule.log({titel: "Hallo"}, function(err) {
        should.not.exist(err);
        var newId = 999;
        var req = {};
        req.params = {};
        req.params.change_id = newId;
        var res = {};
        res.set = function() {};
        res.rendervar = {layout: "TEMP"};
        var next;

        async.series([
          function(callback) {
            res.render = sinon.spy(callback);
            next = sinon.spy(callback);
            logRoutes.renderChangeId(req, res, next);
          }],
          function(err) {
            should.not.exist(err);
            should(next.called).be.true();
            should(res.render.called).be.false();
            bddone();
          }
        );
      });
    });
    it("should call prepare rendering", function(bddone) {
      var timestamp = new Date();
      logModule.log({titel: "Hallo", from: "First Text", to: "First new test", timestamp: timestamp}, function(err) {
        should.not.exist(err);
        var newId = 1;
        var req = {};
        req.params = {};
        req.user = "TEST";
        req.params.change_id = newId;
        var res = {};
        res.set = function() {};
        res.rendervar = {layout: "TEMP"};
        var next;

        async.series([
          function(callback) {
            res.render = sinon.spy(callback);
            next = sinon.spy(callback);
            logRoutes.renderChangeId(req, res, next);
          }],
          function() {
            should(next.called).be.false();
            should(res.render.called).be.true();

            var call = res.render.firstCall;
            should(call.calledWith("change")).be.true();
            var renderData = call.args[1];
            should(renderData.layout).equal("TEMP");
            should(renderData.change).eql({titel: "Hallo", id: "1", from: "First Text", to: "First new test", timestamp: timestamp.toISOString()});
            should(renderData.coloredChange).eql('<span style=\"color:grey\">First </span><span class=\"osmbc-deleted-inverted\">Text</span><span class=\"osmbc-inserted-inverted\">new test</span>');
            // should(renderData.moment).equal(moment);
            bddone();
          }
        );
      });
    });
  });
});




