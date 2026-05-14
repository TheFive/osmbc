import moment from "moment-timezone";
import _debug from "debug";
import config from "../config.js";
const debug = _debug("OSMBC:render:MarkdownRenderer");

import util from "../util/util.js";
import mdUtil from "../util/md_util.js";

import language from "../model/language.js";
import configModule from "../model/config.js";
import Renderer from "./Renderer.js";

class MarkdownRenderer extends Renderer {
  /**
   * Creates a new MarkdownRenderer instance.
   * @param {object} blog - The blog object to render.
   */
  constructor(blog) {
    super(blog);
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
    return "## " + category[lang];
  }

  /**
   * Renders a standard article as a Markdown anchor shortcode + list item.
   * @param {string} lang - The language code.
   * @param {object} article - The article object to render.
   * @returns {string} A Markdown list item with an anchor shortcode prefix.
   */
  _renderArticleStandard(lang, article) {
    let blogRef = article.blog;
    if (!blogRef) blogRef = "undefined";
    const pageLink = util.linkify(blogRef + "_" + article.id);
    return `{{ < anchor "${pageLink}" > }} * ${this._renderMarkdownListItem(lang, article)}`;
  }

  /**
   * Renders a picture article as a plain Markdown list item.
   * @param {string} lang - The language code.
   * @param {object} article - The article object to render.
   * @returns {string} A Markdown list item string.
   */
  _renderArticlePicture(lang, article) {
    return this._renderMarkdownListItem(lang, article);
  }

  /**
   * Renders an upcoming-events article as a plain Markdown list item.
   * @param {string} lang - The language code.
   * @param {object} article - The article object to render.
   * @returns {string} A Markdown list item string.
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
    const md = article["markdown" + lang];
    if (typeof (md) !== "undefined" && md !== "") {
      return md;
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
   * Generates the Hugo front matter block (TOML format) for the blog post.
   * Sets the draft status based on whether the blog is closed for the given language.
   * @param {string} lang - The language code used to check the blog's close status.
   * @returns {string} A TOML front matter block followed by two newlines.
   */
  _generateFrontText(lang) {

    const wpExpressTitle = config.getValue("Blog Title For Export", { mustExist: true });
    const categoryTranslation = configModule.getConfig("categorytranslation");

    const blogNames = (categoryTranslation.filter((category) => { return (category.EN === wpExpressTitle); }))[0];


    const date = moment(this.blog.startDate).tz("Europe/Berlin").format("YYYY-MM-DD");
    const text = [
      "+++",
      "date = " + date,
      "draft = " + (this.blog["close" + lang] ? "false" : "true"),
      "title = '" + blogNames[lang] + " " + this.blog.name.substring(2,10) + "'",
      // "featureImage = 'https://weeklyosm.eu/wp-content/uploads/2026/03/815.jpg'",
      // "featureImageCap = '[[^1^](#wn815_34170)] | [Podoma](https://wiki.openstreetmap.org/wiki/Podoma) in action in Italy  |   map data  &copy;  [OpenStreetMap Contributors](https://osmfoundation.org/wiki/Licence/Licence_and_Legal_FAQ).'",
      "+++"
    ].join("\n");

    return text + "\n\n";
  }
}

export default MarkdownRenderer;
