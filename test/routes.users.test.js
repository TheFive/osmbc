"use strict";

const should = require("should");
const config = require("../config.js");
const request = require("request");
const userModule = require("../model/user.js");
const testutil = require("./testutil.js");

const baseLink = "http://localhost:" + config.getServerPort() + config.getValue("htmlroot");

describe("router/user", function() {
  this.timeout(5000);
  beforeEach(function(bddone) {
    config.initialise();
    testutil.importData(
      {
        user: [{OSMUser: "TestUser", access: "full",version:"1",id:1},
          {OSMUser: "TestUserDenied", access: "denied"},
          { "OSMUser": "Hallo", access: "full"}
        ],
        clear:true
      },bddone);
  });
  describe("routes GET /inbox", function(){
    let url = baseLink + "/usert/inbox";
    it("should show the users inbox", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          should(body.indexOf("<h2>Inbox Direct Mention:</h2>")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
          bddone();
        });
      });
    });
  });
  describe("routes GET /list", function(){
    let url = baseLink + "/usert/list";
    it("should show list of users", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          should(body.indexOf("<td><a href=\"/usert/1\">TestUser</a>")).not.equal(-1);
          should(body.indexOf("<td><a href=\"/usert/2\">TestUserDenied</a>")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
          bddone();
        });
      });
    });
  });
  describe("routes GET /create", function(){
    let url = baseLink + "/usert/create";
    it("should create a new user", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url,followRedirect:false}, function (err, response, body) {
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
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
          bddone();
        });
      });
    });
  });
  describe("routes GET /createApiKey", function(){
    let url = baseLink + "/usert/createApiKey";
    it("should create a new user", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url,followRedirect:false}, function (err, response, body) {
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
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
          bddone();
        });
      });
    });
  });
  describe("routes GET /:user_id", function(){
    let url = baseLink + "/usert/1";
    it("should show user data by id", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          should(body.indexOf("<input name=\"OSMUser\" id=\"OSMUser\" value=\"TestUser\" readonly=\"readonly\" class=\"form-control\"/>")).not.equal(-1);
          should(body.indexOf("<h1>TestUser Heatmap</h1>")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should show user data by SELF", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: baseLink + "/usert/self",followRedirect:false}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(302);
          should(body).eql("Found. Redirecting to /usert/1");
          bddone();
        });
      });
    });
    it("should show user data by NAME", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: baseLink + "/usert/TestUserDenied",followRedirect:false}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          should(body.indexOf("<h1>TestUserDenied Heatmap</h1>")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
          bddone();
        });
      });
    });
  });
  describe("routes POST /:user_id", function(){
    let url = baseLink + "/usert/2";
    it("should change user data", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.post({url: url,form:{color:"red",language:"ES"}}, function (err, response) {
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
              articleEditor: 'old',
              languageCount: 'two',
              mailBlogLanguageStatusChange:  []
            });
            bddone();
          });
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.post({url: url,form:{color:"red",language:"ES"}}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url,form:{color:"red",language:"ES"}}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
          bddone();
        });
      });
    });
  });
});
