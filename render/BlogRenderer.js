"use strict";

const debug = require("debug")("OSMBC:render:BlogRenderer");
const moment = require("moment-timezone");

const util = require("../util/util.js");
const configModule = require("../model/config.js");
const config = require("../config.js");
const language = require("../model/language.js");


const assert = require("assert").strict;

const markdown = require("markdown-it")()
  .use(require('markdown-it-emoji'))
  .use(require("markdown-it-sup"))
  .use(require("markdown-it-imsize"), { autofill: true });

function HtmlRenderer(blog) {
  this.blog = blog;
}

function MarkdownRenderer(blog) {
  this.blog = blog;
}


HtmlRenderer.prototype.subtitle = function htmlSubtitle(lang) {
  debug("HtmlRenderer.prototype.subtitle %s", lang);
  const blog = this.blog;
  assert(language.getLanguages()[lang]);
  if (blog.startDate && blog.endDate) {
    return "<p>" + util.dateFormat(blog.startDate, lang) + "-" + util.dateFormat(blog.endDate, lang) + "</p>\n";
  } else return "<p> missing date </p>\n";
};

MarkdownRenderer.prototype.subtitle = function markdownSubtitle(lang) {
  debug("MarkdownRenderer.prototype.subtitle %s", lang);
  const blog = this.blog;
  if (blog.startDate && blog.endDate) {
    return moment(blog.startDate).tz("Europe/Berlin").locale(language.momentLocale(lang)).format("L") + "-" + moment(blog.endDate).tz("Europe/Berlin").locale(language.momentLocale(lang)).format("L") + "\n\n";
  } else return "missing date\n";
};

HtmlRenderer.prototype.containsEmptyArticlesWarning = function htmlContainsEmptyArticlesWarning(lang) {
  debug("HtmlRenderer.prototype.containsEmptyArticlesWarning %s", lang);
  assert(language.getLanguages()[lang]);
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

  const calendarTranslation = configModule.getConfig("calendartranslation");



  let md = article["markdown" + lang];


  let blogRef = article.blog;
  if (!blogRef) blogRef = "undefined";
  const titleRef = article.id;
  const pageLink = util.linkify(blogRef + "_" + titleRef);




  let liON = '<li id="' + pageLink + '">\n';
  let liOFF = "</li>\n";


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
  let text = "";

  if (typeof (md) !== "undefined" && md !== "") {
    // Does the markdown text starts with '* ', so ignore it
    if (md.substring(0, 2) === "* ") { md = md.substring(2, 99999); }
    // Return an list Element for the blog article
    text = markdown.render(md);



    if (article.categoryEN === "Picture") {
      if (liON.indexOf("##width##") >= 0) {
        // it is a picture, try to calculate the size.
        const width = parseInt(text.substring(text.indexOf('width="') + 7)) + 10;

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
    let reason2 = "No Reason given";
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
  let text = article.displayTitle(999);
  if (article.categoryEN === "--unpublished--") {
    let reason2 = "No Reason given";
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

HtmlRenderer.prototype.listAroundArticles = function listAround1(categoryString) {
  return "<ul>\n" + categoryString + "</ul>\n";
};

MarkdownRenderer.prototype.listAroundArticles = function listAround2(categoryString) {
  return "\n\n" + categoryString;
};

HtmlRenderer.prototype.formatTeamString = function formatTeamString1(teamString) {
  return teamString;
};

MarkdownRenderer.prototype.formatTeamString = function formatTeamString2() {
  return "";
};


HtmlRenderer.prototype.charSetString = function charSetString() {
  return "<meta charset=\"utf-8\"/>\n";
};

MarkdownRenderer.prototype.charSetString = function charSetString2() {
  return "";
};


function renderBlogStructure(lang, articleData) {
  /* jshint validthis: true */
  debug("htmlBlog");

  const articles = articleData.articles;
  const teamString = articleData.teamString;
  let preview = this.charSetString();
  const blog = this.blog;
  let i, j; // often used iterator, declared here because there is no block scope in JS.
  preview += this.subtitle(lang);
  const clist = blog.getCategories();

  if (articleData.containsEmptyArticlesWarning) {
    preview += this.containsEmptyArticlesWarning(lang);
  }


  // Generate the blog result along the categories
  for (i = 0; i < clist.length; i++) {
    const category = clist[i].EN;

    // ignore any "unpublished" category not in edit mode
    if (category === "--unpublished--") continue;


    // If the category exists, generate HTML for it
    if (typeof (articles[category]) !== "undefined") {
      debug("Generating HTML for category %s", category);
      let htmlForCategory = "";

      for (j = 0; j < articles[category].length; j++) {
        const row = articles[category][j];

        const articleMarkdown = this.renderArticle(lang, row);

        htmlForCategory += articleMarkdown + "\n\n";
      }
      const header = this.categoryTitle(lang, clist[i]);


      htmlForCategory = header + this.listAroundArticles(htmlForCategory);


      preview += htmlForCategory;
      delete articles[category];
    }
  }

  delete articles["--unpublished--"];
  for (const k in articles) {
    preview += "<h2> Blog Missing Cat: " + k + "</h2>\n";
    preview += "<p> Please use [edit blog detail] to enter category</p>\n";
    preview += "<p> Or edit The Articles ";
    for (i = 0; i < articles[k].length; i++) {
      preview += ' <a href="' + config.htmlRoot() + "/article/" + articles[k][i].id + '">' + articles[k][i].id + "</a> ";
    }
    preview += "</p>\n";
  }


  return preview + this.formatTeamString(teamString);
}

HtmlRenderer.prototype.renderBlog = renderBlogStructure;
MarkdownRenderer.prototype.renderBlog = renderBlogStructure;


module.exports.MarkdownRenderer = MarkdownRenderer;
module.exports.HtmlRenderer = HtmlRenderer;
