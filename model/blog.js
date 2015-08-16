var pg       = require('pg');
var async    = require('async');
var config   = require('../config.js');
var markdown = require('markdown').markdown;
var should   = require('should');

var articleModule = require('../model/article.js');
var logModule = require('../model/logModule.js');

var pgMap = require('./pgMap.js')
var debug = require('debug')('OSMBC:model:blog');

module.exports.table = "blog";

module.exports.categories = [
  "[Aktuelle Kategorie]",
  "In eigener Sache",
  "Wochenaufruf",
  "Mapping",
  "Community",
  "Importe",
  "OpenStreetMap Foundation",
  "Veranstaltungen",
  "Humanitarian OSM",
  "Karten",
  "switch2OSM",
  "Open-Data",
  "Lizenzen",
  "Programme",
  "Programmierung",
  "Kennst Du schon...",
  "Weitere Themen mit Geo-Bezug",
  "Wochenvorschau" ];

function Blog(proto)
{
  debug("Blog");
  this.id = 0;
  this._meta={};
  this._meta.table = "blog";
  if (proto) {
    if (typeof(proto.id) != 'undefined') this.id = proto.id;
  }

}

function create (proto) {
  debug("create");
  return new Blog(proto);
}

 
Blog.prototype.save = pgMap.save;
Blog.prototype.remove = pgMap.remove;

Blog.prototype.setAndSave = function setAndSave(user,data,callback) {
  debug("setAndSave");
  var self = this;
  delete self.lock;

  async.forEachOf(data,function(value,key,callback){
    if (typeof(value)=='undefined') return callback();
    if (value == self[key]) return callback();
    debug("Set Key %s to value %s",key,value);
    debug("Old Value Was %s",self[key]);
    articleModule.removeOpenBlogCache();
    async.series ( [
        function(callback) {
           logModule.log({oid:self.id,user:user,table:"blog",property:key,from:self[key],to:value},callback);
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

function find(obj1,obj2,callback) {
  debug("find");
  pgMap.find(this,obj1,obj2,callback);
}
function findById(id,callback) {
  debug("findById %s",id);
  pgMap.findById(id,this,callback);
}

function findOne(obj1,obj2,callback) {
  debug("findOne");
  pgMap.findOne(this,obj1,obj2,callback);
}

function createNewBlog(proto,callback) {
  debug("createNewBlog");
  if (typeof(proto)=='function') {
    callback = proto;
    delete proto;
  }
  should.not.exist(proto.id);

  this.findOne(null,{column:"name",desc:true},function(err,result) {
    var name = "WN250";
    if (result) {
      if (result.name.substring(0,2)=="WN") {
        name = result.name;
      }
    }
    debug("Maximaler Name %s",name);
    var wnId = name.substring(2,99);
    var newWnId = parseInt(wnId) +1;
    var newName = "WN"+newWnId;
    var blog = create();
    blog.name = newName;
    blog.status = "open";
    //copy flat prototype to object.
    for (var k in proto) {
      blog[k]=proto[k];
    }
    blog.save(callback);
  });
}

function preview(edit,callback) {
  debug('preview');
  var articles = {};
  var fullMarkdown ="";
  var preview = "";

  articleModule.find({blog:this.name},function(err,result){
    for (var i=0;i<result.length;i++ ) {
      var r = result[i];
      if (typeof(r.markdown)!='undefined') {
        var text = r.markdown;
        r.textHtml = markdown.toHTML(text)
      } 
      if (typeof(articles[r.category]) == 'undefined') {
        articles[r.category] = [];
      }
      articles[r.category].push(r);
    }
    for (var i=0;i<exports.categories.length;i++) {
      var category = exports.categories[i];
      if (typeof(articles[category])!='undefined') {
        fullMarkdown += "## "+category+"\n";
        for (var j=0;j<articles[category].length;j++) {
          var r = articles[category][j];
          var editMark = "";
          if (edit) editMark = " [edit](/article/"+r.id+")";
          debug("Title %s",r.title);
          if (typeof(r.markdown)!='undefined' && r.markdown != "") {
            debug("Markdown exist");
            fullMarkdown += r.markdown+editMark+"\n";
          } else if (typeof(r.collection)!='undefined') {
            debug("Try Collection");
            var s = r.collection;
            debug(s);
            s.replace("\n","    ");
            debug(s);
            fullMarkdown += "    "+s+"\n"+editMark;
          }
          else {
            debug("Use Title");
            fullMarkdown += "    "+r.title+"\n"+editMark;
          }
        }
      }
    }
    preview = markdown.toHTML(fullMarkdown);
    var result = {};
    result.preview = preview;
    result.markdown = markdown;
    result.articles = articles;
    callback(null, result);
  })
}


function createTable(cb) {
  debug('createTable');
  createString = 'CREATE TABLE blog (  id bigserial NOT NULL,  data json,  \
                  CONSTRAINT blog_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);'
  createView = '';
  pgMap.createTable('blog',createString,createView,cb)
}

function dropTable(cb) {
  debug('dropTable');
  pgMap.dropTable('blog',cb);
}

Blog.prototype.preview = preview;

module.exports.create= create;
module.exports.find = find;
module.exports.findById = findById;
module.exports.findOne = findOne;
module.exports.createNewBlog = createNewBlog;
module.exports.createTable = createTable;
module.exports.dropTable = dropTable;
