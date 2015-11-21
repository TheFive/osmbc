// Exported Functions and prototypes are defined at end of file


var pg     = require('pg');
var async  = require('async');
var should = require('should');
var markdown = require('markdown-it')();
var debug  = require('debug')('OSMBC:model:article');


var config    = require('../config.js');
var util      = require('../util.js');

var logModule = require('../model/logModule.js');
var settingsModule = require('../model/settings.js');
var blogModule = require('../model/blog.js');
var pgMap     = require('../model/pgMap.js');

var categoryTranslation = require('../data/categoryTranslation.js')

var blogModule = require('../model/blog.js');


var listOfOrphanBlog = null;


function getListOfOrphanBlog(callback) {
  debug('getListOfOrphanBlog');
  if (listOfOrphanBlog) return callback(null,listOfOrphanBlog);

  pg.connect(config.pgstring, function(err, client, pgdone) {
    if (err) {
      console.log("Connection Error")
      console.dir(err);

      pgdone();
      return (callback(err));
    }
    var query = client.query('select name from "OpenBlogWithArticle" order by name');
    debug("reading list of open blog");
    listOfOrphanBlog = [];
    query.on('row',function(row) {
      listOfOrphanBlog.push(row.name);
    })
    query.on('end',function (pgresult) {    
      pgdone();
      callback(null,listOfOrphanBlog);
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
	for (var k in proto) {
    this[k] = proto[k];
  }
}

function create (proto) {
	debug("create");
	return new Article(proto);
}


function createNewArticle (proto,callback) {
  debug("createNewArticle");
  if (typeof(proto)=='function') {
    callback = proto;
    delete proto;
  }
  should.not.exist(proto.id);
  var article = create(proto);
  article.save(callback);
}




function getPreview(par1,par2,par3) {
  debug("getPreview");
  should.exist(par1);
  var options;
  var user;
  var lang;

  if (typeof(par2)=='object') {
    options = par2;
    user = par3;
    lang = par1
  } else
  {
    style = par1;
    user = par2;
    options = settingsModule.getSettings(style);

  }
  

  var markdownEDIT = "markdown"+options.left_lang;
  var markdownTRANS = "markdown"+options.right_lang;
  var markdownLANG = markdownEDIT;  

  // Calculate markup for comment
  var commentMarkup = "";
  var editLink = '';
  

  var liON = '<li>\n';
  var liOFF = '</li>';

  if (options.edit && options.comment && this.comment) {
    if (!(typeof(this.commentStatus)=="string" && this.commentStatus=="solved")) {
      var commentColour = "blue";
      if (this.comment.indexOf("@"+user)>=0) commentColour = "red";
      if (this.comment.indexOf("@all")>=0) commentColour = "red";
      liON = '<li style=" border-left-style: solid; border-color: '+commentColour+';">\n';
    }
  }

  // generate Glyphicon for Editing
  if (options.glyphicon && options.edit) {
    editLink = ' <a href="'+config.getValue('htmlroot')+'/article/'+this.id+'?style='+style+'"><span class="glyphicon glyphicon-edit"></span></a>'; 
  }
  // Generate Translation & Edit Links
  if (options.edit && options.editLink ) {
    var el = ''; //editLink overwrites Gylphicon

    if (typeof(this[markdownEDIT])=='undefined' || this[markdownEDIT] == '') {
      el = "Edit";
    }
    if ((markdownTRANS != "markdown--") &&(typeof(this[markdownTRANS])=='undefined' || this[markdownTRANS] == '')) {
      if (el != '') el +='&'
      el += "Translate";
    }
    if (el =='' && options.shortEditLink) el ='…';
    if (el != '') editLink = ' <a href="'+config.getValue('htmlroot')+'/article/'+this.id+'?style='+style+'">'+el+'</a>';    
  }

  // Generate Text for display
  var text ='';
  var textright = '';
  if (options.overview) { // just generate the overview text
    debug("options overview is set");
    text=this.displayTitle(90);
    textright = this.displayTitle(90);
  } else { // generate the full text
    if (typeof(this[markdownLANG])!='undefined' && this[markdownLANG]!='') {
      var md = this[markdownLANG];


      // Does the markdown text starts with '* ', so ignore it
      if (md.substring(0,2)=='* ') {md = md.substring(2,99999)};
      // Return an list Element for the blog article
      text = markdown.render(md);

    } else {
      text = this.displayTitle();
    }    
    if (typeof(this[markdownTRANS])!='undefined' && this[markdownTRANS]!='') {
      var md = this[markdownTRANS];

      // Does the markdown text starts with '* ', so ignore it
      if (md.substring(0,2)=='* ') {md = md.substring(2,99999)};
      // Return an list Element for the blog article
      textright = markdown.render(md);
 
      // clean up <p> and </p> of markdown generation.
    } else {
      textright = this.displayTitle();
    }
  }
  if (text) {
    
    // try to put Edit Link at before the last '</p>';
    if (text.substring(text.length-4,text.length)=='</p>') {
      text = text.substring(0,text.length-4)+editLink+'</p>\n';
    } else if (text.substring(text.length-5,text.length-1)=='</p>') {
      text = text.substring(0,text.length-5)+editLink+'</p>\n';
    }
    else text += editLink;

  }


  // calculate Markup Display for Missing Edits
  var markON = '';
  var markOFF = '';
  if (options.marktext && (typeof(this[markdownLANG])=='undefined' || this[markdownLANG]=='')) {
    markON = '<mark>';
    markOFF = '</mark>'
  }
  var markrightON = '';
  var markrightOFF = '';
  if (options.marktext && (typeof(this[markdownTRANS])=='undefined' || this[markdownTRANS]=='')) {
    markrightON = '<mark>';
    markrightOFF = '</mark>'
  }
  if (!options.bilingual) {
      return liON + 
              markON +
              text + '\n' +
              markOFF +
             // editLink+     
              liOFF;
  }
  else {
    return '<div class="row">'+
             '<div class="col-md-6">'+
              liON + 
              markON +
              text + '\n' +
              markOFF +
             // editLink+     
              liOFF +
             '</div>'+
             '<div class="col-md-6">'+
              liON + 
              markrightON +
              textright + '\n' +
              markrightOFF +
            //  editLink+     
              liOFF +
             '</div>'+
           '</div>'
  }


}


function doLock(user,callback) {
  debug('doLock');
  var self = this;
  if (self.lock) return callback();
  self.lock={};
  self.lock.user = user;
  self.lock.timestamp = new Date();
  self.isClosed = false;
  self.isClosedEN = false;
  async.parallel([
    function updateClosed(cb) {
      blogModule.findOne({title:self.blog},function(err,result) {
        if (err) return callback(err);
        var status = "not found";
        if (result) status = result.status;
        self.isClosed = (status == "published");
        cb()
      })
    },
    function updateClosedEN(cb) {
      blogModule.findOne({title:self.blogEN},function(err,result) {
        if (err) return callback(err);
        status = "not found";
        if (result) status = result.status;
        self.isClosedEN = (status == "published");
        cb()
      })
    },
    ],function(err){
      // ignore Error and unlock if article is closed
      if (self.isClosed && self.isClosedEN) {delete self.lock;}
      self.save(callback);
    }
  )
}
function doUnlock(callback) {
  debug('doUnlock');
  var self = this;
  if (typeof(self.lock)=='undefined') return callback();
  delete self.lock;
  self.save(callback);
}

function setAndSave(user,data,callback) {
  debug("setAndSave");
  should(typeof(user)).equal('string');
  should(typeof(data)).equal('object');
  should(typeof(callback)).equal('function');
  listOfOrphanBlog = null;
  // trim all markdown Values
  for (k in data) {
    if (k.substring(0,8)== "markdown") {
      data[k]=data[k].trim();
    }
  }
  var self = this;
  delete self.lock;


  debug("Version of Article %s",self.version);
  debug("Version of dataset %s",data.version);

  if (self.version && data.version && self.version != parseInt(data.version)) {
    error = new Error("Version Number Differs");
    return callback(error);
  }


  async.series([
    function checkID(cb) {
      if (self.id == 0) {
        self.save(cb);
      } else cb();
    },
    function setCategoryEn(cb) {
      // Set Category for the EN Field

      // First calcualte Blog
      blogModule.findOne({name:self.blog},function(err,blog){
        var categories= blogModule.getCategories();
        if (blog) categories = blog.getCategories();
        for (var i=0;i<categories.length;i++) {
          if (data.categoryDE == categories[i].DE) {
            data.categoryEN = categories[i].EN;
            break;
          }
        } 
        cb();           
      })
    }

  ],function(err){
    should(self.id).exist;
    should(self.id).not.equal(0);
    async.forEachOf(data,function setAndSaveEachOf(value,key,cb_eachOf){
      // There is no Value for the key, so do nothing
      if (typeof(value)=='undefined') return cb_eachOf();

      // The Value to be set, is the same then in the object itself
      // so do nothing
      if (value == self[key]) return cb_eachOf();
      if (typeof(self[key])=='undefined' && value == '') return cb_eachOf();
      
      debug("Set Key %s to value >>%s<<",key,value);
      debug("Old Value Was >>%s<<",self[key]);


      async.series ( [
          function(cb) {
             logModule.log({oid:self.id,user:user,table:"article",property:key,from:self[key],to:value},cb);
          },
          function(cb) {
            self[key] = value;
            cb();
          }
        ],function(err){
          cb_eachOf(err);
        })

    },function setAndSaveFinalCB(err) {
      if (err) return callback(err);
      self.save(function (err) {
        callback(err);
      });
    })
  });
} 



function find(obj,order,callback) {
	debug("find");
  pgMap.find(this,obj,order,callback);
}
function findById(id,callback) {
	debug("findById %s",id);
  pgMap.findById(id,this,callback);
}

function findOne(obj1,obj2,callback) {
  debug("findOne");
  pgMap.findOne(this,obj1,obj2,callback);
}

function fullTextSearch(search,order,callback) {
  debug('fullTextSearch');
  pgMap.fullTextSearch(module.exports,search,order,callback);
}


function calculateLinks() {
  debug("calculateLinks");
  var links = [];

  if (typeof(this.collection)!='undefined') {
    var res = this.collection.match(/(http|ftp|https):\/\/([\w\-_]+(?:(?:\.[\w\-_]+)+))([\w\-\.,@?^=%&amp;:/~\+#]*[\w\-\@?^=%&amp;/~\+#])?/g);
    if (res) links = links.concat(res);
  }
  if (typeof(this.markdownDE)!='undefined') {
    var res = this.markdownDE.match(/(http|ftp|https):\/\/([\w\-_]+(?:(?:\.[\w\-_]+)+))([\w\-\.,@?^=%&amp;:/~\+#]*[\w\-\@?^=%&amp;/~\+#])?/g);
    if (res) links = links.concat(res);
  }
  return links;
}



function displayTitle(maxlength) {
  if (typeof(maxlength) == 'undefined') maxlength = 30;
  var result = "";
  if (typeof(this.title)!='undefined' && this.title != "") {
    result = util.shorten(this.title,maxlength)
  } else 
  /* it is a very bad idea to shorten HTML this way.
  if (typeof(this.markdownDE)!='undefined' && this.markdownDE !="") {
    var md = this.markdownDE;
    if (md.substring(0,2)=='* ') {md = md.substring(2,99999)};
    result = util.shorten(md,maxlength)
  } else*/
  if (typeof(this.collection)!='undefined' && this.collection !="") {
    result = util.shorten(this.collection,maxlength)
  }
  if (result.trim()=="") result = "No Title";
  return result;
}

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
}


function createTable(cb) {
  debug('createTable');
  var createString = 'CREATE TABLE article (  id bigserial NOT NULL,  data json,  \
                  CONSTRAINT article_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);'
  var createView = "CREATE OR REPLACE VIEW \"OpenBlogWithArticle\" AS \
             SELECT DISTINCT article.data ->> 'blog'::text AS name \
               FROM article \
                 LEFT JOIN blog ON (article.data ->> 'blog'::text) = (blog.data ->> 'name'::text) \
              WHERE blog.data IS NULL \
              ORDER BY article.data ->> 'blog'::text; \
              create index on article((data->>'blog')); \
              CREATE INDEX article_id_idx ON article USING btree (id); \
              CREATE INDEX article_text_idx ON article USING gin  \
                      (to_tsvector('german'::regconfig,   \
                          (COALESCE(data ->> 'title'::text, ''::text) || ' '||  \
                            COALESCE(data ->> 'collection'::text, ''::text)) || ' ' || \
                            COALESCE(data ->> 'markdownDE'::text, ''::text))); \
              CREATE INDEX article_texten_idx ON article USING gin \
                (to_tsvector('english'::regconfig, \
                  COALESCE(data ->> 'collection'::text, ''::text) ||' ' || \
                  COALESCE(data ->> 'markdownEN'::text, ''::text)));";
  pgMap.createTable('article',createString,createView,cb)
}

function dropTable(cb) {
  debug('dropTable');
  pgMap.dropTable('article',cb);
}

function calculateUsedLinks(callback) {
  debug('calculateUsedLinks');
  var self = this;
  // Get all Links in this article
  var usedLinks = this.calculateLinks();

  var articleReferences = {};
  articleReferences.count = 0;

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
        if (result) {
          for (var i=result.length-1;i>=0;i--){
            if (result[i].id == this.id) {
              result.splice(i,1);
            }
          }
          articleReferences[reference] = result;
          articleReferences.count += result.length;
        }
        else articleReferences[reference] = [];
        cb();
      });
    },function(err) {
        callback(err,articleReferences);
      }
  );
}

function getCategory(lang) {
  debug("getCategory");
  var result = this.categoryEN;
  if (categoryTranslation[result] && categoryTranslation[result][lang]) {
    result = categoryTranslation[result][lang];
  }
  return result;
}


// Calculate a Title with a maximal length for Article
// The properties are tried in this order
// a) Title
// b) Markdown (final Text)
// c) Collection 
// the maximal length is optional (default is 30)
Article.prototype.displayTitle = displayTitle;
Article.prototype.displayTitleEN = displayTitleEN;

// Calculate all links in markdown (final Text) and collection
// there is no double check for the result
Article.prototype.calculateLinks = calculateLinks;

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
Article.prototype.setAndSave = setAndSave;

// save stores the current object to database
Article.prototype.save = pgMap.save;

// remove deletes the current object from the database
Article.prototype.remove = pgMap.remove;


// getPreview deliveres the HTML for an article.
// Parameter1: lang
//             language for the preview
// parameter2: Options
//      edit:      true if any additional edit links should be generated
//      comment:   true if blue or red border should be placed based on comment
//      glyphicon: true if the bullet should be an edit glyphicon
//      editLink:  true if an "Edit&Translate" should be placed at the end of an article
//      overview:  true if title or a small text is shown, instead of an article
//      marktext:  true if missing language markdown should be <mark>ed.
Article.prototype.getPreview = getPreview;
Article.prototype.getCategory = getCategory;


// calculateUsedLinks(callback)
// Async function to search for each Link in the article in the database
// callback forwards every error, and as result offers an
// object map, with and array of Articles for each shortened link
Article.prototype.calculateUsedLinks = calculateUsedLinks;

// lock an Article for editing
// adds a timestamp for the lock
// and updates isClosed and isClosedEN for already published blogs
Article.prototype.doLock = doLock;
Article.prototype.doUnlock = doUnlock;


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

// Find an Article in database by ID
module.exports.findById = findById;
module.exports.fullTextSearch = fullTextSearch;



// Find one Object (similar to find, but returns first result)
module.exports.findOne = findOne;
module.exports.table = "article";

// Return an String Array, with all blog references in Article
// that does not have a "finished" Blog in database
module.exports.getListOfOrphanBlog = getListOfOrphanBlog;

// Create Tables and Views
module.exports.createTable = createTable;

// Drop Table (and views)
module.exports.dropTable = dropTable;

// Internal function to reset OpenBlogCash
// has to be called, when a blog is changed
module.exports.removeOpenBlogCache = function() {
  debug('removeOpenBlogCache');
  listOfOrphanBlog = null;
}
