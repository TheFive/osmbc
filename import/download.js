var request = require("request");
var fs = require("fs");
var toMarkdown = require('to-markdown');
var htmlparser = require("htmlparser2");

var articleModule = require('../model/article.js');
var blogModule = require('../model/blog.js');

var async = require('async');


// For Translation:

categoryTranslation = 
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

}


// This is the simple HTML Parser for the WN

var currentCategory = new Category();
var currentElement = "";

var status = null;
var result = [];
var categoryList = [];


var parser = new htmlparser.Parser({
    onopentag: function(name, attribs){
        // ignore everything in comment mode
        if (status == "finished") return;
        
        if(name == "h2" ){
            status = "category";
          
        }
        if (name == "li") {
          status = "list";
        }
        if (name == "a" && status == "list") {
            currentElement += "<a href=\""+attribs.href+"\">";
          
        }
        if (name == "div") {
          if (attribs.id == "entry-author-info") {
            status = "finished";
            result.push(currentCategory);
          }
        }
    },
    ontext: function(text){
        if (status == "finished") return;

        
        if (status == "category" && text != currentCategory.title) {
          text = text.replace("&amp;","&")
          result.push(currentCategory);
          currentCategory =new Category();
          currentCategory.title = text;
          categoryList.push(text);
        }
        if (status == "list") {
          currentElement += text;
        }
       

    },
    onclosetag: function(tagname){
        if (status == "finished") return;
        if(tagname === "h2"){
           status = "";
        }
        if(tagname === "li"){
           status = "";
           currentCategory.element.push(currentElement);
           currentElement = "";
        }
        if (tagname == "a" && status == "list") {
            currentElement += "</a>";
          
        }

    }
}, {decodeEntities: false});
 

 function Category() {
    this.title = null;
    this.element = [];
  }

 function importBlog(nr,callback) {
   var number = "000"+nr;

   var blogName = "WN"+number.substring(number.length-3,99);
   console.log("Import WN "+blogName);
  
   blogModule.findOne({name:blogName},function (err,b) { 
    if (b) {
      console.log(blogName+" allready exists");
      return callback();
    }

    var body = null;  
    var url = null;
    async.parallel([
      function tryOneName(cb) {
        var u = "http://blog.openstreetmap.de/blog/wochennotiz-nr-"+nr;
        request(u, function (error, response, b) {
          if (!error) {
            body = b;
            url = u;
          }
          cb();
        })
      },
      function tryOneName(cb) {
        var u = "http://blog.openstreetmap.de/blog/osm-wochennotiz-nr-"+nr;
        request(u, function (error, response, b) {
          if (!error) {
            body = b;
            url = u;
          }
          cb();
        })
      }

      ],
      function loadedWN(err){ 
        website = body;
        if (body) {
          status = null;
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
          


          blog.setAndSave("IMPORT",{name:blogName,status:"published",categories:cat},function(err,erg){
            console.log("Blog Saved Error("+err+")");
            async.each(result,function iterator(item,cb) {
              var category = item.title;
              //console.dir("ITEM"+item);
              if (category == null) return cb();
              //console.dir("Import Category: "+category);
              //console.dir(item.element.length+" Elements in Category");
              async.each(item.element,function eachArticle(articleProto,cba) {
                //console.log(articleProto);
                var markdown = toMarkdown(articleProto);
                var article = articleModule.create();
                article.setAndSave("IMPORT",{blog:blogName,category:category,markdown:markdown},function(err){
                  //console.log("Article Saved");
                  cba(err);
                });


              }, function done() {cb();}
              )



            }, function(done) {
              console.log("Blog "+blogName+ " imported");
              callback();
            }
            ) 
          })
        }
      })
 
      
    });
  }


async.timesLimit(268,1,function (n,next){
  importBlog(n,next);

})
