"use strict";

var debug   = require("debug")("OSMBC:model:parseEvent");
var should  = require('should');
var moment  = require("moment");
var request = require("request");
var markdown = require('markdown-it')();
var ct = require('../data/calenderTranslation.js');
var countryFlags = require('../data/countryFlags.js');



// This page is delivering the calendar events
var wikiEventPage = "https://wiki.openstreetmap.org/w/api.php?action=query&titles=Template:Calendar&prop=revisions&rvprop=content&format=json";


var regexList = [ {regex:/\| *\{\{cal\|([a-z]*)\}\}.*\{\{dm\|([a-z 0-9|]*)\}\} *\|\|(.*) *, *\[\[(.*)\]\] *, *\[\[(.*)\]\] *\{\{SmallFlag\|(.*)\}\}/gi,
                   keys:[               "type",                "date",              "desc",         "town",       "country","countryflag"],
                   convert:[            "%s",                  "%s",                  "%s",         "[[%s]]",       "[[%s]]","%s"]},
                   {regex:/\| *\{\{cal\|([a-z]*)\}\}.*\{\{dm\|([a-z 0-9|]*)\}\} *\|\|(.*) *, *(.*) *, *\[\[(.*)\]\] *\{\{SmallFlag\|(.*)\}\}/gi,
                   keys:[               "type",                "date",              "desc",         "town",       "country","countryflag"],
                     convert:[            "%s",                  "%s",                  "%s",         "%s",       "[[%s]]","%s"]},
                   {regex:/\| *\{\{cal\|([a-z]*)\}\}.*\{\{dm\|([a-z 0-9|]*)\}\} *\|\|(.*) *, *(.*) *, *(.*) *\{\{SmallFlag\|(.*)\}\}/gi,
                   keys:[               "type",                "date",              "desc",         "town",       "country","countryflag"],
                     convert:[            "%s",                  "%s",                  "%s",         "%s",       "%s","%s"]} //,
                 //  {regex:/\| *\{\{cal\|([a-z]*)\}\}.*\{\{dm\|([a-z 0-9|]*)\}\} *\|\|(.*) *, *(.*) *\{\{SmallFlag\|(.*)\}\} *\{\{SmallFlag\|(.*)\}\}/gi,
                 //  keys:[               "type",                "date",              "desc",       "country","wappenflag","countryflag"]},
                 //  {regex:/\| *\{\{cal\|([a-z]*)\}\}.*\{\{dm\|([a-z 0-9|]*)\}\} *\|\|(.*) *, *(.*) *\{\{SmallFlag\|(.*)\}\}/gi,
                 //  keys:[               "type",                "date",              "desc",       "country","countryflag"]},
                 //  {regex:/\| *\{\{cal\|([a-z]*)\}\}.*\{\{dm\|([a-z 0-9|]*)\}\} *\|\|(.*) */gi,
                 //  keys:[               "type",                "date",              "desc"]},
              ];



/* next Date is interpreting a date of the form 27 Feb as a date, that
  is in the current year. The window, to put the date in starts 50 days before now*/

function nextDate(string) {
  //debug('nextDate');
  if (!string) return null;
  var now = new Date();
  now.setDate(now.getDate()-50);
  var result = new Date(string);
  result = new Date(Date.UTC(result.getYear(),result.getMonth(),result.getDate()));

  while (result.getTime() <= now.getTime()) {
    result = new Date(Date.UTC(result.getFullYear()+1,result.getMonth(),result.getDate()));
  }
  return result;
}
// for Test purposes exported
exports.nextDate = nextDate;


/* This function returns the start date of an event, based on a string like
   Jan 27|Jan 28 taken from {{dm|xxxxx}} substring of calender event */

function parseStartDate(string) {
 // debug('parseStartDate')
  var datestart=string;
  var dateend;
 
  if (string.indexOf("|")>=0) {
    dateend = datestart.substring(datestart.indexOf("|")+1,99999);
    datestart = datestart.substring(0,datestart.indexOf("|"));
  } 
  datestart = nextDate(datestart);
  //dateend = nextDate(dateend);
  return datestart;
}

/* This function returns the end date of an event, based on a string like
   Jan 27|Jan 28 taken from {{dm|xxxxx}} substring of calender event,
   in the case of no enddate, the start date is returned */
function parseEndDate(string) {
 // debug('parseEndDate')
  var datestart = string;
  var dateend;
 
  if (string.indexOf("|")>=0) {
    dateend = datestart.substring(datestart.indexOf("|")+1,99999);
    datestart = datestart.substring(0,datestart.indexOf("|"));
  } 
  datestart = nextDate(datestart);
  dateend = nextDate(dateend);
  if (dateend === null) dateend = datestart;
  return dateend;
}

/* parseLine is parsing a calender line, by applying the regex one by one
   and putting the results into a json with the given keys.
   If no regex is matching, null is returned*/

