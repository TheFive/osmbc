var should = require('should');
var debug = require('debug')('OSMBC:router:index');
var express = require('express');
var router = express.Router();

var logModule = require('../model/logModule.js');

/* GET home page. */

function renderHome(req,res,next) {
  debug('renderHome');
  should.exist(res.rendervar.layout);

  logModule.find({},{column:"id",desc :true,limit:20},function(err,result) {
    if (err) return next(err);
  
    res.render('index', { title: 'OSMBC' , 
                          layout:res.rendervar.layout,
                          changes:result});  
  })
}

router.get('/', renderHome);
router.get('/osmbc.html', renderHome);




module.exports.router = router;
module.exports.renderHome = renderHome;
