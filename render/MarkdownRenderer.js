import moment from "moment-timezone";
import _debug from "debug";
import config from "../config.js";
const debug = _debug("OSMBC:render:MarkdownRenderer");

import util from "../util/util.js";

import language from "../model/language.js";
import configModule from "../model/config.js";
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
    let blogRef = article.blog;
    if (!blogRef) blogRef = "undefined";
    const pageLink = util.linkify(blogRef + "_" + article.id);
    return `{{ < anchor "${pageLink}" > }} * ${this.renderMarkdownListItem(lang, article)}`;
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

  generateFrontText(lang) {

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
