import moment from "moment-timezone";
import _debug from "debug";
const debug = _debug("OSMBC:render:MarkdownRenderer");

import language from "../model/language.js";
import Renderer from "./Renderer.js";

class MarkdownRenderer extends Renderer {
  constructor(blog) {
    super(blog);
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

  renderArticleStandard(lang, article) {
    return "* " +this.renderMarkdownListItem(lang, article);
  }

  renderArticlePicture(lang, article) {
    return this.renderMarkdownListItem(lang, article);
  }

  renderArticleUpcomingEvents(lang, article) {
    return this.renderMarkdownListItem(lang, article);
  }

  renderMarkdownListItem(lang, article) {
    const md = article["markdown" + lang];
    if (typeof (md) !== "undefined" && md !== "") {
      return md;
    }
    return article.displayTitle(90) + "\n";
  }

  renderArticleUnpublished(text, article) {
    // Markdown: just return the text as-is, don't add unpublished reason
    return text;
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

export default MarkdownRenderer;
