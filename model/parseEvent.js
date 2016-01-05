var debug   = require("debug")("OSMBC:model:parseEvent");
var moment  = require("moment");
var request = require("request");
var markdown = require('markdown-it')();
var ct = require('../data/calenderTranslation.js');



// This page is delivering the calendar events
var wikiEventPage = "https://wiki.openstreetmap.org/w/api.php?action=query&titles=Template:Calendar&prop=revisions&rvprop=content&format=json";


var regexList = [ {regex:/\|.*\{\{cal\|([a-z]*)\}\}.*\{\{dm\|([a-z 0-9|]*)\}\} *\|\|(......*), *\[\[(.*)\]\].*\[\[(.*)\]\].*/gi,
               keys:[               "type",                "date",              "desc",         "town",       "country"]},
               {regex:/\|.*\{\{cal\|([a-z]*)\}\}.*\{\{dm\|([a-z 0-9|]*)\}\} *\|\|(......*) *\[\[(.*)\]\].*\[\[(.*)\]\].*/gi,
               keys:[               "type",               "date",                "desc",        "town",       "country"]},
               {regex:/\|.*\{\{cal\|([a-z]*)\}\}.*\{\{dm\|([a-z 0-9|]*)\}\} *\|\|(......*) *, *\[\[(.*)\]\] *, *\[\[(.*)\]\].*/gi,
               keys:[               "type",               "date",               "desc",        "town",          "country"]}, 
               {regex:/\|.*\{\{cal\|([a-z]*)\}\}.*\{\{dm\|([a-z 0-9|]*)\}\} *\|\|(......*), *\[\[(.*)\]\].*/gi,
               keys:[               "type",               "date",                "desc",         "country"]},
               {regex:/\|.*\{\{cal\|([a-z]*)\}\}.*\{\{dm\|([a-z 0-9|]*)\}\} *\|\|(......*)/gi,
               keys:[               "type",               "date",                "desc"]} ];


/* next Date is interpreting a date of the form 27 Feb as a date, that
  is in the current year. The window, to put the date in starts 50 days before now*/

function nextDate(string) {
  //debug('nextDate');
  if (!string) return null;
  var now = new Date();
  now.setDate(now.getDate()-50);
  var result = new Date(string);

  while (result.getTime() <= now.getTime()) {
    result = new Date(result.getFullYear()+1,result.getMonth(),result.getDate());
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
        if (list[j] == "date") {
          r.startDate = parseStartDate(value);
          r.endDate = parseEndDate(value);

        } else {
          r[list[j]]=value;
        }
      }
      return r;
    } 
  }
  return null;
}

// exported for test reasons
exports.parseLine = parseLine;



function parseWikiInfo(description) {
  debug('parseWikiInfo %s',description);
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
      result += "["+title+"]("+link+")";
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
        result += "["+title+"]("+link+")"; 
      } else result += title;
    } 
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


function calenderToMarkdown(lang,date,duration,cb) {
  debug('calenderToMarkdown');
  if (typeof(date)=='function') {
    cb = date;
    date = new Date();
    date.setDate(date.getDate()-3);
    duration = 24;
  } 
  var result;
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
    


      if (result) {
        if (result.endDate >= from && result.startDate <= to) {
          events.push(result);
          result.markdown = parseWikiInfo(result.desc);

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
    cb(null,result);
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

/* parseWikiInfo convertes a string in wikimarkup to markup.
   only links like [[]] [] are converted to [](),
   the result is "trimmed"*/
exports.parseWikiInfo = parseWikiInfo;





