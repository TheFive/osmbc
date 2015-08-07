var pg = require('pg');
var async = require('async');
var config = require('../config.js');
var logModule = require('../model/logModule.js');

var pgMap = require('./pgMap.js');
var debug = require('debug')('OSMBC:article');


var listOfOpenBlog = null;

function getListOfOpenBlog(callback) {
  debug('getListOfOpenBlog');
  if (listOfOpenBlog) return callback(null,listOfOpenBlog);

  pg.connect(config.pgstring, function(err, client, pgdone) {
    if (err) {
      console.log("Connection Error")

      pgdone();
      return (callback(err));
    }
    var query = client.query('select name from "OpenBlogWithArticle"');
    debug("reading list of open blog");
    listOfOpenBlog = [];
    query.on('row',function(row) {
      debug(row.name);
      listOfOpenBlog.push(row.name);
    })
    query.on('end',function (pgresult) {    
      pgdone();
      callback(null,listOfOpenBlog);
    })
  })  
}


function Article (proto)
{
	debug("Article");
  debug("Prototype %s",JSON.stringify(proto));
	this.id = 0;
  this._meta={};
  this._meta.table = "article";
	for (k in proto) {
    this[k] = proto[k];
  }
}

function create (proto) {
	debug("create");
	return new Article(proto);
}


function createNewArticle (proto,callback) {
  debug("createNewArticle");
  var article = create(proto);
  article.save(callback);
}
 
Article.prototype.save = pgMap.save;
Article.prototype.remove = pgMap.remove;

Article.prototype.setAndSave = function setAndSave(user,data,callback) {
  debug("setAndSave");
  listOfOpenBlog = null;
  var self = this;
  delete self.lock;

  async.forEachOf(data,function(value,key,callback){
    if (typeof(value)=='undefined') return callback();
    if (value == self[key]) return callback();
    
    debug("Set Key %s to value >>%s<<",key,value);
    debug("Old Value Was >>%s<<",self[key]);
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

function find(obj,order,callback) {
	debug("find");
  pgMap.find(this,obj,order,callback);
}
function findById(id,callback) {
	debug("findById %s",id);
  pgMap.findById(id,this,callback);
}

function findOne(obj1,obj2callback) {
  debug("findOne");
  pgMap.findOne(this,obj1,obj2,callback);
}


function calculateLinks() {
  debug("calculateLinks");
  var links = [];

  if (typeof(this.collection)!='undefined') {
    var res = this.collection.match(/(http|ftp|https):\/\/([\w\-_]+(?:(?:\.[\w\-_]+)+))([\w\-\.,@?^=%&amp;:/~\+#]*[\w\-\@?^=%&amp;/~\+#])?/g);
    if (res) links = links.concat(res);
  }
  if (typeof(this.markdown)!='undefined') {
    var res = this.markdown.match(/(http|ftp|https):\/\/([\w\-_]+(?:(?:\.[\w\-_]+)+))([\w\-\.,@?^=%&amp;:/~\+#]*[\w\-\@?^=%&amp;/~\+#])?/g);
    if (res) links = links.concat(res);
  }
  return links;
}



Article.prototype.calculateLinks = calculateLinks;




module.exports.create= create;
module.exports.createNewArticle = createNewArticle;
module.exports.find = find;
module.exports.findById = findById;
module.exports.findOne = findOne;
module.exports.table = "article";
module.exports.getListOfOpenBlog = getListOfOpenBlog;
