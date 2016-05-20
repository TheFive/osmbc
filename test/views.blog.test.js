"use strict";

var async = require('async');
var testutil = require('./testutil.js');
var nock = require("nock");
var should  = require('should');
var request   = require('request');
var path = require('path');
var fs = require('fs');

var config = require('../config.js');

var configModule = require('../model/config.js');





describe('views/blog', function() {
  let baseLink;
  var data;
  describe('export',function(){
    before(function(bddone) {
      var file =  path.resolve(__dirname,'data', "views.blog.export.1.json");
      data =  JSON.parse(fs.readFileSync(file));
      baseLink = 'http://localhost:' + config.getServerPort() + config.getValue("htmlroot");
      nock('https://hooks.slack.com/')
        .post(/\/services\/.*/)
        .times(999)
        .reply(200,"ok");

      process.env.TZ = 'Europe/Amsterdam';
      async.series([
        testutil.importData.bind(null,data),
        testutil.startServer.bind(null,"USER1"),
        configModule.initialise
      ],bddone);


    });
    after(function(){
      nock.cleanAll();
      testutil.stopServer();
    });
    it('should generate preview as html',function(bddone){

      async.series([

        function(cb){
          var opts = {
            url: baseLink+"/blog/"+data.blogName+"/preview?lang=DE&download=true", method: 'get'
          };
          request(opts, function (err, res, body) {
            should.not.exist(err);
            console.dir(body);
            should(res.statusCode).eql(200);
            let file =  path.resolve(__dirname,'data', "views.blog.export.1.html");
            let expectation =  fs.readFileSync(file,"UTF8");

            var result = testutil.domcompare(body,expectation);



            if (result.getDifferences().length>0) {
              console.log("---------Result:----------");
              console.log(body);
              console.log("---------expected Result:----------");
              console.log(expectation);

              should.not.exist(result.getDifferences());
            }
            cb();
          });
        }
      ],bddone);
    });
    it('should generate preview as markdown',function(bddone){

      async.series([

        function(cb){
          var opts = {
            url: baseLink+"/blog/"+data.blogName+"/preview?lang=markdownDE&download=true", method: 'get'
          };
          request(opts, function (err, res, body) {
            should.not.exist(err);
            console.dir(body);
            should(res.statusCode).eql(200);
            let file =  path.resolve(__dirname,'data', "views.blog.export.1.md");
            let expectation =  fs.readFileSync(file,"UTF8");

            should(body).eql(expectation);
            cb();
          });
        }
      ],bddone);
    });
  });
});