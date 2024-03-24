import moment from "moment-timezone";

import util from "../util/util.js";
import configModule from "../model/config.js";
import config from "../config.js";
import language from "../model/language.js";
import { osmbcMarkdown } from "../util/md_util.js";


import { strict as assert } from "assert";

import _debug from "debug";
const debug = _debug("OSMBC:render:BlogRenderer");


class HtmlRenderer {
  constructor(blog, options) {
    this.blog = blog;

    this.markdown = osmbcMarkdown(options);
  }

  subtitle(lang) {
    debug("HtmlRenderer.prototype.subtitle %s", lang);
    const blog = this.blog;
    assert(language.getLanguages()[lang]);
    if (blog.startDate && blog.endDate) {
      return "<p>" + util.dateFormat(blog.startDate, lang) + "-" + util.dateFormat(blog.endDate, lang) + "</p>\n";
    } else return "<p> missing date </p>\n";
  }

  containsEmptyArticlesWarning(lang) {
    debug("HtmlRenderer.prototype.containsEmptyArticlesWarning %s", lang);
    assert(language.getLanguages()[lang]);
    return "<p> Warning: This export contains empty Articles </p>\n";
  }

  categoryTitle(lang, category) {
    debug("HtmlRenderer.prototype.categoryTitle");
    if (category.EN === "Picture") return "<!--         place picture here              -->\n";
    return '<h2 id="' + util.linkify(this.blog.name + "_" + category[lang]) + '">' + category[lang] + "</h2>\n";
  }

  renderArticle(lang, article) {
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
      text = this.markdown.render(md);



      if (article.categoryEN === "Picture") {
        if (liON.indexOf("##width##") >= 0) {
          // it is a picture, try to calculate the size.
          const width = parseInt(text.substring(text.indexOf('width="') + 7)) + 10;
          if (width > 0) {
            liON = liON.replace("##width##", width);
          } else {
            liON = '<div style="width: 800px" class="wp-caption alignnone"> \n';
            text = text.replace("></p>", ' width="800"></p>');
          }
        }
        text = text.replace('alt=""', 'alt="lead picture"');
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
  }

  articleTitle(lang, article) {
    debug("HtmlRenderer.prototype.article");
    let text = article.displayTitle(999);
    if (article.categoryEN === "--unpublished--") {
      let reason2 = "No Reason given";
      if (article.unpublishReason) reason2 = article.unpublishReason;
      text += "<br>" + reason2;
      if (article.unpublishReference) text += " (" + article.unpublishReference + ")";
    }
    return "<li>" + text + "</li>\n";
  }

  listAroundArticles(categoryString) {
    return "<ul>\n" + categoryString + "</ul>\n";
  }

  formatTeamString(teamString) {
    return teamString;
  }

  charSetString() {
    return "<meta charset=\"utf-8\"/>\n";
  }
}

class MarkdownRenderer {
  constructor(blog) {
    this.blog = blog;
  }

  subtitle(lang) {
    debug("MarkdownRenderer.prototype.subtitle %s", lang);
    const blog = this.blog;
    if (blog.startDate && blog.endDate) {
      return moment(blog.startDate).tz("Europe/Berlin").locale(language.momentLocale(lang)).format("L") + "-" + moment(blog.endDate).tz("Europe/Berlin").locale(language.momentLocale(lang)).format("L") + "\n\n";
    } else return "missing date\n";
  }

  containsEmptyArticlesWarning(lang) {
    debug("MarkdownRenderer.prototype.containsEmptyArticlesWarning %s", lang);
    return "Warning: This export contains empty Articles\n\n";
  }

  categoryTitle(lang, category) {
    debug("MarkdownRenderer.prototype.categoryTitle");
    return "## " + category[lang];
  }

  renderArticle(lang, article) {
    debug("MarkdownRenderer.prototype.article");
    return "* " + article["markdown" + lang];
  }

  articleTitle(lang, article) {
    debug("MarkdownRenderer.prototype.article");
    return "* " + article.displayTitle(999);
  }

  listAroundArticles(categoryString) {
    return "\n\n" + categoryString;
  }

  formatTeamString() {
    return "";
  }

  charSetString() {
    return "";
  }
}



















function renderBlogStructure(lang, articleData) {
  debug("htmlBlog");

  const articles = articleData.articles;
  const teamString = articleData.teamString;
  let preview = this.charSetString();
  const blog = this.blog;
  let i, j; // often used iterator, declared here because there was long time ago no block scope in JS.
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



const blogRenderer = {
  HtmlRenderer: HtmlRenderer,
  MarkdownRenderer: MarkdownRenderer
};

export default blogRenderer;
