import _debug from "debug";
import moment from "moment-timezone";
import MarkdownRenderer from "./MarkdownRenderer.js";
import util from "../util/util.js";
import config from "../config.js";
import configModule from "../model/config.js";
import { turndownService , osmbcMarkdown } from "../util/md_util.js";

const debug = _debug("OSMBC:render:HugoMarkdownRenderer");

class HugoMarkdownRenderer extends MarkdownRenderer {
  /**
   * Creates a new HugoMarkdownRenderer instance.
   * Current implementation delegates all behavior to MarkdownRenderer.
   * @param {object} blog - The blog object to render.
  * @param {object} [options] - Optional renderer options.
  * Currently accepted for API consistency and forwarded to MarkdownRenderer,
  * but not used by HugoMarkdownRenderer-specific behavior.
   */
  constructor(blog, options) {
    super(blog, options);
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
    let blogRef = article.blog;
    if (!blogRef) blogRef = "undefined";
    const pageLink = util.linkify(blogRef + "_" + article.id);

    const md = this._renderMarkdownListItem(lang, article);

    const html = osmbcMarkdown().render("* " +md);
    const hugoMd = turndownService({ hugo: true }).turndown(html);


    return `* {{< anchor "${pageLink}" >}} ${hugoMd.substring(2)}`;
  }

  _renderArticlePicture(lang, article) {
    return "";
  }

  _renderArticleUpcomingEvents(lang, article) {
    let md = super._renderArticleUpcomingEvents(lang, article);
    md = md.replaceAll("![flag](", "![](");
    return md;
  }

  _renderMarkdownListItem(lang, article) {
    return super._renderMarkdownListItem(lang, article).replaceAll("^1^", '{{< sup "1" >}}');
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
    const wpExpressTitle = config.getValue("Blog Title For Export", { mustExist: true });
    const categoryTranslation = configModule.getConfig("categorytranslation");

    const blogNames = (categoryTranslation.filter((category) => { return (category.EN === wpExpressTitle); }))[0];
    const date = moment(this.blog.startDate).tz("Europe/Berlin").format("YYYY-MM-DD");
    let pictureLink = null;
    let pictureMd = null;
    if (pictureArticles && pictureArticles.length > 0) {
      const pictureArticle = pictureArticles[0];
      const md = pictureArticle["markdown" + lang];
      const regexMarkdownImage = /!\[([^\]]*)\]\(([^)]+)\)/;
      const regexUrlFromCollection = /\b(https?:\/\/[^\[\]() \n\r]*)\b/g;
      pictureMd = (md) ? md.replaceAll("^1^", "1)") : null;
      if (pictureMd) {
        pictureMd = pictureMd.replace(/\s*=\d+\s*[xX]\s*\d+(?=\))/g, "");
        const imageMatch = regexMarkdownImage.exec(pictureMd);
        if (imageMatch && imageMatch.length >= 3) {
          pictureLink = imageMatch[2];
          pictureMd = pictureMd.replace(regexMarkdownImage, "").trim();
        } else {
          const link = regexUrlFromCollection.exec(pictureMd);
          if (link && link.length > 0) {
            pictureLink = link[0];
            pictureMd = pictureMd.replace(/!\[([^\]]*)\]\s*\(\s*[^)]*\)/g, "").trim();
            if (pictureMd.includes(link[0])) {
              pictureMd = pictureMd.replace(link[0], "").trim();
            }
          }
        }
      }
    }
    const escapedTitle = (blogNames[lang] + " " + this.blog.name.substring(2,10)).replaceAll("'", "''");
    const escapedPictureLink = pictureLink ? pictureLink.replaceAll("'", "''") : null;
    const escapedPictureMd = pictureMd ? pictureMd.replaceAll("'", "''") : null;

    const text = [
      "+++",
      "date = " + date,
      "draft = false",
      "title = '" + escapedTitle + "'",
      (escapedPictureLink) ? "featureImage = '" + escapedPictureLink + "'" : "",
      (escapedPictureMd) ? "featureImageCap = '" + escapedPictureMd + "'" : "",
      "+++"
    ].join("\n");

    return text + "\n\n";
  }

  _renderMissingCategory(name, articles) {
    return super._renderMissingCategory(name, articles);
  }

  renderBlog(lang, articleData, onlyClosed = false) {
    return super.renderBlog(lang, articleData, onlyClosed);
  }
}

export default HugoMarkdownRenderer;
