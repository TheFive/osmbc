"use strict";

var debug = require("debug")("OSMBC:render:BlogRenderer");
var moment = require("moment-timezone");

var util = require("../util/util.js");
var configModule = require("../model/config.js");
var config = require("../config.js");


var should = require("should");

var markdown = require("markdown-it")()
  .use(require("markdown-it-sup"))
  .use(require("markdown-it-imsize"), { autofill: true });

function HtmlRenderer(blog) {
  this.blog = blog;
}

function MarkdownRenderer(blog) {
  this.blog = blog;
}

HtmlRenderer.prototype.title = function htmlTitle(lang) {
  debug("HtmlRenderer.prototype.title %s", lang);
  return "<h1>" + this.blog.name + "</h1>\n";
};
MarkdownRenderer.prototype.title = function markdownTitle(lang) {
  debug("HtmlRenderer.prototype.title %s", lang);
  return "# " + this.blog.name + "n";
};

HtmlRenderer.prototype.subtitle = function htmlSubtitle(lang) {
  debug("HtmlRenderer.prototype.subtitle %s", lang);
  var blog = this.blog;
  should(config.getLanguages()).containEql(lang);
  if (blog.startDate && blog.endDate) {
    return "<p>" + moment(blog.startDate).tz("Europe/Berlin").locale(config.moment_locale(lang)).format("L") + "-" + moment(blog.endDate).tz("Europe/Berlin").locale(config.moment_locale(lang)).format("L") + "</p>\n";
  } else return "<p> missing date </p>\n";
};

MarkdownRenderer.prototype.subtitle = function markdownSubtitle(lang) {
  debug("MarkdownRenderer.prototype.subtitle %s", lang);
  var blog = this.blog;
  if (blog.startDate && blog.endDate) {
    return moment(blog.startDate).tz("Europe/Berlin").locale(config.moment_locale(lang)).format("L") + "-" + moment(blog.endDate).tz("Europe/Berlin").locale(config.moment_locale(lang)).format("L") + "\n\n";
  } else return "missing date\n";
};

HtmlRenderer.prototype.containsEmptyArticlesWarning = function htmlContainsEmptyArticlesWarning(lang) {
  debug("HtmlRenderer.prototype.containsEmptyArticlesWarning %s", lang);
  should(config.getLanguages()).containEql(lang);
  return "<p> Warning: This export contains empty Articles </p>\n";
};


MarkdownRenderer.prototype.containsEmptyArticlesWarning = function mdContainsEmptyArticlesWarning(lang) {
  debug("MarkdownRenderer.prototype.containsEmptyArticlesWarning %s", lang);
  return "Warning: This export contains empty Articles\n\n";
};

HtmlRenderer.prototype.categoryTitle = function htmlCatTitle(lang, category) {
  debug("HtmlRenderer.prototype.categoryTitle");
  if (category.EN === "Picture") return "<!--         place picture here              -->\n";
  return '<h2 id="' + util.linkify(this.blog.name + "_" + category[lang]) + '">' + category[lang] + "</h2>\n";
};
MarkdownRenderer.prototype.categoryTitle = function markdownCatTitle(lang, category) {
  debug("MarkdownRenderer.prototype.categoryTitle");
  return "## " + category[lang];
};

HtmlRenderer.prototype.renderArticle = function htmlArticle(lang, article) {
  debug("HtmlRenderer.prototype.article");

  var calendarTranslation = configModule.getConfig("calendartranslation");



  var md = article["markdown" + lang];


  var blogRef = article.blog;
  if (!blogRef) blogRef = "undefined";
  var titleRef = article.id;
  var pageLink = util.linkify(blogRef + "_" + titleRef);




  var liON = '<li id="' + pageLink + '">\n';
  var liOFF = "</li>\n";


  if (article.categoryEN === "Picture") {
    liON = '<div style="width: ##width##px" class="wp-caption alignnone"> \n';
    liOFF = "</div>\n";
  }
  if (article.categoryEN === "Upcoming Events") {
    liON = "<p>";
    liOFF = "</p>\n" + calendarTranslation.footer[lang];
  }
  if (article.categoryEN === "Long Term Dates") {
    liON = "<p>";
    liOFF = "</p>";
  }




  // Generate Text for display
  var text = "";

  if (typeof (md) !== "undefined" && md !== "") {
    // Does the markdown text starts with '* ', so ignore it
    if (md.substring(0, 2) === "* ") { md = md.substring(2, 99999); }
    // Return an list Element for the blog article
    text = markdown.render(md);



    if (article.categoryEN === "Picture") {
      if (liON.indexOf("##width##") >= 0) {
        // it is a picture, try to calculate the size.
        var width = parseInt(text.substring(text.indexOf('width="') + 7)) + 10;

        liON = liON.replace("##width##", width);
      }
      text = text.replace("<p>", '<p class="wp-caption-text">');
      text = text.replace("<p>", '<p class="wp-caption-text">');
    } else {
      // Not a picture remove <p> at start and end
      if (text.substring(0, 3) === "<p>" && text.substring(text.length - 5, text.length - 1) === "</p>") {
        text = text.substring(3, text.length - 5) + "\n";
      }
    }
  } else {
    text += article.displayTitle(90) + "\n";
  }
  if (article.categoryEN === "--unpublished--") {
    var reason2 = "No Reason given";
    if (article.unpublishReason) reason2 = article.unpublishReason;
    text += "<br>" + reason2;
    if (article.unpublishReference) text += " (" + article.unpublishReference + ")";
  }

  return liON + text + liOFF;
};

