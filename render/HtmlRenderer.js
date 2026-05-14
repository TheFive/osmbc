import _debug from "debug";
const debug = _debug("OSMBC:render:HtmlRenderer");

import util from "../util/util.js";
import configModule from "../model/config.js";
import language from "../model/language.js";
import { osmbcMarkdown } from "../util/md_util.js";
import { strict as assert } from "assert";

import Renderer from "./Renderer.js";

class HtmlRenderer extends Renderer {
  /**
   * Creates a new HtmlRenderer instance.
   * @param {object} blog - The blog object to render.
   * @param {object} [options] - Options passed to the markdown renderer.
   */
  constructor(blog, options) {
    super(blog);
    this.markdown = osmbcMarkdown(options);
  }

  /**
   * Returns an HTML date-range paragraph as the blog subtitle.
   * @param {string} lang - The language code.
   * @returns {string} An HTML `<p>` element with the formatted date range.
   */
  subtitle(lang) {
    debug("HtmlRenderer.prototype.subtitle %s", lang);
    const blog = this.blog;
    assert(language.getLanguages()[lang]);
    if (blog.startDate && blog.endDate) {
      return "<p>" + util.dateFormat(blog.startDate, lang) + "-" + util.dateFormat(blog.endDate, lang) + "</p>\n";
    } else return "<p> missing date </p>\n";
  }

  /**
   * Returns an HTML warning paragraph when the export contains empty articles.
   * @param {string} lang - The language code.
   * @returns {string} An HTML `<p>` warning element.
   */
  _containsEmptyArticlesWarning(lang) {
    debug("HtmlRenderer.prototype.containsEmptyArticlesWarning %s", lang);
    assert(language.getLanguages()[lang]);
    return "<p> Warning: This export contains empty Articles </p>\n";
  }

  /**
   * Returns an HTML `<h2>` heading for a category, or an HTML comment placeholder for "Picture".
   * @param {string} lang - The language code.
   * @param {object} category - The category object with language keys and an "EN" key.
   * @returns {string} The HTML category heading or picture placeholder comment.
   */
  categoryTitle(lang, category) {
    debug("HtmlRenderer.prototype.categoryTitle");
    if (category.EN === "Picture") return "<!--         Picture Cateogry              -->\n";
    return '<h2 id="' + util.linkify(this.blog.name + "_" + category[lang]) + '">' + category[lang] + "</h2>\n";
  }

  /**
   * Renders a standard article as an HTML `<li>` element with an anchor id.
   * @param {string} lang - The language code.
   * @param {object} article - The article object to render.
   * @returns {string} An HTML `<li>` element containing the rendered article body.
   */
  _renderArticleStandard(lang, article) {
    const text = this._renderHtmlBody(lang, article, false);

    let blogRef = article.blog;
    if (!blogRef) blogRef = "undefined";
    const pageLink = util.linkify(blogRef + "_" + article.id);
    return '<li id="' + pageLink + '">\n' + text + "</li>\n";
  }

  /**
   * Renders a picture article inside a WordPress-compatible caption `<div>`.
   * Attempts to read the image width from the rendered markup and sets a matching container width.
   * @param {string} lang - The language code.
   * @param {object} article - The article object to render.
   * @returns {string} An HTML `<div>` wrapping the picture with caption markup.
   */
  _renderArticlePicture(lang, article) {
    let text = this._renderHtmlBody(lang, article, true);
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

  /**
   * Renders an upcoming-events article as an HTML `<p>` element followed by the calendar footer.
   * @param {string} lang - The language code.
   * @param {object} article - The article object to render.
   * @returns {string} An HTML `<p>` element and the calendar translation footer.
   */
  _renderArticleUpcomingEvents(lang, article) {
    const calendarTranslation = configModule.getConfig("calendartranslation");
    const text = this._renderHtmlBody(lang, article, false);
    return "<p>" + text + "</p>\n" + calendarTranslation.footer[lang];
  }

  /**
   * Converts the article's markdown content for the given language to HTML.
   * Falls back to the article's display title if no markdown is present.
   * Optionally strips the outer `<p>` tags from the result.
   * @param {string} lang - The language code.
   * @param {object} article - The article object whose markdown is rendered.
   * @param {boolean} keepParagraphTags - If true, the wrapping `<p>` tags are preserved.
   * @returns {string} The rendered HTML string.
   */
  _renderHtmlBody(lang, article, keepParagraphTags) {
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

  /**
   * Inserts the unpublish reason and optional reference into an already-rendered `<li>` element.
   * @param {string} wrappedArticle - The already-rendered article HTML.
   * @param {object} article - The article object containing `unpublishReason` and `unpublishReference`.
   * @returns {string} The article HTML with the unpublish information appended inside the `<li>`.
   */
  _renderArticleUnpublished(wrappedArticle, article) {
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

  /**
   * Returns an HTML `<li>` element with the article's display title,
   * extended by unpublish reason and reference if applicable.
   * Called from views to render a single article title line.
   * @param {string} lang - The language code.
   * @param {object} article - The article object.
   * @returns {string} An HTML `<li>` element.
   */
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

  /**
   * Wraps a concatenated string of rendered articles in an HTML `<ul>` list.
   * @param {string} categoryString - The concatenated article markup.
   * @returns {string} The articles wrapped in `<ul>...</ul>`.
   */
  _listAroundArticles(categoryString) {
    return "<ul>\n" + categoryString + "</ul>\n";
  }

  /**
   * Returns the team string unchanged (HTML export does not transform the team string).
   * @param {string} teamString - The raw team string.
   * @returns {string} The unchanged team string.
   */
  _formatTeamString(teamString) {
    return teamString;
  }

  /**
   * Returns the HTML charset meta tag prepended to every HTML export.
   * @param {string} lang - The language code (unused, present for interface consistency).
   * @returns {string} An HTML `<meta charset="utf-8"/>` tag.
   */
  _generateFrontText(lang) {
    return "<meta charset=\"utf-8\"/>\n";
  }
}

export default HtmlRenderer;
