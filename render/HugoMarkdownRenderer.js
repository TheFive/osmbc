import _debug from "debug";
import moment from "moment-timezone";
import MarkdownRenderer from "./MarkdownRenderer.js";
import util from "../util/util.js";
import config from "../config.js";
import configModule from "../model/config.js";

const debug = _debug("OSMBC:render:HugoMarkdownRenderer");

const wpExpressTitle = config.getValue("Blog Title For Export", { mustExist: true });
const dateAdjust = Number(config.getValue("Hugo", "DateAdjust", { mustExist: true }));


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

    return `* {{< anchor "${pageLink}" >}} ${md}`;
  }

  /**
   * Post-processes Hugo markdown to transform emoji shortcuts to Hugo icon shortcodes.
   * Used when markdown is already in text form (not converted via HTML/Turndown).
   * Semantik: Replaces markdown-level emoji shortcuts with Hugo icon shortcodes,
   * similar to how the HTML-level emoji plugin works.
   * @param {string} markdown - The markdown text to transform
   * @returns {string} The transformed markdown
   */
  _transformHugoMarkdown(markdown) {
    let result = markdown;

    // Get emoji configuration from languageflags
    const languageFlags = configModule.getConfig("languageflags");
    const shortcut = languageFlags.shortcut || {};
    const emoji = languageFlags.emoji || {};

    const toHugoEmoji = function(value) {
      if (!value) return null;
      // markdown-it-emoji defs may return an <img ...> snippet; extract src.
      const imgMatch = String(value).match(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/i);
      const src = imgMatch && imgMatch[1] ? imgMatch[1] : null;
      const raw = src || String(value);

      // Treat path-like or URL-like values as Hugo icon shortcodes.
      if (raw.startsWith("/") || raw.startsWith("http://") || raw.startsWith("https://")) {
        return `{{< icon "${raw}" >}}`;
      }

      // Otherwise keep as plain markdown text so Hugo can render unicode emojis.
      return raw;
    };

    // Transform all configured emoji shortcuts.
    Object.entries(shortcut).forEach(([emojiName, shortcutString]) => {
      if (shortcutString && emoji[emojiName]) {
        const replacement = toHugoEmoji(emoji[emojiName]);
        if (replacement) {
          result = result.replaceAll(shortcutString, replacement);
        }
      }
    });

    // Also support :emoji_name: style from markdown-it-emoji semantics.
    Object.keys(emoji).forEach((emojiName) => {
      const replacement = toHugoEmoji(emoji[emojiName]);
      if (replacement) {
        result = result.replaceAll(`:${emojiName}:`, replacement);
      }
    });

    return result;
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
    let md = super._renderMarkdownListItem(lang, article).replaceAll("^1^", '{{< sup "1" >}}');
    // Transform emoji shortcuts to Hugo icon shortcodes for markdown-level processing
    md = this._transformHugoMarkdown(md);
    return md;
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
    // generate TOML header for Hugo front matter
    debug("HugoMarkdownRenderer.prototype._generateFrontText %s", lang);
    const categoryTranslation = configModule.getConfig("categorytranslation");

    const blogNames = (categoryTranslation.filter((category) => { return (category.EN === wpExpressTitle); }))[0];
    const date = moment(this.blog.endDate).tz("Europe/Berlin").add(dateAdjust, "days").format("YYYY-MM-DD");
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
    const title = (blogNames[lang] + " " + this.blog.name.substring(2,10));

    const text = [
      "+++",
      "date = " + date,
      "draft = false",
      "title = '''" + title + "'''",
      (pictureLink) ? "featureImage = '''" + pictureLink + "'''" : "",
      (pictureMd) ? "featureImageCap = '''" + pictureMd + "'''" : "",
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
