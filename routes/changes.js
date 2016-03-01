"use strict";

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
  logModule.find("select id, data from changes where data->>'table' = 'mail' and substring(data->>'timestamp' from 1 for "+ d.length+") ='"+d+"' order by data->>'timestamp' desc",function (err,result){
    debug("logModule.find");
    if (err) return next(err);
    res.render("maillog",{maillog:result,layout:res.rendervar.layout});
  });
}


function renderHistoryLog(req,res,next) {
  debug('renderHistoryLog');
  var date = req.query.date;
  var user = req.query.user;
  var table = req.query.table;
  var blog = req.query.blog;
  var property = req.query.property;

  var params={date:date,user:user,table:table,blog:blog,property:property};


  var sql = "";

  var sqlParams = [];
  // User
  if (!date) date = "";

  sql += " (substring(data->>'timestamp' from 1 for $1) =$2) ";
  sqlParams.push(date.length);
  sqlParams.push(date);

  if (!user) user = '%';
  sql += " and (data->>'user' like $3) ";
  sqlParams.push(user);

  if (!table) table = '%';
  sql += " and (data->>'table' like $4) ";
  sqlParams.push(table);

  if (!blog) blog = '%';
  sql += " and (data->>'blog' like $5) ";
  sqlParams.push(blog);

  if (!property) property = '%';
  sql += " and (data->>'property' like $6) ";
  sqlParams.push(property);

  sql = " where "+sql + " and data->>'table' != 'mail' ";

  sql = "select id,data from changes "+sql+" order by data->>'timestamp' desc limit 500;";

  logModule.find({sql:sql,params:sqlParams},function (err,result){
    debug("logModule.find");
    if (err) return next(err);
    res.render("history",{history:result,layout:res.rendervar.layout,params:params});
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

router.get('/log',renderHistoryLog);

module.exports.renderChangeId = renderChangeId;
module.exports.router = router;


