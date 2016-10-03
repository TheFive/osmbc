"use strict";
// Exported Functions and prototypes are defined at end of file


var pg       = require("pg");
var async    = require("async");
var should   = require("should");
var debug    = require("debug")("OSMBC:model:article");


var config    = require("../config.js");
var util      = require("../util.js");

var messageCenter  = require("../notification/messageCenter.js");
var blogModule     = require("../model/blog.js");
var configModule   = require('../model/config.js');
var pgMap          = require("../model/pgMap.js");
var twitter        = require('../model/twitter.js');



var listOfOrphanBlog = null;


function getListOfOrphanBlog(callback) {
  debug("getListOfOrphanBlog");
  if (listOfOrphanBlog) return callback(null,listOfOrphanBlog);

  pg.connect(config.pgstring, function(err, client, pgdone) {
    if (err) return callback(err);

    listOfOrphanBlog = [];
    var query = client.query('select name from "OpenBlogWithArticle" order by name');
    debug("reading list of open blog");
    query.on('row',function(row) {
      listOfOrphanBlog.push(row.name);
    });
    query.on('end',function () {    
      pgdone();
      callback(null,listOfOrphanBlog);
    });
  });  
}


function Article (proto)
{
	debug("Article");
  debug("Prototype %s",JSON.stringify(proto));
	this.id = 0;
	for (var k in proto) {
    this[k] = proto[k];
  }
}

Article.prototype.getTable= function getTable() {
  return "article";
};

function create (proto) {
	debug("create");
	return new Article(proto);
}


function createNewArticle (proto,callback) {
  debug("createNewArticle");
  if (typeof(proto)=='function') {
    callback = proto;
    proto = null;
  }
  if (proto) should.not.exist(proto.id);
  var article = create(proto);
  article.save(callback);
}

// return mention in comments of article
// user == User is mentioned
// language == lang1 or lang2 or all is mentioned
// other == there is a comment, but no mentioning
// null There is no comment.

Article.prototype.getCommentMention = function getCommentMention(user,lang1,lang2) {
  debug('Article.prototype.getCommentMention');

  if (this.commentStatus === "solved") return null;
  var comment = this.comment;
  if (this.commentList) {
    for (var i = 0; i < this.commentList.length; i++) {
      comment += " " + this.commentList[i].text;
    }
  }
  if (!comment) return null;
  if (comment.search(new RegExp("@"+user+"\\b","i"))>=0) return "user";

  if (lang1 && comment.search(new RegExp("@"+lang1+"\\b","i"))>=0) return "language";
  if (lang2 && comment.search(new RegExp("@"+lang2+"\\b","i"))>=0) return "language";
  if (comment.search(new RegExp("@all\\b","i"))>=0) return "language";
  if (this.comment || (this.commentList && this.commentList.length>0)) return "other";
  return null;
};

Article.prototype.isMentioned = function isMentioned(what,includeAll) {
  debug('Article.prototype.isMentioned');
  if (typeof(includeAll)==="undefined") includeAll = false;

  if (this.commentStatus === "solved") return null;
  var comment = this.comment;
  if (this.commentList) {
    for (var i = 0; i < this.commentList.length; i++) {
      comment += " " + this.commentList[i].text;
    }
  }
  if (!comment) return null;
  if (comment.search(new RegExp("@"+what+"\\b","i"))>=0) return true;
  if (includeAll && comment.search(new RegExp("@all\\b","i"))>=0) return true;
  return false;
};

Article.prototype.getCommentRead = function getCommentRead(user) {
  debug('Article.prototype.getCommentUnread');
  if (!this.commentList) return false;
  if (!this.commentRead) return false;
  if (typeof(this.commentRead[user]) == "undefined") return false;
  if (this.commentRead[user]<this.commentList.length-1) return false;
  return true;
};






Article.prototype.doLock = function doLock(user,callback) {
  debug('doLock');
  var self = this;
  if (self.lock) return callback();
  self.lock={};
  self.lock.user = user;
  self.lock.timestamp = new Date();
  async.parallel([
    function updateClosed(cb) {
      blogModule.findOne({title:self.blog},function(err,result) {
        if (err) return callback(err);
        var status = "not found";
        if (result) status = result.status;
        if (status == "closed") delete self.lock;
        cb();
      });
    },
    ],function(){
      // ignore Error and unlock if article is closed

      self.save(callback);
    }
  );
};

Article.prototype.doUnlock = function doUnlock(callback) {
  debug('doUnlock');
  var self = this;
  if (typeof(self.lock)=='undefined') return callback();
  delete self.lock;
  self.save(callback);
};

