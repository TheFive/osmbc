import MarkdownRenderer from "./MarkdownRenderer.js";

// The current issue as context for a First Draft (model/firstDraft.js):
// Markdown with the category headings, the article being drafted replaced
// by a marker, articles without text by a placeholder with their title.
// Picture and Upcoming Events are left out by the caller (they say nothing
// about wording), the team string and the dates as well.

export const DRAFT_MARKER = "[[YOUR ITEM GOES HERE]]";
export const PLACEHOLDER_PREFIX = "[[ITEM STILL TO COME: ";

/** Renders an issue as context for a First Draft (see the comment above). */
class DraftContextRenderer extends MarkdownRenderer {
  /**
   * @param {object} blog the blog of the issue
   * @param {string|number|null} currentArticleId id of the article being
   *   drafted (gets the marker), null if it does not exist yet
   */
  constructor(blog, currentArticleId) {
    super(blog);
    this.currentArticleId = (currentArticleId === null || currentArticleId === undefined) ? null : String(currentArticleId);
    /** true after the marker was placed, false if the article is in no shown category */
    this.markerPlaced = false;
  }

  /**
   * Renders one item: the marker for the drafted article, a placeholder for
   * an article without text in the language, otherwise the text.
   * @param {string} lang language of the issue
   * @param {object} article article to render
   * @returns {string} Markdown list item
   */
  renderArticle(lang, article) {
    if (this.currentArticleId !== null && String(article.id) === this.currentArticleId) {
      this.markerPlaced = true;
      return "* " + DRAFT_MARKER;
    }
    const md = article["markdown" + lang];
    if (typeof md !== "string" || md.trim() === "") {
      return "* " + PLACEHOLDER_PREFIX + article.displayTitle(90) + "]]";
    }
    return super.renderArticle(lang, article);
  }

  /**
   * No dates: they say nothing about the wording.
   * @returns {string} empty string
   */
  subtitle() { return ""; }

  /**
   * No team string: it is not part of the items.
   * @returns {string} empty string
   */
  _formatTeamString() { return ""; }

  /**
   * A category that is not in the blog's list: rendered like any other.
   * @param {string} name category name
   * @param {object[]} articles its articles
   * @returns {string} Markdown heading and items
   */
  _renderMissingCategory(name, articles) {
    const lang = this._lang;
    return "\n\n## " + name + "\n\n" + articles.map((a) => this.renderArticle(lang, a)).join("\n\n");
  }

  /**
   * Renders the issue in one language.
   * @param {string} lang language of the issue
   * @param {object} articleData result of blog.getPreviewData
   * @returns {string} the issue as Markdown
   */
  renderBlog(lang, articleData) {
    this._lang = lang;
    return super.renderBlog(lang, articleData).trim();
  }
}

export default DraftContextRenderer;
