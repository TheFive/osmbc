var should = require('should');
var debug = require('debug')('OSMBC:router:index');
var express = require('express');
var router = express.Router();

/* GET home page. */

function renderHome(req,res,next) {
  debug('renderHome');
  should.exist(res.rendervar.layout);
  res.render('index', { title: 'Express' , layout:res.rendervar.layout});  
}

router.get('/', renderHome);
router.get('/osmbc.html', renderHome);




module.exports.router = router;
module.exports.renderHome = renderHome;
