import _debug from "debug";
const debug = _debug("OSMBC:render:Renderer");

import config from "../config.js";
import { NO_CATEGORY_YET, UNPUBLISHED } from "../model/specialCategories.js";


class Renderer {
  /**
   * Creates a new Renderer instance.
   * @param {object} blog - The blog object to render.
   */
  constructor(blog) {
    this.blog = blog;
  }

  /**
   * Returns the subtitle string for the blog in the given language.
   * Must be implemented by subclasses.
   * @param {string} lang - The language code (e.g. "DE", "EN").
   * @returns {string} The subtitle markup.
   */
  subtitle(lang) {
    throw new Error("subtitle() must be implemented by subclass");
  }

  /**
   * Returns a warning string when the export contains empty articles.
   * Must be implemented by subclasses.
   * @param {string} lang - The language code.
   * @returns {string} The warning markup.
   */
  _containsEmptyArticlesWarning(lang) {
    throw new Error("_containsEmptyArticlesWarning() must be implemented by subclass");
  }

  /**
   * Returns the rendered category title for a given category.
   * Must be implemented by subclasses.
   * @param {string} lang - The language code.
   * @param {object} category - The category object with language keys and an "EN" key.
   * @returns {string} The category title markup.
   */
  categoryTitle(lang, category) {
    throw new Error("categoryTitle() must be implemented by subclass");
  }

  /**
   * Renders a single article, delegating to the appropriate render method
   * based on the article's category. Also wraps unpublished articles.
   * This is the primary public entry point for rendering individual articles.
   * @param {string} lang - The language code.
   * @param {object} article - The article object to render.
   * @returns {string} The rendered article markup.
   */
  renderArticle(lang, article) {
    let renderedArticle;
    if (article.categoryEN === "Picture") {
      renderedArticle = this._renderArticlePicture(lang, article);
    } else if (article.categoryEN === "Upcoming Events") {
      renderedArticle = this._renderArticleUpcomingEvents(lang, article);
    } else {
      renderedArticle = this._renderArticleStandard(lang, article);
    }

    if (article.categoryEN === UNPUBLISHED) {
      renderedArticle = this._renderArticleUnpublished(renderedArticle, article);
    }

    return renderedArticle;
  }

  /**
   * Renders a standard article (not a picture or upcoming event).
   * Must be implemented by subclasses.
   * @param {string} lang - The language code.
   * @param {object} article - The article object to render.
   * @returns {string} The rendered article markup.
   */
  _renderArticleStandard(lang, article) {
    throw new Error("_renderArticleStandard() must be implemented by subclass");
  }

  /**
   * Renders a picture article.
   * Must be implemented by subclasses.
   * @param {string} lang - The language code.
   * @param {object} article - The article object to render.
   * @returns {string} The rendered picture markup.
   */
  _renderArticlePicture(lang, article) {
    throw new Error("_renderArticlePicture() must be implemented by subclass");
  }

  /**
   * Renders an upcoming-events article.
   * Must be implemented by subclasses.
   * @param {string} lang - The language code.
   * @param {object} article - The article object to render.
   * @returns {string} The rendered upcoming events markup.
   */
  _renderArticleUpcomingEvents(lang, article) {
    throw new Error("_renderArticleUpcomingEvents() must be implemented by subclass");
  }

  /**
   * Wraps an already-rendered article with unpublished metadata (reason, reference).
   * Must be implemented by subclasses.
   * @param {string} text - The already-rendered article string.
   * @param {object} article - The article object (used to read unpublish metadata).
   * @returns {string} The wrapped markup.
   */
  _renderArticleUnpublished(text, article) {
    throw new Error("_renderArticleUnpublished() must be implemented by subclass");
  }

  /**
   * Returns a rendered title line for a single article.
   * Called from views to render one article title entry.
   * Must be implemented by subclasses.
   * @param {string} lang - The language code.
   * @param {object} article - The article object.
   * @returns {string} The rendered article title markup.
   */
  articleTitle(lang, article) {
    throw new Error("articleTitle() must be implemented by subclass");
  }

