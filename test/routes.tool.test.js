"use strict";

var should  = require("should");
var async   = require("async");
var nock    = require("nock");
var request = require("request");
var config  = require("../config.js");
var testutil = require("./testutil.js");
var initialise = require("../util/initialise.js");


var baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();


describe("routes/tool", function() {
  let jar = null;
  before(function(bddone){
    async.series([
      initialise.initialiseModules,
      testutil.clearDB],bddone);
  });
  after(function(bddone){
    testutil.stopServer(bddone);
  });
  let nockLoginPage;
  afterEach(function(bddone){
    nock.removeInterceptor(nockLoginPage);
    return bddone();
  });

  beforeEach(function(bddone) {
    config.initialise();
    nockLoginPage = testutil.nockLoginPage();
    jar = request.jar();
    testutil.importData(
      {
        user: [{"OSMUser": "TestUser", access: "full",version:"1"},
          {OSMUser: "TestUserDenied", access: "denied"},
          { "OSMUser": "Hallo", access: "full"}
        ],
        clear:true
      },bddone);
  });
  describe("route GET  /tool/calendarAllLang",function(){
    before(function(bddone){
      nock('http://localhost:33333')
        .get('/fakeCalendar')
        .reply(200,{events:[]});
      bddone();
    });
    let url = baseLink + "/tool/calendarAllLang/fakeCalendar";
    it("should show calendar", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url,jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql("<h1>Calendar Tool (fakeCalendar)</h1>");
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url,jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserDenied&lt; has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url,jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserNonExisting&lt; has not enough access rights");
          bddone();
        });
      });
    });
  });
  describe("route GET  /tool/picturetool",function(){
    let url = baseLink + "/tool/picturetool";
    it("should show picture tool", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url,jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql("<h1>Generate OSMBC Picture Markdown</h1>");
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url,jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserDenied&lt; has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url,jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserNonExisting&lt; has not enough access rights");
          bddone();
        });
      });
    });
  });
  describe("route POST /tool/picturetool",function(){
    let url = baseLink + "/tool/picturetool";
    it("should call picture tool", function (bddone) {
      testutil.startServerWithLogin("TestUser",jar, function () {
        request.post({url: url, form: {},jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(302);
          should(body).eql("Found. Redirecting to /tool/picturetool");
          return bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url,jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserDenied&lt; has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url,jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserNonExisting&lt; has not enough access rights");
          bddone();
        });
      });
    });
  });
});


