"use strict";

var debug   = require("debug")("OSMBC:model:parseEvent");
var should  = require("should");
var moment  = require("moment");
var request = require("request");
var markdown = require("markdown-it")();
var config = require("../config.js");
var logger = require("../config.js").logger;
var configModule = require("../model/config.js");
var async = require("async");
var https = require("https");

let osmbcDateFormat = config.getValue("CalendarDateFormat", {mustExist: true});


// This page is delivering the calendar events
var wikiEventPage = "https://wiki.openstreetmap.org/w/api.php?action=query&titles=Template:Calendar&prop=revisions&rvprop=content&format=json";

let discontinueTime = moment("01/01/2018", "MM/DD/YYYY");

if (discontinueTime.isBefore(moment())) {
  logger.error("parse Event can be removed from source");
}

var regexList = [ {regex: /\| *\{\{cal\|([a-z]*)\}\}.*\{\{dm\|y=([0-9]*)\|([a-z 0-9|]*)\}\} *\|\| *<span[^>]*> *(.*) *, *\[\[(.*)\]\] *, *\[\[(.*)\]\] *<\/span> *\{\{SmallFlag\|(.*)\}\}/gi,
  keys: ["type", "year", "date", "desc", "town", "country", "countryflag"],
  convert: ["%s", "%s", "%s", "%s", "[[%s]]", "[[%s]]", "%s"]},
{regex: /\| *\{\{cal\|([a-z]*)\}\}.*\{\{dm\|y=([0-9]*)\|([a-z 0-9|]*)\}\} *\|\| *<span[^>]*> *(.*) *, *(.*) *, *\[\[(.*)\]\] *<\/span> *\{\{SmallFlag\|(.*)\}\}/gi,
  keys: ["type", "year", "date", "desc", "town", "country", "countryflag"],
  convert: ["%s", "%s", "%s", "%s", "%s", "[[%s]]", "%s"]},
{regex: /\| *\{\{cal\|([a-z]*)\}\}.*\{\{dm\|y=([0-9]*)\|([a-z 0-9|]*)\}\} *\|\| *<span[^>]*> *(.*) *, *(.*) *, *(.*) *<\/span> *\{\{SmallFlag\|(.*)\}\}/gi,
  keys: ["type", "year", "date", "desc", "town", "country", "countryflag"],
  convert: ["%s", "%s", "%s", "%s", "%s", "%s", "%s"]}
//  {regex:/\| *\{\{cal\|([a-z]*)\}\}.*\{\{dm\|([a-z 0-9|]*)\}\} *\|\|(.*) *, *(.*) *\{\{SmallFlag\|(.*)\}\} *\{\{SmallFlag\|(.*)\}\}/gi,
//  keys:[               "type",                "date",              "desc",       "country","wappenflag","countryflag"]},
//  {regex:/\| *\{\{cal\|([a-z]*)\}\}.*\{\{dm\|([a-z 0-9|]*)\}\} *\|\|(.*) *, *(.*) *\{\{SmallFlag\|(.*)\}\}/gi,
//  keys:[               "type",                "date",              "desc",       "country","countryflag"]},
//  {regex:/\| *\{\{cal\|([a-z]*)\}\}.*\{\{dm\|([a-z 0-9|]*)\}\} *\|\|(.*) */gi,
//  keys:[               "type",                "date",              "desc"]},
];



/* next Date is interpreting a date of the form 27 Feb as a date, that
  is in the current year. The window, to put the date in starts 50 days before now */

var _cache = {};
var _geonamesUser = null;

function convertGeoName(name, lang, callback) {
  if (lang === "JP") lang = "JA";
  if (!_geonamesUser) _geonamesUser = config.getValue("GeonamesUser");
  let key = lang + "_" + name;
  if (_cache[key]) return callback(null, _cache[key]);
  var requestString = "http://api.geonames.org/searchJSON?q=" + encodeURI(name) + "&username=" + _geonamesUser + "&maxRows=1&lang=" + lang;
  request(requestString, function(err, response, body) {
    if (err) return callback(err, null);
    var json = JSON.parse(body);
    if (json && json.geonames && json.geonames[0] && json.geonames[0].name) {
      _cache[key] = json.geonames[0].name;
      return callback(null, json.geonames[0].name);
    } else {
      if (json.status) return callback(json.message, null);
      return callback(null, name);
    }
  });
}

function nextDate(string, year) {
  // debug('nextDate');
  if (!string) return null;



  var result = new Date(string);
  result = new Date(Date.UTC(parseInt(year), result.getMonth(), result.getDate()));

  return result;
}
// for Test purposes exported
exports.nextDate = nextDate;


/* This function returns the start date of an event, based on a string like
   Jan 27|Jan 28 taken from {{dm|xxxxx}} substring of calendar event */

