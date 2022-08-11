"use strict";

const axios = require("axios");
const moment = require("moment");

const mdUtil = require("../util/md_util.js");
const configModule = require("../model/config.js");
const config = require("../config.js");
const language = require("../model/language.js");

const NodeCache = require("node-cache");

const nominatimCache = new NodeCache({ stdTTL: 21 * 24 * 60 * 60, checkperiod: 24 * 60 * 60 });

const osmbcDateFormat = config.getValue("CalendarDateFormat", { mustExist: true });

async function loadEvents(lang) {
  const url = "https://osmcal.org/api/v2/events/";
  let request = await axios.get(url);
  let json = request.data;
  if (!Array.isArray(json)) json = [{ name: "osmcal did not reply with Eventlist" }];
  let event;
  for (event of json) {
    if (!event.location) continue;
    if (!event.location.coords) continue;
    const requestString = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=" + encodeURI(event.location.coords[1]) +
    "&lon=" + encodeURI(event.location.coords[0]) +
    "&accept-language=" + lang;

    let loc = nominatimCache.get(requestString);
    if (loc === undefined) {
      request = await axios.get(requestString, { headers: { "User-Agent": "OSMBC Calendar Generator" } });
      loc = request.data;
      if (loc && !loc.error) nominatimCache.set(requestString, loc);
    }
    if (loc.name) event.town = loc.name;

    // special fix for not delivering town (e.g. Berlin)

    if (loc.addresstype === "postcode" && loc.address && loc.address.state) event.town = loc.address.state;
    if (loc.address && loc.address.country) event.country = loc.address.country;
    if (loc.address && loc.address.country_code) event.country_code = loc.address.country_code;
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
  let date = new moment();


  const startDate = moment(event.date && event.date.start);
  let endDate = startDate.clone();
  if (event.date && typeof event.date.end !== "undefined") endDate = moment(event.date.end);

  let diff = -3;
  const optionDiff = (option) ? parseInt(option.date) : diff;
  if (!Number.isNaN(optionDiff)) {
    diff = optionDiff;
  }
  date = date.add(diff, "day");
  let duration = 15;
  if (option && option.duration && option.duration !== "") {
    duration = parseInt(option.duration);
  }
  let bigDuration = 23;
  if (option && option.big_duration && option.big_duration !== "") {
    bigDuration = parseInt(option.big_duration);
  }
  const from = date.clone();
  const to = date.clone().add(duration, "days");
  const toForBig = date.clone().add(bigDuration, "days");

  // until in two weeks
  let filtered = false;

  if (endDate.isBefore(from, "day")) filtered = true;
  if (startDate.isAfter(toForBig, "day")) filtered = true;

  if (option && option.includeCountries && event.country_code &&
    option.includeCountries.indexOf(event.country_code) < 0) filtered = true;

  if (option && option.excludeCountries && event.country_code &&
    option.excludeCountries.indexOf(event.country_code) >= 0) filtered = true;


  if (!event.big && startDate.isAfter(to)) filtered = true;
  return filtered;
}

function enrichData(json, lang) {
  const ct = configModule.getConfig("calendartranslation");
  const cf = configModule.getConfig("calendarflags");

  if (!Array.isArray(json)) return;

  if (json.length === 0) return;

  if (typeof json[0] !== "object") return;

  let event;
  for (event of json) {
    // convert online venue to binary online flag
    let online = false;
    if (event.location && ct.locationNoTranslation && ct.locationNoTranslation.indexOf(event.location.venue) >= 0) online = true;
    event.online = online;

    if (event.cancelled) {
      event.name = "~~" + event.name + "~~";
    }

    if (event.url) {
      event.name = event.name + ` [:osmcalpic:](${event.url})`;
    }


    // convert date
    let dateString;
    const sd = moment(event.date && event.date.start);
    const ed = moment(event.date && event.date.end);
    sd.locale(language.momentLocale(lang));
    ed.locale(language.momentLocale(lang));

    if (event.date && event.date.start) {
      dateString = sd.format(osmbcDateFormat);
    }
    if (event.date && event.date.end) {
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

  let events;
  let filter;
  let filteredEvents;

  try {
    events = await loadEvents(lang);
    filter = ef[lang];
    filteredEvents = await filterEvents(events, filter);
  } catch (err) {
    let errmessage = "Calendar could not be generated";
    if (err.message) errmessage = err.message;
    filteredEvents = [{ name: errmessage }];
    if (process.NODE_ENV !== "test") console.info(err);
  }



  enrichData(filteredEvents, lang);

  const table = [
    { field: "town", name: townName },
    { field: "name", name: titleName },
    { field: "online", name: onlineName },
    { field: "dateString", name: dateName },
    { field: "country_flag", name: countryName }
  ];
  const result =  mdUtil.mdTable(filteredEvents, table);
  return result;
}

function getEventMdCb(lang, cb) {
  getEventMd(lang)
    .then((result) => { return cb(null, result); })
    .catch((err) => { return cb(err); });
}



module.exports.getEventMd = getEventMd;
module.exports.getEventMdCb = getEventMdCb;
module.exports.forTestOnly = {};
module.exports.forTestOnly.filterEvent = filterEvent;