Article.prototype.setAndSave = function setAndSave(user,data,callback) {
  debug("setAndSave");
  should(typeof(user)).equal('object');
  should(typeof(data)).equal('object');
  should(typeof(callback)).equal('function');
  listOfOrphanBlog = null;

  var self = this;
  delete self.lock;


  debug("Version of Article %s",self.version);
  debug("Version of dataset %s",data.version);
  if (data.version) {
    if (self.version != parseInt(data.version)) {
      var error = new Error("Version Number Differs");
      return callback(error);
    }
  } else { // no version is given, check all fields for old field
    for (var k in data) {
      if (k==="old") continue;
      if (! data.old || typeof(data.old[k])=="undefined") return callback(new Error("No Version and no History Value given"));

      if (self[k] && self[k]!=data.old[k]) return callback(new Error("Field "+k+" already changed in DB"));
      if (typeof(self[k])=="undefined" && data.old[k]!=="") return callback(new Error("Field "+k+" already changed in DB"));
    }
    delete data.old;
  }

  // check to set the commentStatus to open
  if (data.comment && !self.commentStatus) {
    data.commentStatus = "open";
  }

  if (data.categoryEN==="--unpublished--" || data.blog==="Trash") {
    if (  (!data.unpublishReason || data.unpublishReason.trim() ==="") &&
          (!self.unpublishReason || self.unpublishReason.trim() ==="")) {
      return callback(new Error("Missing reason for unpublishing article."));
    }
  }


  async.series([
    function checkID(cb) {
      if (self.id === 0) {
        self.save(cb);
      } else cb();
    },
    function addCommentWhenGiven(cb) {
      debug("addCommentWhenGiven");
      let addComment = data.addComment;
      delete data.addComment;
      if (addComment && addComment.trim() !== "") {
        self.addComment(user,addComment,cb);
      } else cb();
    },
    function addCommentWhenUnpublished(cb) {
      debug("addCommentWhenUnpublished");
      if (data.categoryEN==="--unpublished--" || data.blog==="Trash") {
        let text = "#solved because set to --unpublished--.\n\nReason:"+data.unpublishReason;
        if (data.unpublishReference) text +="\n"+data.unpublishReference;
        self.addComment(user,text,cb);
      } else cb();
    },

    function expandTwitterUrl(cb){
      debug('expandTwitterUrl');
      if (!util.isURL(data.collection)) return cb();
      twitter.expandTwitterUrl(data.collection,function(err,result){
        if (err) return cb(err);
        data.collection = result;
        cb();
      });
    }
  ],function(err){
    if (err) return callback(err);
    should.exist(self.id);
    should(self.id).not.equal(0);
    var logblog = self.blog;
    if (data.blog) logblog = data.blog;
    delete data.version;


    for (var k in data) {
      if (data[k] === self[k]) delete data[k];
      if (data[k] === '' && typeof(self[k])=='undefined') delete data[k];
      if (data[k]) data[k] = data[k].trim();
    }
    async.series(
      [function logIt (cb) {
        var oa = create(self);
        // do not wait on email;
        messageCenter.global.updateArticle(user,oa,data,function(){});
        cb();
      },
      function putValues (cb) {
        for (k in data) {
          if (typeof(data[k])!=='undefined') self[k]=data[k];
        }
        cb();
      }], 
      function setAndSaveFinalCB(err) {
          if (err) return callback(err);
          self.save(function (err) {
          callback(err);
      });
    });
  });
} ;



function find(obj,order,callback) {
	debug("find");
  pgMap.find({table:"article",create:create},obj,order,callback);
}

function findById(id,callback) {
	debug("findById %s",id);
  pgMap.findById(id,{table:"article",create:create},callback);
}

function findOne(obj1,obj2,callback) {
  debug("findOne");
  pgMap.findOne({table:"article",create:create},obj1,obj2,callback);
}

function fullTextSearch(search,order,callback) {
  debug('fullTextSearch');
  pgMap.fullTextSearch({table:"article",create:create},search,order,callback);
}

