"use strict";


function highlightWrongLinks() {
  /* jshint validthis: true */
  var object = $(this);



  object.find("a").each(function()
  {
    var o = $(this);
    if (o.attr("href").charAt(0)==="#") return;
    $.post(
      window.htmlroot + "/article/urlexist",
      { "url" : o.attr("href")},

      function(data,status){
        if (data !== "OK") {
          o.addClass("nonexist");
          o.text(o.text()+" #"+data);
        }
      }).
    fail(function(err, status){
      o.addClass("nonexist");
      o.text(o.text() + " http get fail1 "+status);
    });
  })
}
