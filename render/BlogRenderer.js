"use strict";

var debug = require('debug')('OSMBC:render:BlogRenderer');
var moment = require('moment');
var util = require('../util.js');


function HtmlRenderer(blog) {
  this.blog = blog;
}

function MarkdownRenderer(blog) {
  this.blog = blog;
}

HtmlRenderer.prototype.title =function htmlTitle(lang) {
  debug("HtmlRenderer.prototype.title %s",lang);
  return "<h1>"+this.blog.name+"</h1>\n";
};
MarkdownRenderer.prototype.title = function markdownTitle(lang) {
  debug("HtmlRenderer.prototype.title %s",lang);
  return "# "+this.blog.name+"n";
};

HtmlRenderer.prototype.subtitle = function htmlSubtitle(lang) {
  debug("HtmlRenderer.prototype.subtitle %s",lang);
  var blog = this.blog;
  if (blog.startDate && blog.endDate) {
    return  "<p>"+moment(blog.startDate).locale(lang).format('L') +"-"+moment(blog.endDate).locale(lang).format('L') +'</p>\n';
  }
  else return "<p> missing date </p>\n";
};

MarkdownRenderer.prototype.subtitle = function markdownSubtitle(lang) {
  debug("HtmlRenderer.prototype.subtitle %s",lang);
  var blog = this.blog;
  if (blog.startDate && blog.endDate) {
    return  moment(blog.startDate).locale(lang).format('L') +"-"+moment(blog.endDate).locale(lang).format('L') +'\n\n';
  }
  else return "missing date\n";
};

HtmlRenderer.prototype.categoryTitle = function htmlCatTitle(lang,category) {
  debug('HtmlRenderer.prototype.categoryTitle');
  if (category.EN === "Picture") return "<!--         place picture here              -->\n" ;
  return '<h2 id="'+util.linkify(this.blog.name+'_'+category[lang])+'">'+category[lang]+'</h2>\n';
};
MarkdownRenderer.prototype.categoryTitle = function markdownCatTitle(lang,category) {
  debug('MarkdownRenderer.prototype.categoryTitle');
  return  "## "+category[lang];
};

HtmlRenderer.prototype.article = function htmlArticle(lang,article) {
  debug('HtmlRenderer.prototype.article');
  return article.getPreview(lang);
};
MarkdownRenderer.prototype.article = function markdownArticle(lang,article) {
  debug('MarkdownRenderer.prototype.article');
  return "* "+article["markdown"+lang];
};

HtmlRenderer.prototype.articleTitle = function htmlArticle(lang,article) {
  debug('HtmlRenderer.prototype.article');
  return "<li>"+article.displayTitle(999)+"</li>";
};
MarkdownRenderer.prototype.articleTitle = function markdownArticle(lang,article) {
  debug('MarkdownRenderer.prototype.article');
  return "* "+article.displayTitle(999);
};


module.exports.MarkdownRenderer = MarkdownRenderer;
module.exports.HtmlRenderer = HtmlRenderer;