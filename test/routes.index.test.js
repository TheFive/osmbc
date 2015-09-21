var should = require('should');
var sinon = require('sinon');
var blogRoutes = require('../routes/index.js');

describe('routes/index',function(){
  describe('renderHome',function(){
    it('should call the rigt Page',function(bddone){
      var res = {rendervar:{}};
      var req = {};

      var next = sinon.spy();
      res.render = sinon.spy();
      res.rendervar.layout = "TEST";
      blogRoutes.renderHome(req,res,next);
      should(res.render.called).be.true();
      should(next.called).be.false();
      should(res.render.firstCall.calledWith("index")).be.true();
      bddone();
    })
  })
})