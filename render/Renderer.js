import _debug from "debug";
const debug = _debug("OSMBC:render:Renderer");

import config from "../config.js";


class Renderer {
  constructor(blog) {
    this.blog = blog;
  }

  subtitle(lang) {
    throw new Error("subtitle() must be implemented by subclass");
  }

  containsEmptyArticlesWarning(lang) {
    throw new Error("containsEmptyArticlesWarning() must be implemented by subclass");
  }

  categoryTitle(lang, category) {
    throw new Error("categoryTitle() must be implemented by subclass");
  }

  renderArticle(lang, article) {
    let renderedArticle;
    if (article.categoryEN === "Picture") {
      renderedArticle = this.renderArticlePicture(lang, article);
    } else if (article.categoryEN === "Upcoming Events") {
      renderedArticle = this.renderArticleUpcomingEvents(lang, article);
    } else {
      renderedArticle = this.renderArticleStandard(lang, article);
    }

    if (article.categoryEN === "--unpublished--") {
      renderedArticle = this.renderArticleUnpublished(renderedArticle, article);
    }

    return renderedArticle;
  }

  getArticleRenderCase(article) {
    if (article.categoryEN === "Picture") return "picture";
    if (article.categoryEN === "Upcoming Events") return "upcomingEvents";
    return "standard";
  }

  renderArticleStandard(lang, article) {
    throw new Error("renderArticleStandard() must be implemented by subclass");
  }

  renderArticlePicture(lang, article) {
    throw new Error("renderArticlePicture() must be implemented by subclass");
  }

  renderArticleUpcomingEvents(lang, article) {
    throw new Error("renderArticleUpcomingEvents() must be implemented by subclass");
  }

  renderArticleUnpublished(text, article) {
    throw new Error("renderArticleUnpublished() must be implemented by subclass");
  }

  articleTitle(lang, article) {
    throw new Error("articleTitle() must be implemented by subclass");
  }

  listAroundArticles(categoryString) {
    throw new Error("listAroundArticles() must be implemented by subclass");
  }

  formatTeamString(teamString) {
    throw new Error("formatTeamString() must be implemented by subclass");
  }

  generateFrontText(lang) {
    throw new Error("generateFrontText() must be implemented by subclass");
  }

  renderBlog(lang, articleData, onlyClosed = false) {
    debug("renderBlog");


    const articles = articleData.articles;
    const teamString = articleData.teamString;
    let preview = this.generateFrontText(lang);

    if (onlyClosed && !this.blog["close" + lang]) {
        return preview;
    }
    const blog = this.blog;
    let i, j;
    preview += this.subtitle(lang);
    const clist = blog.getCategories();



    if (articleData.containsEmptyArticlesWarning) {
      preview += this.containsEmptyArticlesWarning(lang);
    }

    // Generate the blog result along the categories
    for (i = 0; i < clist.length; i++) {
      const category = clist[i].EN;

      // ignore any "unpublished" category not in edit mode
      if (category === "--unpublished--") continue;

      // If the category exists, generate HTML for it
      if (typeof (articles[category]) !== "undefined") {
        debug("Generating HTML for category %s", category);
        let htmlForCategory = "";

        for (j = 0; j < articles[category].length; j++) {
          const row = articles[category][j];

          const articleMarkdown = this.renderArticle(lang, row);

          htmlForCategory += articleMarkdown + "\n\n";
        }
        const header = this.categoryTitle(lang, clist[i]);

        htmlForCategory = header + this.listAroundArticles(htmlForCategory);

        preview += htmlForCategory;
        delete articles[category];
      }
    }

    delete articles["--unpublished--"];
    for (const k in articles) {
      preview += "<h2> Blog Missing Cat: " + k + "</h2>\n";
      preview += "<p> Please use [edit blog detail] to enter category</p>\n";
      preview += "<p> Or edit The Articles ";
      for (i = 0; i < articles[k].length; i++) {
        preview += ' <a href="' + config.htmlRoot() + "/article/" + articles[k][i].id + '">' + articles[k][i].id + "</a> ";
      }
      preview += "</p>\n";
    }

    return preview + this.formatTeamString(teamString);
  }
}

export default Renderer;
