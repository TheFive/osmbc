import _debug from "debug";
import MarkdownRenderer from "./MarkdownRenderer.js";

const debug = _debug("OSMBC:render:HugoMarkdownRenderer");

class HugoMarkdownRenderer extends MarkdownRenderer {
  /**
   * Creates a new HugoMarkdownRenderer instance.
   * Current implementation delegates all behavior to MarkdownRenderer.
   * @param {object} blog - The blog object to render.
   */
  constructor(blog) {
    super(blog);
  }

  subtitle(lang) {
    debug("HugoMarkdownRenderer.prototype.subtitle %s", lang);
    return super.subtitle(lang);
  }

  _containsEmptyArticlesWarning(lang) {
    debug("HugoMarkdownRenderer.prototype._containsEmptyArticlesWarning %s", lang);
    return super._containsEmptyArticlesWarning(lang);
  }

  categoryTitle(lang, category) {
    debug("HugoMarkdownRenderer.prototype.categoryTitle");
    return super.categoryTitle(lang, category);
  }

  _renderArticleStandard(lang, article) {
    return super._renderArticleStandard(lang, article);
  }

  _renderArticlePicture(lang, article) {
    return super._renderArticlePicture(lang, article);
  }

  _renderArticleUpcomingEvents(lang, article) {
    return super._renderArticleUpcomingEvents(lang, article);
  }

  _renderMarkdownListItem(lang, article) {
    return super._renderMarkdownListItem(lang, article);
  }

  _renderArticleUnpublished(text, article) {
    return super._renderArticleUnpublished(text, article);
  }

  articleTitle(lang, article) {
    debug("HugoMarkdownRenderer.prototype.articleTitle");
    return super.articleTitle(lang, article);
  }

  _listAroundArticles(categoryString) {
    return super._listAroundArticles(categoryString);
  }

  _formatTeamString(teamstring) {
    return super._formatTeamString(teamstring);
  }

  _generateFrontText(lang, pictureArticles) {
    return super._generateFrontText(lang, pictureArticles);
  }

  _renderMissingCategory(name, articles) {
    return super._renderMissingCategory(name, articles);
  }

  renderBlog(lang, articleData, onlyClosed = false) {
    return super.renderBlog(lang, articleData, onlyClosed);
  }
}

export default HugoMarkdownRenderer;
