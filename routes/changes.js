var express = require('express');
var async   = require('async');
var moment = require('moment');
var router = express.Router();
var debug = require('debug')('OSMBC:routes:article');
var logModule = require('../model/logModule.js');

/* GET users listing. */
router.get('/:change_id', function(req, res, next) {
  debug('router.get');
  var id = req.params.change_id;
  logModule.findById(id,function(err,change) {
    if (typeof(change.id) == 'undefined') return next();
    res.render('change',{change:change,user:req.user,moment:moment});
  });
});
 
module.exports = router;


