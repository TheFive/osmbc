// Exported Functions and prototypes are defined at end of file

var pg       = require('pg');
var async    = require('async');
var config   = require('../config.js');
var util     = require('../util.js');
var markdown = require('markdown-it')()
          .use(require('markdown-it-sup'))
          .use(require('markdown-it-imsize'), { autofill: true });

var mdFigCaption = require('mdfigcaption');
markdown.use(mdFigCaption);

var should   = require('should');
var moment   = require('moment');

var articleModule = require('../model/article.js');
var settingsModule = require('../model/settings.js');
var logModule = require('../model/logModule.js');
var categoryTranslation = require('../data/categoryTranslation.js');

var pgMap = require('./pgMap.js')
var debug = require('debug')('OSMBC:model:blog');



module.exports.table = "blog";

module.exports.categories = [
  {DE:"-- noch keine Kategorie --", EN:"-- no category yet --"},
  {DE:"Bild",EN:"Picture"},
  {DE:"[Aktuelle Kategorie]",EN:"[Actual Category]"},
  {DE:"In eigener Sache",EN:"About us"},
  {DE:"Wochenaufruf",EN:"Weekly exerciseEN:"},
  {DE:"Mapping",EN:"Mapping"},
  {DE:"Community",EN:"Community"},
  {DE:"Importe",EN:"Imports"},
  {DE:"OpenStreetMap Foundation",EN:"OpenStreetMap Foundation"},
  {DE:"Veranstaltungen",EN:"Events"},
  {DE:"Humanitarian OSM",EN:"Humanitarian OSM"},
  {DE:"Karten",EN:"Maps"},
  {DE:"switch2OSM",EN:"switch2OSM"},
  {DE:"Open-Data",EN:"Open Data"},
  {DE:"Lizenzen",EN:"Licences"},
  {DE:"Programme",EN:"Software"},
  {DE:"Programmierung",EN:"Programming"},
  {DE:"Kennst Du schon …",EN:"Did you know …"},
  {DE:"Weitere Themen mit Geo-Bezug",EN:'Other “geo” things'},
  {DE:"Wochenvorschau" ,EN:"Upcoming Events"},
  {DE:"--unpublished--" ,EN:"--unpublished--"}];




function Blog(proto)
{
  debug("Blog");
  this.id = 0;
  this._meta={};
  this._meta.table = "blog";
  this.categories = module.exports.categories;
  if (proto) {
    for (var k in proto) {
      this[k] = proto[k];
    }
  }
}

function create (proto) {
  debug("create");
  return new Blog(proto);
}

 

