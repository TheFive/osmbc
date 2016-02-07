"use strict";
// Exported Functions and prototypes are defined at end of file

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

var articleModule       = require('../model/article.js');
var settingsModule      = require('../model/settings.js');
var logModule           = require('../model/logModule.js');
var messageCenter       = require('../notification/messageCenter.js');
var userModule          = require('../model/user.js');
var categoryTranslation = require('../data/categoryTranslation.js');
var editorStrings       = require('../data/editorStrings.js');
var schedule            = require('node-schedule');

var pgMap = require('./pgMap.js');
var debug = require('debug')('OSMBC:model:blog');




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
  {DE:"Releases",EN:"Releases"},
  {DE:"Kennst Du schon …",EN:"Did you know …"},
  {DE:"Weitere Themen mit Geo-Bezug",EN:'Other “geo” things'},
  {DE:"Wochenvorschau" ,EN:"Upcoming Events"},
  {DE:"--unpublished--" ,EN:"--unpublished--"}];




function Blog(proto)
{
  debug("Blog");
  this.id = 0;
  this.categories = module.exports.categories;
  if (proto) {
    for (var k in proto) {
      this[k] = proto[k];
    }
  }
}

Blog.prototype.getTable = function getTable() {
  return "blog";
};

function create (proto) {
  debug("create");
  return new Blog(proto);
}

 
// setAndSave(user,data,callback)
// user: actual username for logging purposes
// data: json with values that has to be changed
// Function will change the given values and create for every field,
// where the value differes from representation in memory a log entry.
// at the end, the blog value is written in total
// This is may be relevant for concurrent save 
// as there is no locking with version numbers yet.
Blog.prototype.setAndSave = function setAndSave(user,data,callback) {
  debug("setAndSave");
  debug('user %s',user);
  should(typeof("user")).eql("string");
  var self = this;
  delete self.lock;
  articleModule.removeOpenBlogCache(); 
  async.series([
    function checkID(cb) {
      if (self.id === 0) {
        self.save(cb);
      } else cb();
    },
    function logit(cb) {
      messageCenter.global.updateBlog(user,self,data,cb);
    },
 
    function(cb){
      should.exist(self.id);
      should(self.id).not.equal(0);
      for (var key in data) {
        var value = data[key];
        if (typeof(value)=='undefined')  continue;
        if (value === self[key]) continue;
        if (value === '' && typeof(self[key])==='undefined') continue;
        if (typeof(value)=='object') {
          if (JSON.stringify(value)==JSON.stringify(self[key])) continue;
        }
        self[key] = value;
      }
      cb();
    }],function(err) {
      if (err) return callback(err);
      self.startCloseTimer();
      self.save(callback);
    }
  );
};
   


Blog.prototype.setReviewComment = function setReviewComment(lang,user,data,callback) {
  debug("reviewComment");
  var self = this;
  var rc = "reviewComment"+lang;
  var exported = "exported"+lang;
  should(typeof(user)).eql("object");
  async.series([
    function checkID(cb) {
      if (self.id === 0) {
        self.save(cb);
      } else cb();
    }
  ],function(){
    should.exist(self.id);
    should(self.id).not.equal(0);
    if (typeof(data)=='undefined') return callback();
    if (typeof(self[rc]) === "undefined" || self[rc] === null) {
      self[rc] = [];
    }
    for (var i=0;i<self[rc].length;i++) {
      if (self[rc][i].user == user && self[rc][i].text == data) return callback();
    }
    async.series ( [
        function logInformation(cb) {
           debug("setReviewComment->logInformation");
           messageCenter.global.sendLanguageStatus(user,self,lang,data,cb);
          // This is the old log and has to be moved to the messageCenter (logReceiver)
          // messageCenter.global.sendInfo({oid:self.id,blog:self.name,user:user,table:"blog",property:rc,from:"Add",to:data},callback);
        },
        function checkSpecialCommands(cb) {
          debug("setReviewComment->checkSpecialCommands");
          var date = new Date();
          if (data == "startreview") {
            // Start Review, check wether review is done in WP or not
            if (config.getValue("ReviewInWP").indexOf(lang)>=0) {
              self[exported]=true;

              // Review is set on WP, so the blog can be marked as exoprted
              messageCenter.global.sendLanguageStatus(user,self,lang,"markexported",cb);
              // This is the old log, that has to be moved to the messageCenter
              //messageCenter.global.sendInfo({oid:self.id,blog:self.name,user:user,table:"blog",property:rc,from:"Add",to:"markexported"},cb);
              return;
            }
            // nothing has to be written to the review comments
            return cb();
          }
          if (data == "markexported") {
            self[exported]=true;
            // nothing has to be written to review Comment
            return cb();
          }
          self[rc].push({user:user.OSMUser,text:data,timestamp:date});
          return cb();
        }
      ],function(err){
        debug("setReviewComment->FinalFunction");
        if (err) return callback(err);
        self.save(callback);
      });
  });
};