function findEmptyUserCollectedArticles(lang,user,callback) {
  debug('findEmptyUserCollectedArticles');
  var query = "select distinct on (article.id) article.id as id, article.data as data from article, changes,blog \
           where (article.id)::text = changes.data->>'oid' and changes.data->>'table'='article' \
           and changes.data->>'blog' = blog.data->>'name' \
           and article.data->>'blog' != 'Trash' \
           and changes.data->>'property' = 'collection' \
           and article.data->>'categoryEN' != '--unpublished--' \
           and changes.data->>'user' = '"+user+"' \
           and blog.data->>'status' != 'closed' \
           and ((blog.data->'exported"+lang+"') is null or blog.data->>'exorted"+lang+"'!='true') \
           and ((article.data->'markdown"+lang+"') is null or article.data->>'markdown"+lang+"' = '')";

  pgMap.find({table:"article",create:create},query,callback);
}

function findUserEditFieldsArticles(blog,user,field,callback) {
  debug('findUserEditFieldsArticles');
  var query = "select distinct on (article.id) article.id as id, article.data as data from article, changes \
           where (article.id)::text = changes.data->>'oid' and changes.data->>'table'='article' \
           and changes.data->>'blog' = '"+blog+"' \
           and changes.data->>'user' = '"+user+"' \
           and changes.data->>'property' = '"+field+"'";

  pgMap.find({table:"article",create:create},query,callback);
}

Article.prototype.calculateLinks = function calculateLinks() {
  debug("calculateLinks");
  var links = [];
  var languageFlags = configModule.getConfig("languageflags");

  var listOfField = ["collection"];
  for (var i= 0;i<config.getLanguages().length;i++) {
    listOfField.push("markdown"+config.getLanguages()[i]);
  }
  for (i=0;i<listOfField.length;i++) {
    if (typeof(this[listOfField[i]])!='undefined') {
      var res = util.getAllURL(this[listOfField[i]]);
      //var res = this[listOfField[i]].match(/(http|ftp|https):\/\/([\w\-_]+(?:(?:\.[\w\-_]+)+))([\w\-\.,@?^=%&amp;:/~\+#]*[\w\-\@?^=%&amp;/~\+#])?/g);
      for (let respoint=0;respoint<res.length;respoint++) {
        var add = true;
        for (var k in languageFlags) {
          if (res[respoint] == languageFlags[k]) {
            add = false;
            break;
          }
        }
        if (links.indexOf(res[respoint])>=0) add = false;
        if (add && res[respoint]) links = links.concat(res[respoint]);
      }
    }    
  }
  return links;
};



Article.prototype.displayTitle = function displayTitle(maxlength) {
  if (typeof(maxlength) == 'undefined') maxlength = 30;
  var result = "";
  if (typeof(this.title)!=='undefined' && this.title !== "") {
    result = util.shorten(this.title,maxlength);
  } else 
  /* it is a very bad idea to shorten HTML this way.
  if (typeof(this.markdownDE)!='undefined' && this.markdownDE !="") {
    var md = this.markdownDE;
    if (md.substring(0,2)=='* ') {md = md.substring(2,99999)};
    result = util.shorten(md,maxlength)
  } else*/
  if (typeof(this.collection)!=='undefined' && this.collection !=="") {
    result = util.shorten(this.collection,maxlength);
  }
  if (result.trim()==="") result = "No Title";
  return result;
};

/*
function displayTitleEN(maxlength) {
  if (typeof(maxlength) == 'undefined') maxlength = 30;
  if (typeof(this.title)!='undefined' && this.title != "") {
    return util.shorten(this.title,maxlength)
  }
  if (typeof(this.markdownEN)!='undefined' && this.markdownEN !="") {
    var md = this.markdownEN;
    if (md.substring(0,2)=='* ') {md = md.substring(2,99999)};
    return util.shorten(md,maxlength)
  }
  if (typeof(this.collection)!='undefined' && this.collection !="") {
    return util.shorten(this.collection,maxlength)
  }
  return "Empty Article";
}*/


var pgObject = {};

pgObject.table = "article";
pgObject.createString = 'CREATE TABLE article (  id bigserial NOT NULL,  data json,  \
                  CONSTRAINT article_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);';
pgObject.indexDefinition = {
  "article_blog_idx":"CREATE INDEX article_blog_idx ON article USING btree (((data ->> 'blog'::text)))",
  "article_text_idx":"CREATE INDEX article_text_idx ON article USING gin  \
                      (to_tsvector('german'::regconfig,   \
                          ((((COALESCE((data ->> 'title'::text), ''::text) || ' '::text) ||  \
                            COALESCE((data ->> 'collection'::text), ''::text)) || ' '::text) || \
                            COALESCE((data ->> 'markdownDE'::text), ''::text))))",
  "article_texten_idx":"CREATE INDEX article_texten_idx ON article USING gin \
                (to_tsvector('english'::regconfig, \
                  ((COALESCE((data ->> 'collection'::text), ''::text) || ' '::text) || \
                  COALESCE((data ->> 'markdownEN'::text), ''::text))))"

};
pgObject.viewDefinition = {
  "OpenBlogWithArticle":"CREATE VIEW \"OpenBlogWithArticle\" AS \
             SELECT DISTINCT article.data ->> 'blog'::text AS name \
               FROM article \
                 LEFT JOIN blog ON (article.data ->> 'blog'::text) = (blog.data ->> 'name'::text) \
              WHERE blog.data IS NULL \
              ORDER BY article.data ->> 'blog'::text;"
};
module.exports.pg = pgObject;


