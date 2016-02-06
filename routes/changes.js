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
    if (part.added) styleColor   = 'class="osmbc-inserted-inverted"';
    if (part.removed) styleColor = 'class="osmbc-deleted-inverted"';
  

    result += '<span '+styleColor+'>'+part.value+'</span>';
  });  
  return result;
}


function renderOutgoingMailLog(req,res,next) {
  debug('renderOutgoingMailLog');
  var d = req.params.date;
  logModule.find("select id, data from changes where data->>'table' = 'mail' and substring(data->>'timestamp' from 1 for "+ d.length+") ='"+d+"'",function (err,result){
    debug("logModule.find");
    if (err) return next(err);
    res.render("maillog",{maillog:result,layout:res.rendervar.layout});
  });
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

router.get('/mail/:date',renderOutgoingMailLog);

module.exports.renderChangeId = renderChangeId;
module.exports.router = router;