Blog.prototype.closeBlog = function closeBlog(lang,user,status,callback) {
  debug("closeBlog");
  var self=this;
  var closeField = "close"+lang;
  if (self[closeField] == status) return callback();
  async.series([
    function checkID(cb) {
      if (self.id === 0) {
        self.save(cb);
      } else cb();
    }
  ],function(){
    should.exist(self.id);
    should(self.id).not.equal(0);
    async.series ( [
        function logEntry(callback) {
           messageCenter.global.sendInfo({oid:self.id,blog:self.name,user:user,table:"blog",property:closeField,from:self[closeField],to:status},callback);
        },
        function setCloseField(callback) {
          self[closeField] = status;
          callback();
        },
        function removeReview(callback) {
          if (status === false) {
            if (self["reviewComment"+lang] && self["reviewComment"+lang].length===0){
              delete self["reviewComment"+lang];
            }
            self["exported"+lang] = false;
          }
          callback();
        }
      ],function finalFunction(err){
        if (err) return callback(err);
        self.save(callback);
      });
  });  
};

// find(object,order,callback)
// object (optional) find Objects, that conform with all values in the object
// order (optional)  field to sort by
module.exports.find = function find(obj1,obj2,callback) {
  debug("find");
  pgMap.find({table:"blog",create:create},obj1,obj2,callback);
};

// find(id,callback)
// id find Objects with ID
module.exports.findById = function findById(id,callback) {
  debug("findById %s",id);
  pgMap.findById(id,{table:"blog",create:create},callback);
};

// findOne(object,order,callback)
module.exports.findOne = function findOne(obj1,obj2,callback) {
  debug("findOne");
  pgMap.findOne({table:"blog",create:create},obj1,obj2,callback);
};

// Create a blog in the database, 
// createNewBlog(proto,callback)
// for parameter see create
// proto is not allowed to have an id, this is generated by the database
// and stored into the object
function createNewBlog(user, proto,callback,noArticle) {
  debug("createNewBlog");
  should(typeof(user)).eql("object");
  if (typeof(proto)=='function') {
    callback = proto;
    proto = null;
  }
  if (proto) should.not.exist(proto.id);

  exports.findOne(" where data->>'name' like 'WN%'",{column:"name",desc:true},function(err,result) {
    var blog = create();
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
    blog.name = newName;
    blog.status = "open";
    blog.startDate = startDate.toISOString();
    blog.endDate = endDate.toISOString();    
    for (var k in proto) {
      blog[k] = proto[k];
    } 
    var change={};
    change.name      = blog.name;
    change.status    = blog.status;
    change.startDate = blog.startDate;
    change.endDate   = blog.endDate;
    // create an Empty blog and simualte an id != 0
    var emptyBlog = exports.create();
    emptyBlog.id = -1;

    async.parallel([
      function createCalendar(cb) {
        if (noArticle) return cb();
        articleModule.createNewArticle({blog:blog.name,categoryEN:"Upcoming Events"},cb);
      },
      function createCalendar(cb) {
        if (noArticle) return cb();
        articleModule.createNewArticle({blog:blog.name,categoryEN:"Picture"},cb);
      }
      ],
      function finalFunction(err) {
        if (err) return callback(err);
        blog.save(function feedback(err,savedblog){
          if (err) return callback(err);
          messageCenter.global.updateBlog(user,emptyBlog,change,function(err){
            if (err) return callback(err);
            return callback(null,savedblog);
          });
        });
      }
    );
  });
}

