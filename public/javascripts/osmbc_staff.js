"use strict";

/* exported highlightWrongLinks */
/* exported chooseLanguage */
/* exported chooseLanguageSet */
/* exported setUserConfig */

/* jshint esversion: 6 */

function highlightWrongLinks() {
  /* jshint validthis: true */
  const object = $(this);
  const list = [];
  const mapping = {};
  if (!window.cacheLink) window.cacheLink = {};

  function collectLinks() {
    const o = $(this);
    if (o.attr("href").charAt(0) === "#") return;
    const url = o.attr("href");
    if (!mapping[url]) mapping[url] = [];
    mapping[url].push(o);
  }
  function collectLinksForPreview() {
    const object = $(this);
    object.find("a").each(collectLinks);
  }

  if (object.attr("id")) object.find("a").each(collectLinks);
  else $(".preview").each(collectLinksForPreview);

  for (const k in mapping) {
    if (!window.cacheLink[k]) list.push(k);
  }

  function setAllLinks() {
    for (const l in mapping) {
      if (window.cacheLink[l] !== "OK") {
        mapping[l].forEach(function(k) {
          k.addClass("nonexist");
          k.text(k.text() + " #" + window.cacheLink[l]);
        });
      }
    }
  }
  if (list.length > 0) {
    $.ajax({
      url: window.htmlroot + "/article/urlexist",
      data: { urls: list },
      dataType: "json",
      traditional: true,
      type: "post",
      success: function(data) {
        if (data) {
          for (const l in data) {
            window.cacheLink[l] = data[l];
          }
          setAllLinks();
        }
      }
    });
  } else {
    setAllLinks();
  }
}


function chooseLanguage(number, lang) {
  const data = {};
  data[number] = lang;
  jQuery.post(window.htmlroot + "/language", data, function () {
    location.reload();
  }).fail(function (err) {
    console.error("Problem changing language " + number + " " + lang);
    console.error(err);
  });
}
function chooseLanguageSet(set, action) {
  const data = {};

  if (action && action === "save") {
    data.action = action;
    data.set = $("input#newSetToBeSaved").val();
  }
  if (action && action === "delete") {
    data.action = action;
    data.set = set;
  }
  if (action && action === "set") {
    data.action = action;
    data.set = set;
  }
  jQuery.post(window.htmlroot + "/languageset", data, function () {
    location.reload();
  }).fail(function (err) {
    console.error("Problem changing language set" + set + " Action " + action);
    console.err(err);
  });
}

function setUserConfig(options) {
  jQuery.post(window.htmlroot + "/setuserconfig/", options, function () {
    location.reload();
  }).fail(function (err) {
    console.error("Trouble saveing User Config");
    console.error(err);
  });
}