  /**
   * Wraps a concatenated string of rendered articles with the appropriate list container.
   * Must be implemented by subclasses.
   * @param {string} categoryString - The concatenated article markup.
   * @returns {string} The wrapped list markup.
   */
  _listAroundArticles(categoryString) {
    throw new Error("_listAroundArticles() must be implemented by subclass");
  }

  /**
   * Formats the contributor team string for output.
   * Must be implemented by subclasses.
   * @param {string} teamString - The raw team string.
   * @returns {string} The formatted team string.
   */
  _formatTeamString(teamString) {
    throw new Error("_formatTeamString() must be implemented by subclass");
  }

  /**
   * Returns the front matter / preamble text prepended before the blog content.
   * Must be implemented by subclasses.
   * @param {string} lang - The language code.
   * @param {Array<object>} pictureArticles - The articles belonging to the "Picture" category.
   * @returns {string} The front text markup.
   */
  _generateFrontText(lang, pictureArticles) {
    throw new Error("_generateFrontText() must be implemented by subclass");
  }

  /**
   * Returns markup for a category that exists on articles but is not registered
   * in the blog's category list. Subclasses may override to produce format-specific output.
   * @param {string} name - The unregistered category name.
   * @param {Array<object>} articles - The articles belonging to the missing category.
   * @returns {string} The rendered warning markup for the missing category.
   */
  _renderMissingCategory(name, articles) {
    let result = "<h2> Blog Missing Cat: " + name + "</h2>\n";
    result += "<p> Please use [edit blog detail] to enter category</p>\n";
    result += "<p> Or edit The Articles ";
    for (let i = 0; i < articles.length; i++) {
      result += ' <a href="' + config.htmlRoot() + "/article/" + articles[i].id + '">' + articles[i].id + "</a> ";
    }
    result += "</p>\n";
    return result;
  }

  /**
   * Renders only the header of the issue (e.g. Hugo front matter with the
   * lead picture), no articles. Used for a language that is still open
   * when all languages are exported at once.
   * @param {string} lang - The language code.
   * @param {object} articleData - Result of `blog.getPreviewData` (only `articles.Picture` is read).
   * @returns {string} The header markup.
   */
  renderHeaderOnly(lang, articleData) {
    return this._generateFrontText(lang, articleData.articles.Picture || []);
  }

  /**
   * Renders the complete blog for the given language: header, the
   * categories in the blog's order, a warning for articles in categories
   * the blog does not list, and the team line. Does not change
   * `articleData`, so the same data can be rendered again.
   * @param {string} lang - The language code.
   * @param {object} articleData - Result of `blog.getPreviewData`: `articles` map, `teamString`, `containsEmptyArticlesWarning`.
   * @returns {string} The fully rendered blog markup.
   */
  renderBlog(lang, articleData) {
    debug("renderBlog");
    const articles = articleData.articles;
    let preview = this.renderHeaderOnly(lang, articleData) + this.subtitle(lang);
    if (articleData.containsEmptyArticlesWarning) {
      preview += this._containsEmptyArticlesWarning(lang);
    }

    // Unpublished and not yet categorised articles are not part of the
    // issue, also when a blog lists them as categories (real case: WN230).
    const done = new Set([UNPUBLISHED, NO_CATEGORY_YET]);
    for (const category of this.blog.getCategories()) {
      const name = category.EN;
      if (done.has(name) || articles[name] === undefined) continue;
      done.add(name);
      preview += this._renderCategory(lang, category, articles[name]);
    }
    for (const name of Object.keys(articles)) {
      if (!done.has(name)) preview += this._renderMissingCategory(name, articles[name]);
    }
    return preview + this._formatTeamString(articleData.teamString);
  }

  /**
   * Renders one category: its title and its articles as a list.
   * @param {string} lang - The language code.
   * @param {object} category - Category entry of the blog (`EN` plus translations).
   * @param {Array<object>} articles - The articles in this category.
   * @returns {string} The rendered category markup.
   */
  _renderCategory(lang, category, articles) {
    const body = articles.map((article) => this.renderArticle(lang, article) + "\n\n").join("");
    return this.categoryTitle(lang, category) + this._listAroundArticles(body);
  }
}

export default Renderer;