Blog.prototype.autoClose = function autoClose(cb) {
  debug("autoClose");
  if (!this.endDate) return cb();

  var time = new Date().getTime();
  var endDateBlog = (new Date(this.endDate)).getTime();
  if (endDateBlog <= time) {
    var changes = {status:"edit"};
    this.setAndSave({OSMUser:"autoclose"},changes,function(err){
      cb(err);
    });
  } else cb();
};

var _autoCloseRunning = false;



function autoCloseBlog(callback) {
  debug("autoCloseBlog");
  // Do not run this function twice !
  if (_autoCloseRunning) return callback();
  _autoCloseRunning = true;


 

  exports.find({status:"open"},{column:"endDate",desc:false},function(err,result) {
    if (err) {
        _autoCloseRunning = false;
      return callback(err);
    }
    if (!result) {
       _autoCloseRunning = false;
       return callback();
    }
    async.series([
      function closeAllBlogs(cb) {
        async.each(result,function(data,cb){
          data.autoClose(cb);
        },function finish() {cb();});        
      },
      function createNewBlog(cb) {
        exports.findOne({status:"open"},function(err,result){
          if (err) return cb(err);
          if (!result) {
            exports.createNewBlog({OSMUser:"autocreate"},cb);
            return;
          } 
          cb();
        });
      } 
    ],function(err){
        _autoCloseRunning = false;
        callback(err);
      });
  });
}

function convertLogsToTeamString(logs,lang,users) {
  debug('convertLogsToTeamString');
  var editors = [];
  function addEditors(property,min) {
    for (var user in logs[property]) {
      if (logs[property][user]>=min) {
        if (editors.indexOf(user)<0) {
          editors.push(user);
        }
      }
    }
  }
  addEditors("collection",3);
  addEditors("markdown"+lang,2);
  addEditors("reviewComment"+lang,1);
  editors.sort();
  if (users && lang=="DE") {
    for (var i =0;i<editors.length;i++){
      for (var j =0;j<users.length;j++ ){
        if (editors[i]===users[j].OSMUser) {
          if (users[j].WNAuthor) {
            editors[i]='<a href="http://blog.openstreetmap.de/blog/author/'+users[j].WNAuthor+'">'+users[j].WNPublicAuthor+'</a>';
          }
        }
      }
    }
  }
  var editorsString = "";
  if (editors.length>=1) editorsString = editors[0];
  for (var i2 = 1;i2<editors.length;i2++){
    editorsString += ", "+editors[i2];
  }

 
  return editorStrings[lang].replace("##team##",editorsString);

}

Blog.prototype.createTeamString = function createTeamString(lang,callback) {
  debug('createTeamString');
  should(typeof(lang)).eql("string");
  should(typeof(callback)).eql("function");
  var self = this;
  var logs;
  var users = null;
  async.series([
    function readLogs(cb){
      logModule.countLogsForBlog(self.name,function (err,result){
        if (err) return cb(err);
        logs = result;
        return (cb(null));
      });
    },function readusers(cb) {
      userModule.find({},function(err,result){
        if (err) return cb(err);
        users = result;
        cb();
      });
    }],function finalFunction(err) {
      if (err) return callback(err);
      var result = convertLogsToTeamString(logs,lang,users);
      return callback(null,result);
  });
};

