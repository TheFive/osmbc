var pg = require('pg');
var async = require('async');
var config = require('../config.js');
var logModule = require('../model/logModule.js');

var pgMap = require('./pgMap.js')
var debug = require('debug')('OSMBC:article');


function Article (proto)
{
	debug("Article");
	this.id = 0;
  this._meta={};
  this._meta.table = "article";
	if (proto) {
		if (typeof(proto.id) != 'undefined') this.id = proto.id;
	}

}

function create (proto) {
	debug("create");
	return new Article(proto);
}

 
Article.prototype.save = pgMap.save;
Article.prototype.remove = pgMap.remove;

Article.prototype.setAndSave = function setAndSave(user,data,callback) {
  debug("setAndSave");
  var self = this;
  delete self.lock;
  for (var k in data) {
    debug("Set Property %s to Value %s",k,data[k]);
  }

  async.forEachOf(data,function(value,key,callback){
    if (typeof(value)=='undefined') return callback();
    if (value == self[key]) return callback();
    async.series ( [
        function(callback) {
           logModule.log({id:self.id,user:user,table:"article",property:key,from:self[key],to:value},callback);
        },
        function(callback) {
          self[key] = value;
          callback();
        }
      ],function(err){
        callback(err);
      })

  },function(err) {
    if (err) return callback(err);
    self.save(callback);
  })
} 

function find(callback) {
	debug("find");
  pgMap.find(this,callback);
}
function findById(id,callback) {
	debug("findById %s",id);
  pgMap.findById(id,this,callback);
}

function findOne(obj,callback) {
  debug("findOne");
  pgMap.findOne(obj,this,callback);
}


module.exports.create= create;
module.exports.find = find;
module.exports.findById = findById;
module.exports.findOne = findOne;
module.exports.table = "article";
