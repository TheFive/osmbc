var should  = require('should');
var sinon   = require('sinon');
var async   = require('async');
var config  = require('../config.js');

var indexRoutes = require('../routes/index.js');

var testutil = require('./testutil.js');

describe('routes/index',function(){
  before(function(bddone){
    config.initialise();
    testutil.clearDB(bddone);
  })
  describe('renderHome',function(){
    it('should call the right Page',function(bddone){
      var res = {rendervar:{}};
      var req = {};
      var next;
      async.series([
        function test(callback) {
          next = sinon.spy(callback);
          res.render = sinon.spy(callback);
          res.rendervar.layout = "TEST";
          indexRoutes.renderHome(req,res,next);
        }

        ],function check(err) {
          should(res.render.called).be.true();
          should(next.called).be.false();
          should(res.render.firstCall.calledWith("index")).be.true();
          bddone();
        }
      )
    })
  })
})