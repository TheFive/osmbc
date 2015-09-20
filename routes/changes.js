var express = require('express');
var async   = require('async');
var should = require('should');
var router = express.Router();
var debug = require('debug')('OSMBC:routes:changes');
var logModule = require('../model/logModule.js');

/* GET users listing. */
function renderChangeId(req, res, next) {
  debug('renderChangeId');
  var id = req.params.change_id;
  logModule.findById(id,function(err,change) {
    if (!change || typeof(change.id) == 'undefined') return next();
    should.exist(res.rendervar);
    res.render('change',{change:change,
                         layout:res.rendervar.layout});
  });
}
  

router.get('/:change_id',renderChangeId);

module.exports.renderChangeId = renderChangeId;
module.exports.router = router;


