var pg = require('pg');
var config = require('../config.js');
var pgMap = require('./pgMap.js')
var debug = require('debug')('OSMBC:user');


function User (proto)
{
	debug("User");
	this.id = 0;
  this._meta={};
  this._meta.table = "usert";
	if (proto) {
		if (typeof(proto.id) != 'undefined') this.id = proto.id;
		this.username = proto.username;
		this.password = proto.password;
	}

}

function create (proto) {
	debug("create");
	return new User(proto);
}

 
User.prototype.save = function(callback) {
  var user = this;

  console.log("usert");
  console.dir(user);


}

User.prototype.remove = pgMap.remove;

function find(callback) {
	debug("find");
  pgMap.find(this,callback);
}
function findById(id,callback) {
	debug("findById %s",id);
  pgMap.findById(id,this,callback);
}

function findOne(obj1,obj2,callback) {
  debug("findOne");
  pgMap.findOne(this,obj1,obj2,callback);
}



module.exports.create= create;
module.exports.find = find;
module.exports.findById = findById;
module.exports.findOne = findOne;
module.exports.table = "usert";
