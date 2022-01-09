"use strict";

/* exported highlightWrongLinks */

/* jshint esversion: 6 */

function highlightWrongLinks() {
  /* jshint validthis: true */
  const object = $(this);
  const list = [];
  const mapping = {};
  if (!window.cacheLink) window.cacheLink = {};



  object.find("a").each(function() {
    const o = $(this);
    if (o.attr("href").charAt(0) === "#") return;
    const url = o.attr("href");
    if (!mapping[url]) mapping[url] = [];
    mapping[url].push(o);
  });
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
