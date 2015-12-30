var express = require('express');
var should = require('should');
var router = express.Router();
var debug = require('debug')('OSMBC:routes:changes');
var logModule = require('../model/logModule.js');
var jsdiff = require('diff');


function generateHTMLDiff(one,other) {
  debug("generateHTMLDiff");
  if (!one) one = "";
  if (! other) other = "";

  if (typeof(one)!= "string") return "";
  if (typeof(other)!= "string") return "";
  
  var diff = jsdiff.diffChars(one, other);

  var result = "";
  diff.forEach(function(part){
    // green for additions, red for deletions
    // grey for common parts
    var styleColor               = 'style="color:grey"';
    if (part.added) styleColor   = 'style="background-color:green;color:white"';
    if (part.removed) styleColor = 'style="background-color:red;color:white"';
  

    result += '<span '+styleColor+'>'+part.value+'</span>';
  });  
  return result;
}



/* GET users listing. */
function renderChangeId(req, res, next) {
  debug('renderChangeId');
  var id = req.params.change_id;
  logModule.findById(id,function(err,change) {
    if (!change || typeof(change.id) == 'undefined') return next();
    should.exist(res.rendervar);
    res.render('change',{change:change,
                         coloredChange:generateHTMLDiff(change.from,change.to),
                         layout:res.rendervar.layout});
  });
}
  

router.get('/:change_id',renderChangeId);

module.exports.renderChangeId = renderChangeId;
module.exports.router = router;


