var express = require('express');
var async   = require('async');
var moment = require('moment');
var router = express.Router();
var debug = require('debug')('OSMBC:routes:article');
var logModule = require('../model/logModule.js');

/* GET users listing. */
function renderChangeId(req, res, next) {
  debug('renderChangeId');
  var id = req.params.change_id;
  logModule.findById(id,function(err,change) {
    console.dir(change);
    if (!change || typeof(change.id) == 'undefined') return next();
    res.render('change',{change:change,user:req.user,moment:moment});
  });
}
  

router.get('/:change_id',renderChangeId);

module.exports.renderChangeId = renderChangeId;
module.exports.router = router;


