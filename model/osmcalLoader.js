"use strict";

const axios = require("axios");
const moment = require("moment");

const mdUtil = require("../util/md_util.js");
const configModule = require("../model/config.js");
const config = require("../config.js");

const osmbcDateFormat = config.getValue("CalendarDateFormat", { mustExist: true });

async function loadEvents(lang) {
  const url = "https://osmcal.org/api/v2/events/";
  let request = await axios.get(url);
  const json = request.data;
  let event;
  for (event of json) {
    if (!event.location) continue;
    if (!event.location.coords) continue;
    const requestString = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=" + encodeURI(event.location.coords[1]) +
    "&lon=" + encodeURI(event.location.coords[0]) +
    "&accept-language=" + lang;
    request = await axios.get(requestString, { headers: { "User-Agent": "OSMBC Calendar Generator" } });
    const loc = request.data;

    if (loc.name) event.town = loc.name;
    if (loc.address.country) event.country = loc.address.country;
    if (loc.address.country_code) event.country_code = loc.address.country_code;
  }
  return json;
}

async function filterEvents(events, filter) {
  const result = [];
  let event;
  for (event of events) {
    if (!filterEvent(event, filter)) result.push(event);
  }
  return result;
}



function filterEvent(event, option) {
  var date = new moment();



  var startDate = moment(event.date.start);
  var endDate = startDate.clone();
  if (typeof event.date.end !== "undefined") endDate = moment(event.date.end);

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

function enrichData(json, lang) {
  const ct = configModule.getConfig("calendartranslation");
  const cf = configModule.getConfig("calendarflags");
  let event;
  for (event of json) {
    // convert online venue to binary online flag
    let online = false;
    if (event.location && ct.locationNoTranslation.indexOf(event.location.venue) >= 0) online = true;
    event.online = online;

    // convert date
    let dateString;
    const sd = moment(event.date.start);
    const ed = moment(event.date.end);
    sd.locale(config.moment_locale(lang));
    ed.locale(config.moment_locale(lang));

    if (event.date.start) {
      dateString = sd.format(osmbcDateFormat);
    }
    if (event.date.end) {
      if ((sd.startOf("day").isBefore(ed.startOf("day")))) {
        dateString = sd.format(osmbcDateFormat) + " - " + ed.format(osmbcDateFormat);
      }
    }
    event.dateString = dateString;

    // generate Calendar Flags
    event.country_flag = event.country_code;
    if (cf[event.country_code]) event.country_flag = `![flag](${cf[event.country_code]})`;

    if (event.online) {
      if (cf.online) event.online = `![online](${cf.online})`;
      else event.online = "✓";
    } else event.online = "";
  }
}

async function getEventMd(lang) {
  const ef = configModule.getConfig("eventsfilter");
  const ct = configModule.getConfig("calendartranslation");
  let townName = "Town";
  if (ct.town && ct.town[lang]) townName = ct.town[lang];
  let countryName = "Country";
  if (ct.country && ct.country[lang]) countryName = ct.country[lang];
  let titleName = "Title";
  if (ct.title && ct.title[lang]) titleName = ct.title[lang];
  let dateName = "Date";
  if (ct.date && ct.date[lang]) dateName = ct.date[lang];
  let onlineName = "Online";
  if (ct.online && ct.online[lang]) onlineName = ct.online[lang];


  const events = await loadEvents(lang);
  const filter = ef[lang];
  const filteredEvents = await filterEvents(events, filter);


  enrichData(filteredEvents, lang);

  const table = [
    { field: "name", name: titleName },
    { field: "online", name: onlineName },
    { field: "town", name: townName },
    { field: "dateString", name: dateName },
    { field: "country_flag", name: countryName }
  ];
  return mdUtil.mdTable(filteredEvents, table);
}

function getEventMdCb(lang, cb) {
  getEventMd(lang)
    .then((result) => { return cb(null, result); })
    .catch((err) => { return cb(err); });
}



module.exports.getEventMd = getEventMd;
module.exports.getEventMdCb = getEventMdCb;