function parseStartDate(string, year) {
  // debug('parseStartDate')
  let datestart = string;
  if (string.indexOf("|") >= 0) {
    datestart = datestart.substring(0, datestart.indexOf("|"));
  }
  datestart = nextDate(datestart, year);
  // dateend = nextDate(dateend);
  return datestart;
}

/* This function returns the end date of an event, based on a string like
   Jan 27|Jan 28 taken from {{dm|xxxxx}} substring of calendar event,
   in the case of no enddate, the start date is returned */
function parseEndDate(string, year) {
  // debug('parseEndDate')
  var datestart = string;
  var dateend;

  if (string.indexOf("|") >= 0) {
    dateend = datestart.substring(datestart.indexOf("|") + 1, 99999);
    datestart = datestart.substring(0, datestart.indexOf("|"));
  }
  datestart = nextDate(datestart, year);
  dateend = nextDate(dateend, year);
  if (dateend === null) dateend = datestart;
  return dateend;
}

/* parseLine is parsing a calendar line, by applying the regex one by one
   and putting the results into a json with the given keys.
   If no regex is matching, null is returned */

function parseLine(string) {
  // debug('parseLine');
  for (var i = 0; i < regexList.length; i++) {
    var results = regexList[i].regex.exec(string);
    let year = null;

    if (results) {
      var r = {};
      for (var j = 0; j < regexList[i].keys.length; j++) {
        var value = results[j + 1].trim();
        var list  = regexList[i].keys;
        var convert = regexList[i].convert;
        if (list[j] === "year") year = value;
        if (list[j] === "date") {
          r.startDate = parseStartDate(value, year);
          r.endDate = parseEndDate(value, year);
        } else {
          r[list[j]] = convert[j].replace("%s", value);
        }
      }
      return r;
    }
  }
  if (string.trim() === "|}") return null;
  if (string.trim().substring(0, 2) === "|=") return null;
  if (string.trim().substring(0, 1) !== "|") return null;
  if (string.indexOf('style="width:16px"') >= 0) return null;
  if (string.indexOf("{{cal|none}}") >= 0) return null;



  if (string.trim().substring(0, 2) !== "|-" && string.trim().substring(0, 1) === "|") return string;
  return null;
}

// exported for test reasons
exports.parseLine = parseLine;



function parseWikiInfo(description, options) {
  debug("parseWikiInfo %s", description);
  if (!options) options = {};
  var result = "";
  var end, next, desc, split;
  var title, link;
  while (description && description.trim() !== "") {
    debug("parse %s", description);
    next = description.indexOf("[[");
    end = description.indexOf("]]");
    if (description.indexOf("[") < next) next = -1;
    if (next >= 0 && end >= 0) {
      debug("found [[]] %s %s", next, end);
      result += description.substring(0, next);
      desc = description.substring(next + 2, end);
      description = description.substring(end + 2);
      split = desc.indexOf("|");
      if (split < 0) {
        title = desc;
        link = "https://wiki.openstreetmap.org/wiki/" + desc;
      } else {
        title = desc.substring(split + 1, desc.length);

        link = "https://wiki.openstreetmap.org/wiki/" + desc.substring(0, split);
      }
      while (link.indexOf(" ") >= 0) link = link.replace(" ", "%20");
      if (options.dontLinkify) {
        result += title;
      } else {
        result += "[" + title + "](" + link + ")";
      }
    } else {
      next = description.indexOf("[");
      end = description.indexOf("]");
      if (next >= 0 && end >= 0) {
        debug("found [] %s %s", next, end);
        result += description.substring(0, next);
        desc = description.substring(next + 1, end);
        description = description.substring(end + 1);
        split = desc.indexOf(" ");
        if (split < 0) {
          title = desc.substring(0, desc.length);
          link = title;
        } else {
          title = desc.substring(split + 1, desc.length);
          link = desc.substring(0, split);
        }
      } else {
        title = description;
        link = null;
        description = "";
      }
      if (link) {
        while (link.indexOf(" ") >= 0) link = link.replace(" ", "%20");
        if (options.dontLinkify) {
          result += title;
        } else {
          result += "[" + title + "](" + link + ")";
        }
      } else result += title;
    }
  }
  while (result.search("<big>") >= 0) {
    result = result.replace("<big>", "");
  }
  while (result.search("</big>") >= 0) {
    result = result.replace("</big>", "");
  }
  while (result.search("'''") >= 0) {
    result = result.replace("'''", "");
  }
  return result.trim();
}

var empty = "                                                                                  ";
empty = empty + empty;
empty = empty + empty;
empty = empty + empty;
var lineString = "---------------------------------------------------";
lineString = lineString + lineString;
lineString = lineString + lineString;
lineString = lineString + lineString;