MarkdownRenderer.prototype.renderArticle = function markdownArticle(lang, article) {
  debug("MarkdownRenderer.prototype.article");
  return "* " + article["markdown" + lang];
};

HtmlRenderer.prototype.articleTitle = function htmlArticle(lang, article) {
  debug("HtmlRenderer.prototype.article");
  var text = article.displayTitle(999);
  if (article.categoryEN === "--unpublished--") {
    var reason2 = "No Reason given";
    if (article.unpublishReason) reason2 = article.unpublishReason;
    text += "<br>" + reason2;
    if (article.unpublishReference) text += " (" + article.unpublishReference + ")";
  }
  return "<li>" + text + "</li>\n";
};
MarkdownRenderer.prototype.articleTitle = function markdownArticle(lang, article) {
  debug("MarkdownRenderer.prototype.article");
  return "* " + article.displayTitle(999);
};

HtmlRenderer.prototype.renderBlog = function htmlBlog(lang, articleData) {
  debug("htmlBlog");

  var articles = articleData.articles;
  var teamString = articleData.teamString;
  var preview = "";
  var blog = this.blog;
  var i, j; // often used iterator, declared here because there is no block scope in JS.
  preview += this.subtitle(lang);
  var clist = blog.getCategories();

  if (articleData.containsEmptyArticlesWarning) {
    preview += this.containsEmptyArticlesWarning(lang);
  }


  // Generate the blog result along the categories
  for (i = 0; i < clist.length; i++) {
    var category = clist[i].EN;

    // ignore any "unpublished" category not in edit mode
    if (category === "--unpublished--") continue;


    // If the category exists, generate HTML for it
    if (typeof (articles[category]) !== "undefined") {
      debug("Generating HTML for category %s", category);
      var htmlForCategory = "";

      for (j = 0; j < articles[category].length; j++) {
        var row = articles[category][j];

        var articleMarkdown = this.renderArticle(lang, row);

        htmlForCategory += articleMarkdown;
      }
      var header = this.categoryTitle(lang, clist[i]);


      htmlForCategory = header + "<ul>\n" + htmlForCategory + "</ul>\n";


      preview += htmlForCategory;
      delete articles[category];
    }
  }

  delete articles["--unpublished--"];
  for (var k in articles) {
    preview += "<h2> Blog Missing Cat: " + k + "</h2>\n";
    preview += "<p> Please use [edit blog detail] to enter category</p>\n";
    preview += "<p> Or edit The Articles ";
    for (i = 0; i < articles[k].length; i++) {
      preview += ' <a href="' + config.htmlRoot() + "/article/" + articles[k][i].id + '">' + articles[k][i].id + "</a> ";
    }
    preview += "</p>\n";
  }


  return preview + teamString;
};


MarkdownRenderer.prototype.renderBlog = function markdownBlog(lang, articleData) {
  var articles = articleData.articles;
  var preview = "";
  var blog = this.blog;
  var i, j; // often used iterator, declared here because there is no block scope in JS.
  preview += this.subtitle(lang);
  var clist = blog.getCategories();


  // Generate the blog result along the categories
  for (i = 0; i < clist.length; i++) {
    var category = clist[i].EN;

    // ignore any "unpublished" category not in edit mode
    if (category === "--unpublished--") continue;


    // If the category exists, generate HTML for it
    if (typeof (articles[category]) !== "undefined") {
      debug("Generating HTML for category %s", category);
      var htmlForCategory = "";

      for (j = 0; j < articles[category].length; j++) {
        var row = articles[category][j];

        var articleMarkdown = this.renderArticle(lang, row);

        htmlForCategory += articleMarkdown + "\n\n";
      }
      var header = this.categoryTitle(lang, clist[i]);


      htmlForCategory = header + "\n\n" + htmlForCategory;


      preview += htmlForCategory;
      delete articles[category];
    }
  }



  return preview;
};

module.exports.MarkdownRenderer = MarkdownRenderer;
module.exports.HtmlRenderer = HtmlRenderer;
