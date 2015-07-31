var pg = require('pg');
var config = require('../config.js');
var pgMap = require('./pgMap.js')
var debug = require('debug')('user');


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
