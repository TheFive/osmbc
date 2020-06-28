"use strict";

var debug   = require("debug")("OSMBC:model:parseEvent");
var assert  = require("assert").strict;
var moment  = require("moment");
var request = require("request");
var config = require("../config.js");
var configModule = require("../model/config.js");
var async = require("../util/async_wrap.js");

const osmbcDateFormat = config.getValue("CalendarDateFormat", { mustExist: true });



/* next Date is interpreting a date of the form 27 Feb as a date, that
  is in the current year. The window, to put the date in starts 50 days before now */

var _cache = {};
var _geonamesUser = null;

function convertGeoName(name, lang, callback) {
  if (lang === "JP") lang = "JA";
  if (!_geonamesUser) _geonamesUser = config.getValue("GeonamesUser");
  const key = lang + "_" + name;
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



function filterEvent(event, option) {
  var date = new moment();



  var startDate = moment(event.startDate);
  var endDate = startDate.clone();
  if (typeof event.endDate !== "undefined") endDate = moment(event.endDate);

  let diff = -3;
  const optionDiff = parseInt(option.date);
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


function calendarJSONToMarkdown2(json, countryFlags, ct, option, cb) {
  debug("calendarJSONToMarkdown2");
  assert(typeof (cb) === "function");

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
    const e = {};
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

function calendarJSONToMarkdown(json, options, cb) {
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



/* this function reads the content of the calendar wiki, and convertes it to a markdonw
   in the form |town|description|date|country| */
exports.calendarJSONToMarkdown = calendarJSONToMarkdown;
exports.filterEvent = filterEvent;
exports.convertGeoName = convertGeoName;
