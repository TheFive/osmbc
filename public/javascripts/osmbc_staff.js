"use strict";

/* exported highlightWrongLinks */

function highlightWrongLinks() {
  /* jshint validthis: true */
  var object = $(this);



  object.find("a").each(function() {
    var o = $(this);
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