function wl(string, length) {
  return (string + empty).substring(0, length);
}
function ll(length) {
  return lineString.substring(0, length);
}

function filterEvent(event, option) {
  var date = new moment();



  var startDate = moment(event.startDate);
  var endDate = startDate.clone();
  if (typeof event.endDate !== "undefined") endDate = moment(event.endDate);

  let diff = -3;
  let optionDiff = parseInt(option.date);
  if (!Number.isNaN(optionDiff)) {
    diff = optionDiff;
  }
  date = date.add(diff, "day");
  var duration = 15;
  if (option.duration && option.duration !== "") {
    duration = parseInt(option.duration);
  }
  var bigDuration = 23;
  if (option.big_duration && option.big_duration !== "") {
    bigDuration = parseInt(option.big_duration);
  }
  var from = date.clone();
  var to = date.clone().add(duration, "days");
  var toForBig = date.clone().add(bigDuration, "days");

  // until in two weeks
  let filtered = false;

  if (endDate.isBefore(from, "day")) filtered = true;
  if (startDate.isAfter(toForBig, "day")) filtered = true;

  if (option.includeCountries && event.country &&
    option.includeCountries.toLowerCase().indexOf(event.country.toLowerCase()) < 0) filtered = true;

  if (option.excludeCountries && event.country &&
    option.excludeCountries.toLowerCase().indexOf(event.country.toLowerCase()) >= 0) filtered = true;


  if (!event.big && startDate.isAfter(to)) filtered = true;
  return filtered;
}

function calendarToMarkdown2(countryFlags, ct, option, cb) {
  debug("calendarToMarkdown2");
  should(typeof (cb)).eql("function");


  calendarToJSON({}, function(error, result) {
    if (error) cb(error);
    calendarJSONToMarkdown2(result, countryFlags, ct, option, cb);
  });
}

function calendarJSONToMarkdown2(json, countryFlags, ct, option, cb) {
  debug("calendarJSONToMarkdown2");
  should(typeof (cb)).eql("function");

  var lang = option.lang;
  var enableCountryFlags = option.enableCountryFlags;
  let result = json;

  var events = [];
  var errors = result.error;

  var townLength = 0;
  var descLength = 0;
  var dateLength = 0;
  var countryLength = 0;

  // First sort Events by Date

  // events.sort(function cmpEvent(a,b){return a.startDate - b.startDate;});

  async.eachSeries(result.events, function(event, callback) {
    let e = {};
    e.country = event.country;
    e.town = event.town;
    e.startDate = event.startDate;
    e.endDate = event.endDate;
    e.markdown = event.markdown;
    if (!filterEvent(event, option)) events.push(e); else return callback();



    // first try to convert country flags:
    e.countryFlag = e.country;
    if (e.countryFlag && enableCountryFlags) {
      var country = e.countryFlag.toLowerCase();
      if (countryFlags[country]) e.countryFlag = "![" + country + "](" + countryFlags[country] + ")";
    }
    if (e.town) townLength = Math.max(e.town.length, townLength);
    if (e.markdown) descLength = Math.max(e.markdown.length, descLength);
    if (e.countryFlag) countryLength = Math.max(e.countryFlag.length, countryLength);
    var dateString;
    var sd = moment(e.startDate);
    var ed = moment(e.endDate);
    sd.locale(config.moment_locale(lang));
    ed.locale(config.moment_locale(lang));

    if (e.startDate) {
      dateString = sd.format(osmbcDateFormat);
    }
    if (e.endDate) {
      if ((e.startDate.getTime() !== e.endDate.getTime())) {
        dateString = sd.format(osmbcDateFormat) + "-" + ed.format(osmbcDateFormat);
      }
    }
    e.dateString = dateString;
    dateLength = Math.max(dateLength, dateString.length);
    if (option.useGeoNames) {
      convertGeoName(e.town, option.lang, function(err, town) {
        if (err) return callback();
        e.town = town;
        if (e.town) townLength = Math.max(e.town.length, townLength);
        return callback();
      });
    } else callback();
  }, function() {
    result = "";
    result += "|" + wl(ct.town[lang], townLength) + "|" + wl(ct.title[lang], descLength) + "|" + wl(ct.date[lang], dateLength) + "|" + wl(ct.country[lang], countryLength) + "|\n";
    result += "|" + ll(townLength) + "|" + ll(descLength) + "|" + ll(dateLength) + "|" + ll(countryLength) + "|\n";
    for (let i = 0; i < events.length; i++) {
      var t = events[i].town;
      if (!t) t = "";
      var c = events[i].countryFlag;
      if (!c) c = "";
      result += "|" + wl(t, townLength) + "|" + wl(events[i].markdown, descLength) + "|" + wl(events[i].dateString, dateLength) + "|" + wl(c, countryLength) + "|\n";
    }

    cb(null, result, errors);
  });
}