// calculateUsedLinks(callback)
// Async function to search for each Link in the article in the database
// callback forwards every error, and as result offers an
// object map, with and array of Articles for each shortened link
Article.prototype.calculateUsedLinks = function calculateUsedLinks(callback) {
  debug('calculateUsedLinks');
  // Get all Links in this article
  var usedLinks = this.calculateLinks();
  var self = this;

  var articleReferences = {};
  articleReferences.count = 0;

  if ((this.categoryEN === 'Upcoming Events')||(this.categoryEN === 'Releases')) {
    return callback(null,articleReferences);
  }

  // For each link, search in DB on usage
  async.each(usedLinks,
    function forEachUsedLink(item,cb) {
      debug('forEachUsedLink');
      var reference = item;

      // shorten HTTP / HTTPS links by the leading HTTP(s)
      //if (reference.substring(0,5) == "https") reference = reference.substring(5,999);
      //if (reference.substring(0,4) == "http") reference = reference.substring(4,999);
       
      // search in the full Module for the link
      fullTextSearch(reference,{column:"blog",desc:true},function(err,result) {
        debug("fullTextSearch Result");
        if (err) return cb(err);
        if (result) {
          for (var i=result.length-1;i>=0;i--){
            let dropIt = false;
            if (result[i].id == self.id) dropIt = true;
            if (result[i].blog == "Trash") dropIt = true;
            if (result[i].categoryEN == "--unpublished--") dropIt = true;
            if (dropIt) {
              result.splice(i,1);
            }
          }
          articleReferences[reference] = result;
          articleReferences.count += result.length;
        }
        else articleReferences[reference] = [];
        cb();
      });
    },function finalFunction(err) {
        debug('finalFunction');
        callback(err,articleReferences);
      }
  );
};

Article.prototype.getCategory = function getCategory(lang) {
  debug("getCategory");
  var result = this.categoryEN;
  var categoryTranslation = configModule.getConfig("categorytranslation");
  if (categoryTranslation[result] && categoryTranslation[result][lang]) {
    result = categoryTranslation[result][lang];
  }
  return result;
};


Article.prototype.addComment = function addComment(user,text,callback) {
  debug('Article.prototype.addComment');
  should(typeof(user)).eql('object');
  should(typeof(text)).eql('string');
  should(typeof(callback)).eql('function');

  // check on empty comment
  if (text.trim() === "") return callback(new Error("Empty Comment Added"));
  var self = this;

  if (!self.commentList) self.commentList = [];
  self.commentStatus = "open";
  var commentObject = {user:user.OSMUser,timestamp:new Date(),text:text};
  self.commentList.push(commentObject);
  if (!self.commentRead) self.commentRead = {};
  self.commentRead[user.OSMUser] = self.commentList.length-1;
  async.series([
    function sendit(cb) {
      debug('sendit');
      messageCenter.global.addComment(user,self,text,cb);
    },function searchStatus(cb) {
      if (text.indexOf("#solved")>= 0) {
        self.commentStatus = "solved";
      }
      if (text.indexOf("#open") >= 0) {
        self.commentStatus = "open";
      }
      cb();
    }
    ],function finalFunction(err){
      debug('finalFunction');
      if (err) return callback(err);
      self.save(callback);
    }
  );
};


