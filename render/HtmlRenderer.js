import _debug from "debug";
const debug = _debug("OSMBC:render:HtmlRenderer");

import util from "../util/util.js";
import configModule from "../model/config.js";
import language from "../model/language.js";
import { osmbcMarkdown } from "../util/md_util.js";
import { strict as assert } from "assert";

import Renderer from "./Renderer.js";

class HtmlRenderer extends Renderer {
  constructor(blog, options) {
    super(blog);
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

  renderArticleStandard(lang, article) {
    const text = this.renderHtmlBody(lang, article, false);

    let blogRef = article.blog;
    if (!blogRef) blogRef = "undefined";
    const pageLink = util.linkify(blogRef + "_" + article.id);
    return '<li id="' + pageLink + '">\n' + text + "</li>\n";
  }

  renderArticlePicture(lang, article) {
    let text = this.renderHtmlBody(lang, article, true);
    let openTag = '<div style="width: ##width##px" class="wp-caption alignnone"> \n';

    if (text.indexOf('width="') >= 0) {
      const width = parseInt(text.substring(text.indexOf('width="') + 7)) + 10;
      if (width > 0) {
        openTag = openTag.replace("##width##", width);
      } else {
        openTag = '<div style="width: 810px" class="wp-caption alignnone"> \n';
        text = text.replace("></p>", ' width="800" height="500"></p>');
      }
    } else {
      openTag = '<div style="width: 810px" class="wp-caption alignnone"> \n';
      text = text.replace("></p>", ' width="800" height="500"></p>');
    }

    text = text.replace('alt=""', 'alt="lead picture"');
    text = text.replace("<p>", '<p class="wp-caption-text">');
    text = text.replace("<p>", '<p class="wp-caption-text">');

    return openTag + text + "</div>\n";
  }

  renderArticleUpcomingEvents(lang, article) {
    const calendarTranslation = configModule.getConfig("calendartranslation");
    const text = this.renderHtmlBody(lang, article, false);
    return "<p>" + text + "</p>\n" + calendarTranslation.footer[lang];
  }

  renderHtmlBody(lang, article, keepParagraphTags) {
    const md = article["markdown" + lang];

    if (typeof (md) === "undefined" || md === "") {
      return article.displayTitle(90) + "\n";
    }

    let processedMd = md;
    if (processedMd.substring(0, 2) === "* ") {
      processedMd = processedMd.substring(2, 99999);
    }

    let text = this.markdown.render(processedMd);
    if (!keepParagraphTags) {
      if (text.substring(0, 3) === "<p>" && text.substring(text.length - 5, text.length - 1) === "</p>") {
        text = text.substring(3, text.length - 5) + "\n";
      }
    }
    return text;
  }

  renderArticleUnpublished(wrappedArticle, article) {
    let reason = "No Reason given";
    if (article.unpublishReason) reason = article.unpublishReason;
    let addition = "<br>" + reason;
    if (article.unpublishReference) addition += " (" + article.unpublishReference + ")";
    // Insert before the closing </li>, not after it
    const closeTagIndex = wrappedArticle.lastIndexOf("</li>\n");
    if (closeTagIndex >= 0) {
      return wrappedArticle.substring(0, closeTagIndex) + addition + "\n</li>\n";
    }
    return wrappedArticle + addition;
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

export default HtmlRenderer;