function setAndSave(user,data,callback) {
  debug("setAndSave");
  debug('user %s',user);
  var self = this;
  delete self.lock;
  async.series([
    function checkID(cb) {
      if (self.id == 0) {
        self.save(cb);
      } else cb();
    }
  ],function(err){
    should.exist(self.id);
    should(self.id).not.equal(0);
    async.forEachOf(data,function(value,key,callback){
      if (typeof(value)=='undefined') return callback();
      if (value === self[key]) return callback();
      if (value == '' && typeof(self[key])=='undefined') return callback();
      if (typeof(value)=='object') {
        if (JSON.stringify(value)==JSON.stringify(self[key])) return callback();
      }
      debug("Set Key %s to value %s",key,value);
      debug("Old Value Was %s",self[key]);
      articleModule.removeOpenBlogCache();
      async.series ( [
          function(callback) {
             logModule.log({oid:self.id,blog:self.name,user:user,table:"blog",property:key,from:self[key],to:value},callback);
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
  })
} 
function setReviewComment(lang,user,data,callback) {
  debug("reviewComment");
  var self = this;
  var rc = "reviewComment"+lang;
  async.series([
    function checkID(cb) {
      if (self.id == 0) {
        self.save(cb);
      } else cb();
    }
  ],function(err){
    should.exist(self.id);
    should(self.id).not.equal(0);
    if (typeof(data)=='undefined') return callback();
    if (typeof(self[rc]) == "undefined" || self[rc] == null) {
      self[rc] = [];
    }
    for (var i=0;i<self[rc].length;i++) {
      if (self[rc][i].user == user && self[rc][i].text == data) return callback();
    }
    async.series ( [
        function(callback) {
           logModule.log({oid:self.id,blog:self.name,user:user,table:"blog",property:rc,from:"Add",to:data},callback);
        },
        function(callback) {
          var date = new Date();
          if (data != "startreview") {
            self[rc].push({user:user,text:data,timestamp:date});
          }
          callback();
        }
      ],function(err){
        if (err) return callback(err);
        self.save(callback);
      })
  })
} 

function closeBlog(lang,user,status,callback) {
  debug("closeBlog");
  var self=this;
  var closeField = "close"+lang;
  if (self[closeField] == status) return callback();
  async.series([
    function checkID(cb) {
      if (self.id == 0) {
        self.save(cb);
      } else cb();
    }
  ],function(err){
    should.exist(self.id);
    should(self.id).not.equal(0);
    async.series ( [
        function logEntry(callback) {
           logModule.log({oid:self.id,blog:self.name,user:user,table:"blog",property:closeField,from:self[closeField],to:status},callback);
        },
        function setCloseField(callback) {
          self[closeField] = status;
          callback();
        },
        function removeReview(callback) {
          if (status == false) {
            if (self["reviewComment"+lang] && self["reviewComment"+lang].length==0){
              delete self["reviewComment"+lang];
            }
          }
          callback();
        }
      ],function finalFunction(err){
        if (err) return callback(err);
        self.save(callback);
      })
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
    var endDate = new Date();
    if (result) {
      if (result.name.substring(0,2)=="WN") {
        name = result.name;
        if (result.endDate && typeof(result.endDate)!='undefined') {
          endDate = new Date(result.endDate);
        }
      }
    }
    debug("Maximaler Name %s",name);
    var wnId = name.substring(2,99);
    var newWnId = parseInt(wnId) +1;
    var newName = "WN"+newWnId;
    var startDate = new Date(endDate);
    
    startDate.setDate(startDate.getDate()+1);
    endDate.setDate(endDate.getDate()+7);
    var blog = create();
    blog.name = newName;
    blog.status = "open";
    blog.startDate = startDate;
    blog.endDate = endDate;
    //copy flat prototype to object.
    for (var k in proto) {
      blog[k]=proto[k];
    }
    blog.save(callback);
  });
}


function getPreview(style,user,callback) {
  debug('getPreview');
  var self = this;

  // first check the parameter
  should(typeof(style)).equal("string");
  if (typeof(user)=="function") {
    callback = user;
    user = "--";
  }
  should.exist(user);

  var options = settingsModule.getSettings(style);

  var articles = {};
  var preview = "";

  var bilingual = options.bilingual;
  var imageHTML;

  articleModule.find({blog:this.name},{column:"title"},function(err,result){
    

    // in case of a normal blog, generate the start and end time
    // for a help blog, use the Name of the Blog
    // not in edit mode.
    if (!options.markdown) {
      if (self.startDate && self.endDate) {
        preview += "<p>"+moment(self.startDate).locale(options.left_lang).format('l') +"-"+moment(self.endDate).locale(options.left_lang).format('l') +'</p>\n';
      }
      if (!options.edit) {
       // if (!imageHTML) preview += "<!--         place picture here              -->\n"   
       // else preview += '<div class="wp-caption aligncenter">'+imageHTML+'</div>';        
      }
    }
    else {
      preview = "";
      if (self.startDate && self.endDate) {
        preview += moment(self.startDate).locale(options.left_lang).format('l') +"-"+moment(self.endDate).locale(options.left_lang).format('l') +'\n\n';
      }
    }
      
    // Put every article in an array for the category
    if (result) {
      for (var i=0;i<result.length;i++ ) {
        var r = result[i];
        if (!options.edit && r["markdown"+options.left_lang]=="no translation") continue;
        if (typeof(articles[r.categoryEN]) == 'undefined') {
          articles[r.categoryEN] = [];
        }
        articles[r.categoryEN].push(r);
      }
    }
    var clist = self.getCategories();

    
    
    // Generate the blog result along the categories
    for (var i=0;i<clist.length;i++) {
      var category = clist[i].EN;

      var categoryRIGHT = "";
      var categoryLEFT = clist[i][options.left_lang];
      if (bilingual) {
        categoryRIGHT = clist[i][options.right_lang]
      }

     
      // ignore any "unpublished" category not in edit mode
      if (!(options.edit) && category =="--unpublished--") continue;

   
      // If the category exists, generate HTML for it
      if (typeof(articles[category])!='undefined') {
        debug('Generating HTML for category %s',category);
        var htmlForCategory = ''

        for (var j=0;j<articles[category].length;j++) {
          var r = articles[category][j];

          var articleMarkdown = r.getPreview(style,user);
          if (options.markdown) articleMarkdown = "* " + r["markdown"+options.left_lang]+"\n\n";

          htmlForCategory += articleMarkdown;
        }
        var header ='';
        if (category!="Picture") {
          header = '<h2 id="'+util.linkify(self.name+'_'+categoryLEFT)+'">'+categoryLEFT+'</h2>\n';
          if (bilingual) {
          header = '<div class="row"><div class = "col-md-6">' +
                   '<h2 id="'+util.linkify(self.name+'_'+categoryLEFT)+'">'+categoryLEFT+'</h2>\n' +
                   '</div><div class = "col-md-6">' +
                   '<h2 id="'+util.linkify(self.name+'_'+categoryRIGHT)+'">'+categoryRIGHT+'</h2>\n' +
                   '</div></div>';
          }
          //htmlForCategory = header + '<ul>\n'+htmlForCategory+'</ul>\n'
        } else {
          header = "<!--         place picture here              -->\n" 
          if (bilingual) {
            header = '<div class="row"><div class = "col-md-6">' +
                     '</div><div class = "col-md-6">' +
                     '</div></div>';
            htmlForCategory = header + '\n'+htmlForCategory+'\n'                 
          }
        }
        if (options.markdown) header = "## "+categoryLEFT;

        
        if (options.markdown) {
          htmlForCategory = header + "\n\n"+htmlForCategory;
        } else {
          htmlForCategory = header + '<ul>\n'+htmlForCategory+'</ul>\n'
        }

        preview += htmlForCategory;
        delete articles[category];
      }
    }
    for (k in articles) {
      preview += "<h2> Blog Missing Cat: "+k+"</h2>\n";
      preview += "<p> Please use [edit blog detail] to enter category</p>\n";
      preview += "<p> Or edit The Articles ";
      for (var i=0;i<articles[k].length;i++) {
        preview += ' <a href="'+config.getValue('htmlroot')+'/article/'+articles[k][i].id+'">'+articles[k][i].id+'</span></a> ';
      }
      preview += "</p>\n";
    }
    var result = {};
    result.preview = preview;
    result.articles = articles;
    callback(null, result);
  })
}




function translateCategories(cat) {
  debug('translateCategories');
  var languages = config.getLanguages();
  for (var i = 0 ;i< cat.length;i++) {
    for (var l =0 ;l <languages.length;l++) {
      var lang = languages[l];
      if (cat[i][lang]) continue;
      if (categoryTranslation[cat[i].EN]) {
         cat[i][lang] = categoryTranslation[cat[i].EN][lang];
       }  
 
     
      if (!cat[i][lang]) cat[i][lang] = cat[i].EN;
    }
  }  
}

translateCategories(exports.categories);

function getCategories() {
  debug('getCategories');

  var result = module.exports.categories;
  if (this.categories) {
    translateCategories(this.categories);
    result = this.categories;
  }

 

  return result;
}

function createTable(cb) {
  debug('createTable');
  createString = 'CREATE TABLE blog (  id bigserial NOT NULL,  data json,  \
                  CONSTRAINT blog_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);'
  createView = "CREATE INDEX blog_id_idx ON blog USING btree (id);";
  pgMap.createTable('blog',createString,createView,cb)
}

function dropTable(cb) {
  debug('dropTable');
  pgMap.dropTable('blog',cb);
}

function isEditable(lang) {
  debug("isEditabe");
  var result = true;
  if (this["reviewComment"+lang]) {
    result = false;
  }
  var closeLANG = this["close"+lang]
  if (typeof(closeLANG)!='undefined') {
    if (closeLANG) result = false;
    else result = true;

  }
  return result;
}

function getUserForColumn(column,cb) {
  debug('getUserForColumn');
  
}


// Prototype Functions

// result of preview is html code to display the blog.
Blog.prototype.getPreview = getPreview;

Blog.prototype.isEditable = isEditable;

// setAndSave(user,data,callback)
// user: actual username for logging purposes
// data: json with values that has to be changed
// Function will change the given values and create for every field,
// where the value differes from representation in memory a log entry.
// at the end, the blog value is written in total
// This is may be relevant for concurrent save 
// as there is no locking with version numbers yet.
Blog.prototype.setAndSave = setAndSave;

Blog.prototype.setReviewComment = setReviewComment;
Blog.prototype.closeBlog = closeBlog;
// save
// just store the object in the database
Blog.prototype.save = pgMap.save;

// delete the object from the database
Blog.prototype.remove = pgMap.remove;

// Get Categories of the blog
// This can be the global defined, or the one from the blog itself
// Additional there can be some Categories for Edit Reasons
Blog.prototype.getCategories = getCategories;

// Define it on BlogModule level to (for no Blog Specified)
module.exports.getCategories = getCategories;

// Creation Functions

// Create a blog in memory with a given prototype
// create(proto)
// proto: (optional) JSON Data, to copy for the new object
//         the copy is a flat copy
module.exports.create= create;

// Create a blog in the database, 
// createNewBlog(proto,callback)
// for parameter see create
// proto is not allowed to have an id, this is generated by the database
// and stored into the object
module.exports.createNewBlog = createNewBlog;


// Find Functions

// find(object,order,callback)
// object (optional) find Objects, that conform with all values in the object
// order (optional)  field to sort by
module.exports.find = find;

// find(id,callback)
// id find Objects with ID
module.exports.findById = findById;

// findOne(object,order,callback)
// same as find, but callback returns one object, if it exists
module.exports.findOne = findOne;

// Create Tables in Prostgres with all indices and views
module.exports.createTable = createTable;

// Delete table in Postgres
module.exports.dropTable = dropTable;
