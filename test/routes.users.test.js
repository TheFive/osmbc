"use strict";

const should = require("should");
const async  = require("async");
const nock   = require("nock");
const config = require("../config.js");
const request = require("request");
const userModule = require("../model/user.js");
const testutil = require("./testutil.js");
var initialise = require("../util/initialise.js");

const baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();

describe("router/user", function() {
  this.timeout(5000);
  let jar = null;
  before(function(bddone){
    async.series([
      initialise.initialiseModules,
      testutil.clearDB],bddone);
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
        user: [{OSMUser: "TestUser", access: "full",version:"1",id:1,lastAccess:"20160102"},
          {OSMUser: "TestUserDenied", access: "denied"},
          { "OSMUser": "Hallo", access: "full"}
        ],
        clear:true
      },bddone);
  });
  after(function(bddone){
    testutil.stopServer();
    bddone();
  });
  describe("routes GET /inbox", function(){
    let url = baseLink + "/usert/inbox";
    it("should show the users inbox", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url,jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql("<h2>Inbox Direct Mention:</h2>");
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url,jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url,jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.not.containEql("<h2>Inbox Inirect Mention:</h2>");
          body.should.containEql("<h2>Inbox Direct Mention:</h2>");
          bddone();
        });
      });
    });
  });
  describe("routes GET /list", function(){
    let url = baseLink + "/usert/list";
    it("should show list of users", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url,jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql("<td><a href=\"/usert/1\">TestUser</a>");
          body.should.containEql("<td><a href=\"/usert/2\">TestUserDenied</a>");
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url,jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing / guest user", function (bddone) {
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
  describe("routes GET /create", function(){
    let url = baseLink + "/usert/create";
    it("should create a new user", function (bddone) {
      testutil.startServerWithLogin("TestUser",jar, function () {
        request.get({url: url,followRedirect:false,jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(302);

          // New user has id 4, as there are 3 in test data.
          should(body).eql("Found. Redirecting to /usert/4?edit=true");
          userModule.findById(4,function(err,user){
            should.not.exist(err);
            should.exist(user);
            should(user).eql({
              "id": "4",
              "version": 1
            });
            bddone();
          });
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url,jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
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
  describe("routes GET /createApiKey", function(){
    let url = baseLink + "/usert/createApiKey";
    it("should create a new user", function (bddone) {
      testutil.startServerWithLogin("TestUser",jar, function () {
        request.get({url: url,followRedirect:false,jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(302);
          should(body).eql("Found. Redirecting to /");
          userModule.findById(1,function(err,user){
            should.not.exist(err);
            should.exist(user);
            should.exist(user.apiKey);
            bddone();
          });
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url,jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
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
  describe("routes GET /:user_id", function(){
    let url = baseLink + "/usert/1";
    it("should show user dafta by id", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url,jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql('<input class="form-control" name="OSMUser" id="OSMUser" value="TestUser" readonly="readonly"/>');
          body.should.containEql("<h1>TestUser Heatmap</h1>");
          bddone();
        });
      });
    });
    it("should show user data by SELF", function (bddone) {
      testutil.startServerWithLogin("TestUser", jar,function () {
        request.get({url: baseLink + "/usert/self",followRedirect:false,jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(302);
          should(body).eql("Found. Redirecting to /usert/1");
          bddone();
        });
      });
    });
    it("should show user data by NAME", function (bddone) {
      testutil.startServerWithLogin("TestUser",jar, function () {
        request.get({url: baseLink + "/usert/TestUserDenied",followRedirect:false,jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql("<h1>TestUserDenied Heatmap</h1>");
          bddone();
        });
      });
    });
    it("should show user data for fresh created guest user", function (bddone) {
      testutil.startServerWithLogin("TestUserNewGuest",jar, function () {
        request.get({url: baseLink + "/usert/TestUserNewGuest",followRedirect:false,jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql("<h1>TestUserNewGuest Heatmap</h1>");
          bddone();
        });
      });
    });
    it("should not show user data of other user for fresh created guest user", function (bddone) {
      testutil.startServerWithLogin("TestUserNewGuest",jar, function () {
        request.get({url: baseLink + "/usert/TestUserDenied",followRedirect:false,jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("Not allowed for guests.");
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url,jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url,jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("Not allowed for guests.");
          bddone();
        });
      });
    });
  });
  describe("routes POST /:user_id", function(){
    let url = baseLink + "/usert/2";
    it("should change user data", function (bddone) {
      testutil.startServerWithLogin("TestUser",jar, function () {
        request.post({url: url,form:{color:"red",language:"ES"},jar:jar}, function (err, response) {
          should.not.exist(err);
          should(response.statusCode).eql(302);
          userModule.findById(2,function(err,user){
            should.not.exist(err);
            should(user).eql({
              id: '2',
              OSMUser: 'TestUserDenied',
              access: 'denied',
              version: 2,
              mailComment:  [],
              color: 'red',
              language: 'ES',
              languageCount: 'two',
              mailBlogLanguageStatusChange:  []
            });
            bddone();
          });
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServerWithLogin("TestUserDenied",jar, function () {
        request.post({url: url,form:{color:"red",language:"ES"},jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("OSM User >TestUserDenied< has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServerWithLogin("TestUserNonExisting",jar , function () {
        request.post({url: url,form:{color:"red",language:"ES"},jar:jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(403);
          body.should.containEql("Not Allowed To Post this user");
          bddone();
        });
      });
    });
  });
});