Article.prototype.editComment = function editComment(user,index,text,callback) {
  debug('Article.prototype.addComment');
  should(typeof(user)).eql('object');
  should(typeof(text)).eql('string');
  should(typeof(callback)).eql('function');
  if (text.trim() === "") return callback(new Error("Empty Comment Added"));
  var self = this;

  if (!self.commentList) self.commentList = [];
  should(index).within(0,self.commentList.length-1);
  if (user.OSMUser!==self.commentList[index].user) {
    return callback(new Error("Only Writer is allowed to change a commment"));
  }
  async.series([
    function sendit(cb) {
      debug('sendit');
      messageCenter.global.editComment(user,self,index,text,cb);
    },
    function setValues(cb){
      var commentObject = self.commentList[index];
      commentObject.editstamp = new Date();
      commentObject.text = text;
      cb();
    },function searchStatus(cb) {
      if (text.indexOf("#solved")>= 0) {
        self.commentStatus = "solved";
      }
      if (text.indexOf("#open") >= 0) {
        self.commentStatus = "open";
      }
      cb();
    }
    ],function finalFunction(err){
      debug('finalFunction');
      if (err) return callback(err);
      self.save(callback);
    }
  );
};

/*
Store the number of comments, a user has read.
-1 is indicating, nothing is read. (same as a non existing value).
The Value has to be between -1 and the length of the comment list -1.
*/
Article.prototype.markCommentRead = function markCommentRead(user,index,callback) {
  debug('Article.prototype.markCommentRead');
  should(typeof(user)).eql('object');
  should(typeof(callback)).eql('function');
  var self = this;

  // nothing to read, ignore request.
  if (!self.commentList) return callback();

  // Do not mark more comments then necessary as read
  if (index >= self.commentList.length) index = self.commentList.length-1;

  should(index).within(-1,self.commentList.length-1);

  if (!self.commentRead) self.commentRead = {};
  self.commentRead[user.OSMUser]= index;
  self.save(callback);
};

Article.prototype.addNotranslate = function addNotranslate(user,shownLang,callback) {
  debug('Article.prototype.addNotranslate');
  var self = this;
  var change = {version:self.version};
  for (var i=0;i<config.getLanguages().length;i++) {
    var lang = config.getLanguages()[i];
    if (shownLang[lang] &&(typeof(self["markdown"+lang])==="undefined")||(self["markdown"+lang]==="")) {
      change["markdown"+lang]="no translation";
    }
  }
  return self.setAndSave(user,change,callback);
};



function isMarkdown(text) {
  debug('isMarkdonw');
  if (typeof(text)!=="string") return false;
  if (text.trim() === "") return false;
  if (text === "no translation") return false;
  return true;
}
// Calculate a Title with a maximal length for Article
// The properties are tried in this order
// a) Title
// b) Markdown (final Text)
// c) Collection 
// the maximal length is optional (default is 30)
//Article.prototype.displayTitle = displayTitle;
//Article.prototype.displayTitleEN = displayTitleEN;

// Calculate all links in markdown (final Text) and collection
// there is no double check for the result
//Article.prototype.calculateLinks = calculateLinks;

// Set a Value (List of Values) and store it in the database
// Store the changes in the change (history table) too.
// There are 3 parameter
// user: the user stored in the change object
// data: the JSON with the changed values
// callback
// Logging is written based on an in memory compare
// the object is written in total
// There is no version checking on the database, so it is
// an very optimistic "locking"
//Article.prototype.setAndSave = setAndSave;

// save stores the current object to database
Article.prototype.save = pgMap.save;

// remove deletes the current object from the database
Article.prototype.remove = pgMap.remove;



// lock an Article for editing
// adds a timestamp for the lock
//Article.prototype.doLock = doLock;
//Article.prototype.doUnlock = doUnlock;


// Create an Article object in memory, do not save
// Can use a prototype, to initialise data
// Parameter: prototype (optional)
module.exports.create= create;

// Creates an Article object and stores it to database
// can use a prototype to initialise data
// Parameter: Prototype (optional)
//            callback
// Prototype is not allowed to have an id
module.exports.createNewArticle = createNewArticle;

// Find an Article in database
// Parameter: object JSON Object with key value pairs to seach for
//            order  string to order the result
module.exports.find = find;

module.exports.findEmptyUserCollectedArticles = findEmptyUserCollectedArticles;

module.exports.findUserEditFieldsArticles = findUserEditFieldsArticles;

// Find an Article in database by ID
module.exports.findById = findById;
module.exports.fullTextSearch = fullTextSearch;



// Find one Object (similar to find, but returns first result)
module.exports.findOne = findOne;

// Return an String Array, with all blog references in Article
// that does not have a "finished" Blog in database
module.exports.getListOfOrphanBlog = getListOfOrphanBlog;


// Internal function to reset OpenBlogCash
// has to be called, when a blog is changed
module.exports.removeOpenBlogCache = function() {
  debug('removeOpenBlogCache');
  listOfOrphanBlog = null;
};

module.exports.Class = Article;

module.exports.isMarkdown = isMarkdown;