function calendarToMarkdown(options, cb) {
  if (discontinueTime.isBefore(moment())) return cb(new Error("Service discontinued"));
  var calendarFlags = configModule.getConfig("calendarflags");
  if (!calendarFlags) calendarFlags = {};
  var ct = configModule.getConfig("calendartranslation");
  if (!ct) ct = {};
  if (!ct.town) ct.town = {};
  if (!ct.title) ct.title = {};
  if (!ct.date) ct.date = {};
  if (!ct.country) ct.country = {};

  calendarToMarkdown2(calendarFlags, ct, options, cb);
}

function calendarJSONToMarkdown(json, options, cb) {
  if (discontinueTime.isBefore(moment())) return cb(new Error("Service discontinued"));
  var calendarFlags = configModule.getConfig("calendarflags");
  if (!calendarFlags) calendarFlags = {};
  var ct = configModule.getConfig("calendartranslation");
  if (!ct) ct = {};
  if (!ct.town) ct.town = {};
  if (!ct.title) ct.title = {};
  if (!ct.date) ct.date = {};
  if (!ct.country) ct.country = {};

  calendarJSONToMarkdown2(json, calendarFlags, ct, options, cb);
}

let agentOptions = {

  rejectUnauthorized: false
};

let agent = new https.Agent(agentOptions);

function calendarToJSON(option, cb) {
  debug("calendarToJSON");
  if (discontinueTime.isBefore(moment())) return cb(new Error("Service discontinued"));
  should(typeof (cb)).eql("function");

  var requestOptions = {
    url: wikiEventPage,
    agent: agent
  };

  request.get(requestOptions, function(error, response, body) {
    if (error) return cb(error);
    var json = JSON.parse(body);
    // body = (json.query.pages[2567].revisions[0]["*"]);
    if (!json.query) return cb(new Error("No Query Field in Wiki Page"));
    body = json.query.pages;
    for (var k in body) {
      body = body[k];
      break;
    }
    body = body.revisions[0]["*"];

    var point = body.indexOf("\n");

    var events = [];
    var errors = "";

    while (point >= 0) {
      var line = body.substring(0, point);
      body = body.substring(point + 1, 999999999);
      point = body.indexOf("\n");
      var result = parseLine(line);
      result = parseLine(line);

      if (typeof (result) === "string") {
        if (!errors) errors = "\n\nUnrecognized\n";
        errors += result + "\n";
        result = null;
      }



      if (result) {
        events.push(result);
        result.markdown = parseWikiInfo(result.desc);
        result.text = parseWikiInfo(result.desc, {dontLinkify: true});
        result.town_md = parseWikiInfo(result.town, {dontLinkify: false});
        result.town = parseWikiInfo(result.town, {dontLinkify: true});
        result.country_md = parseWikiInfo(result.country, {dontLinkify: false});
        result.country = parseWikiInfo(result.country, {dontLinkify: true});
        result.big = (result.desc.indexOf("<big>") >= 0);

        result.html = markdown.renderInline(result.markdown);
        result.town_html = markdown.renderInline(result.town_md);
        result.country_html = markdown.renderInline(result.country_md);
      }
    }

    var returnJSON =
      {
        "version": "0.1",
        "generator": "TheFive Wiki Calendar Parser",
        "time": new Date(),

        "copyright": "The data is taken from http://wiki.openstreetmap.org/wiki/Template:Calendar and follows its license rules.",
        "events": events,
        "errors": errors
      };

    cb(null, returnJSON);
  });
}

function calendarToHtml(date, callback) {
  debug("calendarToHtml");
  if (discontinueTime.isBefore(moment())) return callback(new Error("Service discontinued"));
  if (typeof (date) === "function") {
    callback = date;
    date = new Date();
    date.setDate(date.getDate() - 3);
  }
  calendarToMarkdown(date, function(err, t) {
    debug("calendarToHtml:subfunction");

    if (err) return callback(err);
    debug("convert markdown to html");
    var result = markdown.render(t);
    return callback(null, result);
  });
}
/* this function reads the content of the calendar wiki, and convertes it to a markdonw
   in the form |town|description|date|country| */
exports.calendarToMarkdown = calendarToMarkdown;
exports.calendarJSONToMarkdown = calendarJSONToMarkdown;
exports.calendarToHtml = calendarToHtml;
exports.calendarToJSON = calendarToJSON;
exports.filterEvent = filterEvent;
exports.convertGeoName = convertGeoName;

/* parseWikiInfo convertes a string in wikimarkup to markup.
   only links like [[]] [] are converted to [](),
   the result is "trimmed" */
exports.parseWikiInfo = parseWikiInfo;




