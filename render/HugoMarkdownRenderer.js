import _debug from "debug";
import { readFileSync } from "fs";
import path from "path";
import moment from "moment-timezone";
import MarkdownRenderer from "./MarkdownRenderer.js";
import util from "../util/util.js";
import config from "../config.js";
import configModule from "../model/config.js";

const debug = _debug("OSMBC:render:HugoMarkdownRenderer");

const wpExpressTitle = config.getValue("Blog Title For Export", { mustExist: true });
const dateAdjust = Number(config.getValue("Hugo", "DateAdjust", { mustExist: true }));

// Old weeklyosm.eu (WordPress) permalinks were /<lang>/archives/<postId>; the
// default language English also answered without a prefix (/archives/<postId>).
// After the Hugo migration each issue's URL is derived from its number, so the
// old URLs are emitted as Hugo `aliases` in the front matter to keep external
// links working. data/slugalias.json (supplied by the WP admin) maps the WN
// number -> WP post id and only covers the weeklyosm.eu era (WN 219+). A WN
// that is missing here simply gets no alias.
let slugAliasMap = {};
try {
    slugAliasMap = JSON.parse(readFileSync(path.resolve(config.getDirName(), "data", "slugalias.json"), "UTF8"));
} catch (err) {
    debug("no usable data/slugalias.json: %s", err.message);
}

