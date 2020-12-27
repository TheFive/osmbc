"use strict";

/* exported highlightWrongLinks */

/* jshint esversion: 6 */

function highlightWrongLinks() {
  /* jshint validthis: true */
  const object = $(this);



  object.find("a").each(function() {
    const o = $(this);
    if (o.attr("href").charAt(0) === "#") return;
    $.post(
      window.htmlroot + "/article/urlexist",
      { url: o.attr("href") },

      function(data) {
        if (data !== "OK") {
          o.addClass("nonexist");
          o.text(o.text() + " #" + data);
        }
      })
      .fail(function(err, status) {
        o.addClass("nonexist");
        o.text(o.text() + " http get fail1 " + status + " " + err.message);
      });
  });
}
