import moment from "moment-timezone";
import _debug from "debug";
const debug = _debug("OSMBC:render:MarkdownRenderer");

import mdUtil from "../util/md_util.js";

import language from "../model/language.js";
import Renderer from "./Renderer.js";

class MarkdownRenderer extends Renderer {
  /**
   * Creates a new MarkdownRenderer instance.
   * @param {object} blog - The blog object to render.
  * @param {object} [options] - Optional renderer options for API parity with other renderers.
  * Currently stored only and not evaluated by MarkdownRenderer behavior.
   */
  constructor(blog, options) {
    super(blog);
    this.options = options || {};
  }

  /**
   * Returns a formatted date-range string as the blog subtitle in Markdown.
   * @param {string} lang - The language code.
   * @returns {string} The locale-formatted date range followed by two newlines.
   */
  subtitle(lang) {
    debug("MarkdownRenderer.prototype.subtitle %s", lang);
    const blog = this.blog;
    if (blog.startDate && blog.endDate) {
      return moment(blog.startDate).tz("Europe/Berlin").locale(language.momentLocale(lang)).format("L") + "-" + moment(blog.endDate).tz("Europe/Berlin").locale(language.momentLocale(lang)).format("L") + "\n\n";
    } else return "missing date\n";
  }

  /**
   * Returns a plain-text warning line when the export contains empty articles.
   * @param {string} lang - The language code (unused, present for interface consistency).
   * @returns {string} A warning string followed by two newlines.
   */
  _containsEmptyArticlesWarning(lang) {
    debug("MarkdownRenderer.prototype.containsEmptyArticlesWarning %s", lang);
    return "Warning: This export contains empty Articles\n\n";
  }

  /**
   * Returns a Markdown `##` heading for the given category.
   * @param {string} lang - The language code.
   * @param {object} category - The category object with language keys.
   * @returns {string} A Markdown level-2 heading string.
   */
  categoryTitle(lang, category) {
    debug("MarkdownRenderer.prototype.categoryTitle");
    if (category.EN === "Picture") return "";
    return "## " + category[lang];
  }

  /**
   * Renders a standard article as a plain Markdown list item.
   * @param {string} lang - The language code.
   * @param {object} article - The article object to render.
   * @returns {string} A Markdown list item.
   */
  _renderArticleStandard(lang, article) {
    return `* ${this._renderMarkdownListItem(lang, article)}`;
  }

  /**
   * Renders a picture article as a plain Markdown list item.
   * @param {string} lang - The language code.
   * @param {object} article - The article object to render.
   * @returns {string} A Markdown list item string.
   */
  _renderArticlePicture(lang, article) {
    return `${this._renderMarkdownListItem(lang, article)}`;
  }

  /**
   * Renders an upcoming-events article as plain Markdown.
   * @param {string} lang - The language code.
   * @param {object} article - The article object to render.
   * @returns {string} A Markdown string.
   */
  _renderArticleUpcomingEvents(lang, article) {
    return this._renderMarkdownListItem(lang, article);
  }

  /**
   * Returns the raw Markdown content of an article for the given language,
   * falling back to the article's display title if no markdown is present.
   * @param {string} lang - The language code.
   * @param {object} article - The article object.
   * @returns {string} The markdown text or display title.
   */
  _renderMarkdownListItem(lang, article) {
    let md = article["markdown" + lang];
      if (typeof (md) !== "undefined" && md !== "") {
        // Keep nested lists valid by indenting leading bullet points.
        return md.replace(/^\*/gm, "  *");
    }
    return article.displayTitle(90) + "\n";
  }

  /**
   * Returns the article text unchanged for Markdown output
   * (unpublished reason is not appended in Markdown exports).
   * @param {string} text - The already-rendered article string.
   * @param {object} article - The article object (unused).
   * @returns {string} The unchanged article text.
   */
  _renderArticleUnpublished(text, article) {
    // Markdown: just return the text as-is, don't add unpublished reason
    return text;
  }

  /**
   * Returns a Markdown list item with the article's display title.
   * Called from views to render a single article title line.
   * @param {string} lang - The language code (unused, present for interface consistency).
   * @param {object} article - The article object.
   * @returns {string} A Markdown `* title` list item string.
   */
  articleTitle(lang, article) {
    debug("MarkdownRenderer.prototype.article");
    return "* " + article.displayTitle(999);
  }

  /**
   * Wraps a concatenated string of rendered articles with preceding newlines for Markdown.
   * @param {string} categoryString - The concatenated article markup.
   * @returns {string} Two newlines followed by the category string.
   */
  _listAroundArticles(categoryString) {
    return "\n\n" + categoryString;
  }

  /**
   * Returns an empty string — the team string is omitted in Markdown exports.
   * As currently HTML is used for templating team strings it must be
   * tuneddown into markdown.
   * @returns {string} An empty string.
   */
  _formatTeamString(teamstring) {
    const turndownService = mdUtil.turndownService();
    return turndownService.turndown(teamstring);
  }

  /**
   * Generates front text for plain Markdown output.
   * @param {string} lang - The language code.
   * @returns {string} Prefix text before content (empty in plain mode).
   */
  _generateFrontText(lang,pictureArticles) {
    return "";
  }
}

export default MarkdownRenderer;