// ASCII -> Unicode superscript character, for places that can't use a Hugo
// shortcode (front matter TOML strings never run shortcodes - see
// _generateFrontText). Covers what the Unicode standard actually provides
// across the "Superscripts and Subscripts", "Phonetic Extensions" and
// "Spacing Modifier Letters" blocks: all 10 digits, lowercase a-z except
// "q" (no standard codepoint exists for it), and a few symbols. Uppercase
// has no standard superscript form of its own, so _replaceSuperscriptUnicode
// looks it up case-insensitively and falls back to the lowercase glyph
// (e.g. real content: Italian "^XII^" -> "ˣⁱⁱ") - a readable approximation
// rather than a distinct rendering. Any character still unmapped after that
// (e.g. the brackets in the "[^[1]^]" footnote variant) is left unchanged
// rather than dropped.
const SUPERSCRIPT_UNICODE_MAP = {
    0: "⁰",
    1: "¹",
    2: "²",
    3: "³",
    4: "⁴",
    5: "⁵",
    6: "⁶",
    7: "⁷",
    8: "⁸",
    9: "⁹",
    "+": "⁺",
    "-": "⁻",
    "=": "⁼",
    "(": "⁽",
    ")": "⁾",
    a: "ᵃ",
    b: "ᵇ",
    c: "ᶜ",
    d: "ᵈ",
    e: "ᵉ",
    f: "ᶠ",
    g: "ᵍ",
    h: "ʰ",
    i: "ⁱ",
    j: "ʲ",
    k: "ᵏ",
    l: "ˡ",
    m: "ᵐ",
    n: "ⁿ",
    o: "ᵒ",
    p: "ᵖ",
    r: "ʳ",
    s: "ˢ",
    t: "ᵗ",
    u: "ᵘ",
    v: "ᵛ",
    w: "ʷ",
    x: "ˣ",
    y: "ʸ",
    z: "ᶻ",
};

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
        if (!markdown) return markdown;
        let result = markdown;

        // Get emoji configuration from languageflags
        const languageFlags = configModule.getConfig("languageflags");
        const shortcut = languageFlags.shortcut || {};
        const emoji = languageFlags.emoji || {};

        const toHugoEmoji = function (value) {
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
        let md = super._renderMarkdownListItem(lang, article);
        md = this._replaceSuperscriptShortcode(md);
        // Transform emoji shortcuts to Hugo icon shortcodes for markdown-level processing
        md = this._transformHugoMarkdown(md);
        return md;
    }

    /**
     * Converts inline "^text^" superscript markdown (used editorially for
     * footnote-style references like "^1^", ordinals like "1^er^"/"12^th^",
     * link-language markers like "^en^", and exponents like "km^2^") into a
     * Hugo "sup" shortcode. Hugo's own markdown engine (Goldmark) has no
     * native superscript syntax, so this must run as a text pre-processing
     * step before Hugo ever sees the markdown - only valid for regular
     * content, never for front matter (TOML strings never run shortcodes,
     * see _generateFrontText).
     * Delimiter matching mirrors util/markdown-it-sup.js: a "^", then one or
     * more characters that are neither whitespace nor "^", then the next
     * "^". Excluding "^" itself from the captured run is what keeps a
     * three-or-more-caret string ("^a^ ^b^") from being mis-paired across
     * the wrong two carets - the match always closes at the very next "^".
     * @param {string} text - Markdown text to transform
     * @returns {string} The transformed markdown
     */
    _replaceSuperscriptShortcode(text) {
        if (!text) return text;
        return text.replace(/\^([^\s^]+)\^/g, (_match, content) => {
            const escaped = content.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
            return `{{< sup "${escaped}" >}}`;
        });
    }

    /**
     * Same "^text^" delimiter matching as _replaceSuperscriptShortcode, but
     * resolves each character to its Unicode superscript equivalent
     * (SUPERSCRIPT_UNICODE_MAP) instead of a Hugo shortcode - for use inside
     * front matter (TOML strings), where shortcodes never run. A character
     * with no superscript equivalent (uppercase letters, brackets, ...) is
     * kept as-is rather than dropped.
     * @param {string} text - Markdown text to transform
     * @returns {string} The transformed text
     */
    _replaceSuperscriptUnicode(text) {
        if (!text) return text;
        return text.replace(/\^([^\s^]+)\^/g, (_match, content) => {
            return content.replace(/./g, (ch) => SUPERSCRIPT_UNICODE_MAP[ch.toLowerCase()] || ch);
        });
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

    /**
     * Hugo `aliases` for one issue: the old weeklyosm.eu WordPress
     * permalinks that must keep redirecting to this page.
     * @returns {string[]} Site-relative alias paths, or [] when the issue is not
     * in slugalias.json (pre-weeklyosm.eu era, or a non-WN blog).
     */
    _archiveAliases() {
        const match = /^WN0*(\d+)$/.exec((this.blog && this.blog.name) || "");
        if (!match) return [];
        const postId = slugAliasMap[match[1]];
        if (postId === undefined || postId === null) return [];
        const aliases = "/archives/" + postId;
        return aliases;
    }

    _generateFrontText(lang, pictureArticles) {
        // generate TOML header for Hugo front matter
        debug("HugoMarkdownRenderer.prototype._generateFrontText %s", lang);
        const categoryTranslation = configModule.getConfig("categorytranslation");

        const blogNames = categoryTranslation.filter((category) => {
            return category.EN === wpExpressTitle;
        })[0];
        const date = moment(this.blog.endDate).tz("Europe/Berlin").add(dateAdjust, "days").format("YYYY-MM-DD");
        let pictureLink = null;
        let pictureMd = null;
        if (pictureArticles && pictureArticles.length > 0) {
            const pictureArticle = pictureArticles[0];
            const rawMd = pictureArticle["markdown" + lang];
            const md = rawMd ? this._transformHugoMarkdown(rawMd) : null;

            const regexMarkdownImage = /!\[([^\]]*)\]\(([^)]+)\)/;
            const regexUrlFromCollection = /\b(https?:\/\/[^\[\]() \n\r]*)\b/g;
            // "^text^" superscript markup can't use a Hugo shortcode here (front
            // matter is raw TOML, never processed for shortcodes - unlike the
            // content body, see _replaceSuperscriptShortcode), so it's resolved
            // to plain Unicode superscript characters instead.
            pictureMd = this._replaceSuperscriptUnicode(md);
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
        const title = blogNames[lang] + " " + this.blog.name.substring(2, 10);
        const alias = this._archiveAliases();

        const text = [
            "+++",
            "date = " + date,
            "draft = false",
            "title = '''" + title + "'''",
            alias ? "aliases = ['" + alias + "']" : "",
            pictureLink ? "featureImage = '''" + pictureLink + "'''" : "",
            pictureMd ? "featureImageCap = '''" + pictureMd + "'''" : "",
            "+++",
        ]
            .filter((line) => {
                return line !== "";
            })
            .join("\n");

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
