"use strict";

var request = require("request");
var toMarkdown = require('to-markdown');
var htmlparser = require("htmlparser2");
var debug = require('debug')('OSMBC:import:download');

var articleModule = require('../model/article.js');
var blogModule = require('../model/blog.js');
var config=require('../config.js');

var async = require('async');



// For Translation:

var categoryTranslation = 
{
  "[Aktuelle Kategorie]":"[Actual Category]",
  "In eigener Sache":"About us",
  "Wochenaufruf":"Weekly exerciseEN:",
  "Mapping":"Mapping",
  "Community":"Community",
  "Importe":"Imports",
  "OpenStreetMap Foundation":"OpenStreetMap Foundation",
  "Veranstaltungen":"Events",
  "Humanitarian OSM":"Humanitarian OSM",
  "Karten":"Maps",
  "switch2OSM":"#switch2OSM",
  "Open-Data":"Open Data",
  "Lizenzen":"Licences",
  "Programme":"Software",
  "Programmierung":"Programming",
  "Kennst Du schon …":"Did you know …",
  "Weitere Themen mit Geo-Bezug":'Other “geo” things',
  "Wochenvorschau" :"Weekly Preview",
  "ODbL":"ODbL",
  "Humanitarian OpenStreetMap":"Humanitarian OpenStreetMap",
  "Humanitarian OpenStreetMap Team":"Humanitarian OpenStreetMap Team",
  "Weltweit":"Global",
  "Sonstiges":"Other",
  "Talk, Forum, Wiki & Blog":"Talk, Forum, Wiki & Blog",
  "Talk, Forum, Wiki":"Talk, Forum, Wiki",
  "Blog & Twitter":"Blog & Twitter",
  "Import":"Import",
  "Tagging":"Tagging",
  "Open Data & ODbL":"Open Data & ODbL",
  "Konferenzen & Treffen":"Conferences",
  "und sonst":"Other",
  "Karten & Programme":"Maps & Programs",
  "#switch2osm":"#switch2osm",
  "Weltweit & sonstiges":"Global & Other"

};


// This is the simple HTML Parser for the WN

var currentCategory = new Category();
var currentElement = "";

var state = null;
var result = [];
var categoryList = [];


var parser = new htmlparser.Parser({
    onopentag: function(name, attribs){
        // ignore everything in comment mode
        if (state == "finished") return;
        
        if(name == "h2" ){
            state = "category";
          
        }
        if (name == "li") {
          state = "list";
        }
        if (name == "a" && state == "list") {
            currentElement += "<a href=\""+attribs.href+"\">";
          
        }
        if (name == "div") {
          if (attribs.id == "entry-author-info") {
            state = "finished";
            result.push(currentCategory);
          }
        }
    },
    ontext: function(text){
        if (state == "finished") return;

        
        if (state == "category" && text != currentCategory.title) {
          text = text.replace("&amp;","&");
          result.push(currentCategory);
          currentCategory =new Category();
          currentCategory.title = text;
          categoryList.push(text);
        }
        if (state == "list") {
          currentElement += text;
        }
       

    },
    onclosetag: function(tagname){
        if (state == "finished") return;
        if(tagname === "h2"){
           state = "";
        }
        if(tagname === "li"){
           state = "";
           currentCategory.element.push(currentElement);
           currentElement = "";
        }
        if (tagname == "a" && state == "list") {
            currentElement += "</a>";
          
        }

    }
}, {decodeEntities: false});
 

function Category() {
    this.title = null;
    this.element = [];
  }

function importBlog(nr,callback) {
  debug('importBlog %s',nr);

  var number = "000"+nr;

  var blogName = "WN"+number.substring(number.length-3,99);
  console.log("Import WN "+blogName);
  
  blogModule.findOne({name:blogName},function (err,b) { 
  if (b) {
    console.log(blogName+" already exists");
    return callback();
  }

  var body = null;  
  var url = null;
  async.parallel([
    function tryOneName(cb) {
      debug('tryOneName');
      var u = "http://blog.openstreetmap.de/blog/wochennotiz-nr-"+nr;
      request(u, function (error, response, b) {
        if (!error) {
          debug('Found URL %s',u);
          body = b;
          url = u;
        } else {
          debug('Not found URL %s',u);
        }
        cb();
      });
    },
    function tryOtherName(cb) {
      debug('tryOtherName');
      var u = "http://blog.openstreetmap.de/blog/osm-wochennotiz-nr-"+nr;
      request(u, function (error, response, b) {
        if (!error) {
          debug('Found URL %s',u);
          body = b;
          url = u;
        } else {
          debug('Not found URL %s',u);
        }
        cb();
      });
    }

    ],
    function loadedWN(err){ 
      debug('loadedWN');
      if (err) console.dir(err);
      if (body) {
        state = null;
        result = [];
        categoryList = [];
        parser.write(body);
        console.log("Loaded Url:",url);
        //console.log("Articles: ",result);
        var blog = blogModule.create();

        //fs.writeFileSync(blogName,body,"utf8");

        var cat =[];
        for (var i=0;i<categoryList.length;i++) {
          var c = {DE:categoryList[i]};
          if (c.DE in categoryTranslation) {
            c.EN = categoryTranslation[c.DE];
          }
          else 
          {
            c.EN = c.DE+"Not Translated";
            console.log(c.EN);
          }
          cat.push(c);
        }
        


        blog.setAndSave("IMPORT",{name:blogName,status:"published",categories:cat},function(err){
          console.log("Blog Saved Error("+err+")");
          async.each(result,function iterator(item,cb) {
            var category = item.title;
            //console.dir("ITEM"+item);
            if (category === null) return cb();
            //console.dir("Import Category: "+category);
            //console.dir(item.element.length+" Elements in Category");
            async.each(item.element,function eachArticle(articleProto,cba) {
              //console.log(articleProto);
              var markdownDE = toMarkdown(articleProto);
              var article = articleModule.create();
              article.setAndSave("IMPORT",{blog:blogName,category:category,markdownDE:markdownDE},function(err){
                //console.log("Article Saved");
                cba(err);
              });


            }, function done() {cb();}
            );



          }, function() {
            console.log("Blog "+blogName+ " imported");
            callback();
          }
          ) ;
        });
      }
    });

    
  });
}


config.initialise();

importBlog(268,function(){console.log("Ready.");});
importBlog(269,function(){console.log("Ready.");});
importBlog(270,function(){console.log("Ready.");});
importBlog(271,function(){console.log("Ready.");});
/*
async.timesLimit(1,1,function (n,next){
  console.log("Start Import for "+n);
  importBlog(n,next);

})*/