function parseLine(string) {
 // debug('parseLine');
  for (var i=0;i<regexList.length;i++){
    var results = regexList[i].regex.exec(string);

    if (results) {
      var r={};
      for (var j=0;j<regexList[i].keys.length;j++){
        var value = results[j+1].trim();
        var list  = regexList[i].keys;
        var convert = regexList[i].convert;
        if (list[j] == "date") {
          r.startDate = parseStartDate(value);
          r.endDate = parseEndDate(value);

        }  else {
          r[list[j]]=convert[j].replace("%s",value);
        }
      }
      return r;
    } 
  }
  if (string.trim() =="|}") return null;
  if (string.trim().substring(0,2)=="|=") return null;
  if (string.trim().substring(0,1)!="|") return null;
  if (string.indexOf('style="width:16px"')>=0) return null;
  if (string.indexOf('{{cal|none}}')>=0) return null;



  if (string.trim().substring(0,2) != "|-" && string.trim().substring(0,1)=="|") return string;
  return null;
}

// exported for test reasons
exports.parseLine = parseLine;



function parseWikiInfo(description,options) {
  debug('parseWikiInfo %s',description);
  if (!options) options = {};
  var result = "";
  var end,next,desc,split;
  var title,link;
  while (description && description.trim()!=="") {
    debug("parse %s",description);
    next = description.indexOf("[[");
    end = description.indexOf("]]");
    if (description.indexOf("[")< next) next = -1;
    if (next >= 0 && end >= 0) {
      debug("found [[]] %s %s",next,end);
      result += description.substring(0,next);
      desc = description.substring(next+2,end);
      description = description.substring(end+2);
      split = desc.indexOf("|");
      if (split < 0) {
        title = desc;
        link = "https://wiki.openstreetmap.org/wiki/"+desc;
      } else {
        title = desc.substring(split+1,desc.length);
        
        link = "https://wiki.openstreetmap.org/wiki/"+desc.substring(0,split);
      }
      while (link.indexOf(" ")>=0) link = link.replace(" ","%20");
      if (options.dontLinkify) {
        result += title;
      } else {
        result += "["+title+"]("+link+")";
      }

    } else {   
      next = description.indexOf("[");
      end = description.indexOf("]");
      if (next >= 0 && end >= 0) {
        debug("found [] %s %s",next,end);
        result += description.substring(0,next);
        desc = description.substring(next+1,end);
        description = description.substring(end+1);
        split = desc.indexOf(" ");
        if (split < 0) {
          title = desc.substring(0,desc.length);
          link = title;
        } else {
          title = desc.substring(split+1,desc.length);
          link = desc.substring(0,split);
        }
      } else {
        title = description;
        link = null;
        description = "";
      } 
      if(link) {
        while (link.indexOf(" ")>=0) link = link.replace(" ","%20");
        if (options.dontLinkify) {
          result += title;
        }
        else {
          result += "["+title+"]("+link+")";
        }
      } else result += title;
    } 
  }
  while (result.search("<big>")>=0) {
    result = result.replace("<big>","");
  }
  while (result.search("</big>")>=0) {
    result = result.replace("</big>","");
  }
  return result.trim();
}

var empty = "                                                                                  ";
empty = empty+empty;
empty = empty+empty;
empty = empty+empty;
var lineString = "---------------------------------------------------";
lineString = lineString + lineString;
lineString = lineString + lineString;
lineString = lineString + lineString;

function wl(string,length) {
    return (string + empty).substring(0,length);
}
function ll(length) {
  return lineString.substring(0,length);
}