// result of preview is html code to display the blog.
Blog.prototype.getPreview = function getPreview(style,user,callback) {
  debug('getPreview');
  var self = this;
  

  var options = style;
  // first check the parameter
  if (typeof(style) ==="string") {
    options = settingsModule.getSettings(style);
  }
  if (typeof(user)=="function") {
    callback = user;
    user = "--";
  }
  should.exist(user);


  var articles = {};
  var preview = "";
  var teamString  = "";

  var bilingual = options.bilingual;
  var futureArticles;

  var articleList = null;

  async.series([
    function readFuture(cb) {
      debug('readFuture');
      articleModule.find({blog:"Future"},{column:"title"},function(err,result){
        if (err) return cb(err);
        if (result) futureArticles = result;
        return cb();
      });
    },
    function readArticlesWithCollector(cb) {
      debug('readArticlesWithCollector');
      articleModule.find({blog:self.name},{column:"title"},function(err,result){
        async.each(result,function(item,each_cb){
          logModule.find({table:"article",oid:item.id},{column:"timestamp",desc:true},function(err,result){
            if (err) return each_cb(err);
            if (result && result.length>0) {
              var list = {};
              for (var i =0;i<result.length;i++) {
                var r= result[i];
                if (!list[r.property]) list[r.property]={};
                list[r.property][r.user]="-";
              }
              item.author = {};
             
              for (var p in list) {
                item.author[p] = "";
                var sep = "";
                for (var k in list[p]) {
                  item.author[p] += sep + k;
                  sep = ",";
                }
              }
            }
            return each_cb(); 
          });
        },function finalFunction(err){
          if (err) return cb(err);
          articleList = result;
          return cb();
        });
      });
    },
    function readArticles(cb) {

       var i,j; // often used iterator, declared here because there is no block scope in JS.
         // (check let...)

      debug('readArticles');
      //articleModule.find({blog:self.name},{column:"title"},function(err,result)
      var result = articleList;
      {
        

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
          for (i=0;i<result.length;i++ ) {
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
        for (i=0;i<clist.length;i++) {
          var category = clist[i].EN;

          var categoryRIGHT = "";
          var categoryLEFT = clist[i][options.left_lang];
          if (bilingual) {
            categoryRIGHT = clist[i][options.right_lang];
          }

         
          // ignore any "unpublished" category not in edit mode
          if (!(options.edit) && category =="--unpublished--") continue;

       
          // If the category exists, generate HTML for it
          if (typeof(articles[category])!='undefined') {
            debug('Generating HTML for category %s',category);
            var htmlForCategory = '';

            for ( j=0;j<articles[category].length;j++) {
              var row = articles[category][j];

              var articleMarkdown = row.getPreview(style,user);
              if (options.markdown) articleMarkdown = "* " + row["markdown"+options.left_lang]+"\n\n";

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
              header = "<!--         place picture here              -->\n" ;
              if (bilingual) {
                header = '<div class="row"><div class = "col-md-6">' +
                         '</div><div class = "col-md-6">' +
                         '</div></div>';
                htmlForCategory = header + '\n'+htmlForCategory+'\n';                 
              }
            }
            if (options.markdown) header = "## "+categoryLEFT;

            
            if (options.markdown) {
              htmlForCategory = header + "\n\n"+htmlForCategory;
            } else {
              htmlForCategory = header + '<ul>\n'+htmlForCategory+'</ul>\n';
            }

            preview += htmlForCategory;
            delete articles[category];
          }
        }
        delete articles["--unpublished--"];
        for (var k in articles) {
          preview += "<h2> Blog Missing Cat: "+k+"</h2>\n";
          preview += "<p> Please use [edit blog detail] to enter category</p>\n";
          preview += "<p> Or edit The Articles ";
          for (i=0;i<articles[k].length;i++) {
            preview += ' <a href="'+config.getValue('htmlroot')+'/article/'+articles[k][i].id+'">'+articles[k][i].id+'</a> ';
          }
          preview += "</p>\n";
        }
        if (futureArticles && !options.fullfinal && futureArticles.length>0) {
          preview += "<h3>Articles waiting in Future Blog</h3>\n<ul>";
          for (i = 0;i<futureArticles.length;i++) {
            preview += '<li><a href="'+config.getValue('htmlroot')+'/article/'+futureArticles[i].id+'">'+futureArticles[i].title+'</a></li>';
          }
          preview += "</ul>";
        }
        cb(null);
      }//);
    },
    function createTeam(cb) {
      debug('createTeam');
      if (options.fullfinal) {
        self.createTeamString(options.left_lang,function (err,result){
          if (err) return cb(err);
          teamString = result;
          return cb(null);
        });      
      }
      else return cb(null);
    }

    ],function finalFunction(err){
      debug("finalFunction");
    
      if (err) return callback(err);
      var result = {};
      result.preview = preview+teamString;
      result.articles = articles;
      callback(null, result);      
    });
};

Blog.prototype.countUneditedMarkdown = function countUneditedMarkdown(callback) {
  debug('countUneditedMarkdown');
  // allready done, nothing to do.
  if (this._countUneditedMarkdown) return callback();
  var self = this;

  self._countUneditedMarkdown = {};
  self._countExpectedMarkdown = {};
  self._countNoTranslateMarkdown = {};

  articleModule.find({blog:this.name},function (err,result) {
    if (err) {
      console.log("Error during count Module");
      console.dir(err);
    }
    for (var i=0;i<config.getLanguages().length;i++) {
      var l = config.getLanguages()[i];
      if (!result) {
        self._countUneditedMarkdown[l]=99;
        self._countExpectedMarkdown[l]=99;
        self._countNoTranslateMarkdown[l] = 99;
      }
      else {
        self._countUneditedMarkdown[l]=0;
        self._countExpectedMarkdown[l]=0;
        self._countNoTranslateMarkdown[l] = 0;
        for (var j=0;j<result.length;j++) {
          var c = result[j].categoryEN;
          if ( c == "--unpublished--") continue;
          self._countExpectedMarkdown[l] +=1;
          var m = result[j]["markdown"+l];
          if (m==="no translation") {
            self._countNoTranslateMarkdown[l] +=1;
            continue;
          }
          if (!m || m ==="" || c ==="-- no category yet --") self._countUneditedMarkdown[l] +=1;
        }
      }
    }
    return callback();
  });
};


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

function getGlobalCategories() {
  return module.exports.categories;
}

Blog.prototype.getCategories = function getCategories() {
  debug('getCategories');

  var result =getGlobalCategories();
  if (this.categories) {
    translateCategories(this.categories);
    result = this.categories;
  }

  return result;
};



function createTable(cb) {
  debug('createTable');
  var createString = 'CREATE TABLE blog (  id bigserial NOT NULL,  data json,  \
                  CONSTRAINT blog_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);';
  var createView = "CREATE INDEX blog_id_idx ON blog USING btree (id);";
  pgMap.createTable('blog',createString,createView,cb);
}

function dropTable(cb) {
  debug('dropTable');
  pgMap.dropTable('blog',cb);
}

Blog.prototype.isEditable = function isEditable(lang) {
  debug("isEditabe");
  var result = true;
  if (this["exported"+lang]) {
    result = false;
  }
  var closeLANG = this["close"+lang];
  if (typeof(closeLANG)!='undefined') {
    if (closeLANG) result = false;
  }
  return result;
};


var _allTimer = {};

Blog.prototype.startCloseTimer = function startCloseTimer() {
  debug("startCloseTimer");

  // if there is a timer, stop it frist, than decide a new start
  if (_allTimer[this.id]) {
    _allTimer[this.id].cancel();
    _allTimer[this.id] = null;
  }
  if (this.status!="open") return;
  if (this.endDate) {
    var date = new Date(this.endDate);
    console.log("Setting timer to "+date);
    _allTimer[this.id] = schedule.scheduleJob(date,function(){
      console.log("Timer Called");
      exports.autoCloseBlog(function(){});
    });
  }
};

exports.startAllTimers = function startAllTimers(callback) {
  debug("startAllTimers");
  exports.find({status:"open"},function(err,result) {
    if (err) return callback(err);
    if (!result) return callback();
    for (var i=0;i<result.length;i++) {
      result[i].startCloseTimer();
    }
    exports.autoCloseBlog(callback);
  });
};



Blog.prototype.save = pgMap.save;

// Define it on BlogModule level to (for no Blog Specified)
module.exports.getCategories = getGlobalCategories;

// Creation Functions

// Create a blog in memory with a given prototype
// create(proto)
// proto: (optional) JSON Data, to copy for the new object
//         the copy is a flat copy
module.exports.create= create;

module.exports.createNewBlog = createNewBlog;

module.exports.autoCloseBlog = autoCloseBlog;
// Find Functions



// Create Tables in Prostgres with all indices and views
module.exports.createTable = createTable;

// Delete table in Postgres
module.exports.dropTable = dropTable;