function calenderToMarkdown(option,cb) {
  debug('calenderToMarkdown');
  should(typeof(cb)).eql("function");
  var date = new Date();
  date.setDate(date.getDate()-3);
  var duration = 24;
  if (option.date && option.date!=="" && option.date!=="null") {
    date = new Date(option.date);
    console.log(option.date+" "+date);
  }
  if (option.duration && option.duration.trim()!=="") {
    duration = parseInt(option.duration);
  }
  var lang = option.lang;
  var enableCountryFlags = option.countryFlags;

  var result;
  var errors = null;
  debug("Date: %s",date);
  request(wikiEventPage, function(error, response, body) {
    var json = JSON.parse(body);
    //body = (json.query.pages[2567].revisions[0]["*"]);
    body = json.query.pages;
    for (var k in body) {
      body = body[k];
      break;
    }
    body = body.revisions[0]['*'];

    var point = body.indexOf("\n");

    var from = new Date(date);
    var to = new Date(date);

    // get all Events from today
    from.setDate(from.getDate());
    // until in two weeks
    to.setDate(to.getDate()+duration);

    var events = [];

    while (point>= 0) {
   
      var line = body.substring(0,point);
      body = body.substring(point+1,999999999);
      point = body.indexOf("\n");
      result = parseLine(line);

      if (typeof(result)=="string") {
        if (!errors) errors = "\n\nUnrecognized\n";
        errors +=result+"\n";
        result = null;
      }
    


      if (result) {
        if (result.endDate >= from && result.startDate <= to) {
          events.push(result);
          result.markdown = parseWikiInfo(result.desc);
          result.town = parseWikiInfo(result.town,{dontLinkify:true});
          result.country = parseWikiInfo(result.country,{dontLinkify:true});
        }
      }
    }
    var townLength = 0;
    var descLength = 0;
    var dateLength = 0;
    var countryLength = 0;

    // First sort Events by Date


    events.sort(function cmpEvent(a,b){return a.startDate - b.startDate;});

    for (var i=0;i<events.length;i++) {
      var e = events[i];

      // first try to convert country flags:

      if (e.country && enableCountryFlags) {
        var country = e.country.toLowerCase();
        if (countryFlags[country]) e.country = "!["+country+"]("+countryFlags[country]+")";
      }
      if (e.town) townLength = Math.max(e.town.length,townLength);
      if (e.markdown) descLength = Math.max(e.markdown.length,descLength);
      if (e.country) countryLength = Math.max(e.country.length,countryLength);
      var dateString;
      var sd = moment(e.startDate);
      var ed = moment(e.endDate);
      sd.locale(lang);
      ed.locale(lang);
  
      if (e.startDate) {
       dateString = sd.format("L");
      }
      if (e.endDate) {
        if ((e.startDate.getTime() !== e.endDate.getTime())) {
          dateString = sd.format("L")+"-"+ed.format("L");
        }
      }
      e.dateString = dateString;
      dateLength = Math.max(dateLength,dateString.length);
    }
    result = "";
    result += "|"+wl(ct.town[lang],townLength)+"|"+wl(ct.title[lang],descLength)+"|"+wl(ct.date[lang],dateLength)+"|"+wl(ct.country[lang],countryLength)+"|\n";
    result += "|"+ll(townLength)+"|"+ll(descLength)+"|"+ll(dateLength)+"|"+ll(countryLength)+"|\n";  
    for (i=0;i<events.length;i++) {
      var t = events[i].town;
      if (!t) t= "";
      var c = events[i].country;
      if (!c) c="";
      result += "|"+wl(t,townLength)+"|"+wl(events[i].markdown,descLength)+"|"+wl(events[i].dateString,dateLength)+"|"+wl(c,countryLength)+"|\n";  
    }
    cb(null,result,errors);
  });
}


function calenderToJSON(option,cb) {
  debug('calenderToJSON');
  should(typeof(cb)).eql("function");

  request(wikiEventPage, function(error, response, body) {
    var json = JSON.parse(body);
    //body = (json.query.pages[2567].revisions[0]["*"]);
    body = json.query.pages;
    for (var k in body) {
      body = body[k];
      break;
    }
    body = body.revisions[0]['*'];

    var point = body.indexOf("\n");

    var events = [];
    var errors = "";


    while (point>= 0) {

      var line = body.substring(0,point);
      body = body.substring(point+1,999999999);
      point = body.indexOf("\n");
      var result = parseLine(line);

      if (typeof(result)=="string") {
        if (!errors) errors = "\n\nUnrecognized\n";
        errors +=result+"\n";
        result = null;
      }



      if (result) {
          events.push(result);
          result.markdown = parseWikiInfo(result.desc);
          result.text = parseWikiInfo(result.desc,{dontLinkify:true});
          result.town_md = parseWikiInfo(result.town,{dontLinkify:false});
          result.town = parseWikiInfo(result.town,{dontLinkify:true});
          result.country_md = parseWikiInfo(result.country,{dontLinkify:false});
          result.country = parseWikiInfo(result.country,{dontLinkify:true});

          result.html = markdown.renderInline(result.markdown);
          result.town_html = markdown.renderInline(result.town_md);
          result.country_html = markdown.renderInline(result.country_md);
      }
    }

    var returnJSON =
    {
      "version": "0.1",
      "generator": "TheFive Wiki Calendar Parser",
      "time":new Date(),

      "copyright": "The data is taken from http://wiki.openstreetmap.org/wiki/Template:Calendar and follows its license rules.",
      "events":events,
      "errors":errors
    };

    cb(null,returnJSON);
  });
}

function calenderToHtml(date,callback) {
  debug('calenderToHtml');
  if (typeof(date)=='function') {
    callback = date;
    date = new Date();
    date.setDate(date.getDate()-3);
  } 
  calenderToMarkdown(date,function(err,t){
    debug('calenderToHtml:subfunction');

    if (err) return callback(err);
    debug('convert markdown to html');
    var result = markdown.render(t);
    return callback(null,result);
  });
}
/* this function reads the content of the calender wiki, and convertes it to a markdonw
   in the form |town|description|date|country|*/
exports.calenderToMarkdown = calenderToMarkdown;
exports.calenderToHtml = calenderToHtml;
exports.calenderToJSON = calenderToJSON;

/* parseWikiInfo convertes a string in wikimarkup to markup.
   only links like [[]] [] are converted to [](),
   the result is "trimmed"*/
exports.parseWikiInfo = parseWikiInfo;





