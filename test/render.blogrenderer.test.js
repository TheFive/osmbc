



import should from "should";
import testutil from "./testutil.js";

import path from "path";
import fs from "fs";
import async from "async";
import nock from "nock";

import articleModule from "../model/article.js";
import blogModule from "../model/blog.js";
import configModule from "../model/config.js";
import BlogRenderer from "../render/BlogRenderer.js";
import Renderer from "../render/Renderer.js";
import config from "../config.js";








describe("render/blogrenderer", function() {
  let renderer;
  before(async function () {
    await configModule.initialise();
    renderer = BlogRenderer.createRenderer("HTML");
    nock("https://missingmattermost.example.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");

    process.env.TZ = "Europe/Amsterdam";
    await testutil.clearDB();
  });
  after(function (bddone) {
    nock.cleanAll();
    bddone();
  });


  describe("htmlArticle", function() {
    it("should generate a preview when no markdown is specified (no Edit Link)", function (bddone) {
      const article = articleModule.create({ title: "Test Title" });
      const result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\nTest Title\n</li>\n');
      bddone();
    });
    it("should generate a preview when no markdown2 is specified (no Edit Link)", function (bddone) {
      const article = articleModule.create({ collection: "Test Collection" });
      const result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\nTest Collection\n</li>\n');
      bddone();
    });
    it("should generate a preview when no markdown2 is specified (Edit Link)", function (bddone) {
      const article = articleModule.create({ collection: "Test Collection" });
      const result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\nTest Collection\n</li>\n');
      bddone();
    });
    it("should generate a preview when markdown is specified (Edit Link) (editor mode)", function (bddone) {
      const renderer = BlogRenderer.createRenderer("HTML", null, { target: "editor" });
      const article = articleModule.create({ markdownDE: "[Paul](https://test.link.de) tells something about [nothing](www.nothing.de)." });
      const result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\n<a href="https://test.link.de" target="_blank" rel="noopener">Paul</a> tells something about <a href="www.nothing.de" target="_blank" rel="noopener">nothing</a>.\n</li>\n');
      bddone();
    });
    it("should generate a preview when markdown is specified (Edit Link) (production mode)", function (bddone) {
      const renderer = BlogRenderer.createRenderer("HTML", null, { target: "production" });
      const article = articleModule.create({ markdownDE: "[Paul](https://test.link.de) tells something about [nothing](www.nothing.de)." });
      const result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\n<a href="https://test.link.de" class="production">Paul</a> tells something about <a href="www.nothing.de" class="production">nothing</a>.\n</li>\n');
      bddone();
    });
    it("should generate a preview when markdown is specified (Translate Link Required)", function (bddone) {
      const article = articleModule.create({ markdownDE: "[Paul](https://test.link.de) tells something about [nothing](www.nothing.de)." });
      const result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\n<a href="https://test.link.de">Paul</a> tells something about <a href="www.nothing.de">nothing</a>.\n</li>\n');
      bddone();
    });
    it("should generate a preview when markdown is specified (with Star)", function (bddone) {
      const article = articleModule.create({ markdownDE: "* [Paul](https://test.link.de) tells something about [nothing](www.nothing.de)." });
      const result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\n<a href="https://test.link.de">Paul</a> tells something about <a href="www.nothing.de">nothing</a>.\n</li>\n');
      bddone();
    });
    it("should generate a preview with a comment and no status", function (bddone) {
      const article = articleModule.create({ markdownDE: "small markdown", commentList: [{ text: "Hallo" }], commentRead: { TheFive: 0 } });
      const result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\nsmall markdown\n</li>\n');
      bddone();
    });
    it("should generate a preview with a comment and open status", function (bddone) {
      const article = articleModule.create({ markdownDE: "small markdown", commentList: [{ text: "Hallo" }], commentStatus: "open", commentRead: { TheFive: 0 } });
      const result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\nsmall markdown\n</li>\n');
      bddone();
    });
    it("should generate a preview with a comment and open status checking Marktext", function (bddone) {
      const article = articleModule.create({ markdownDE: "small markdown", commentList: [{ text: "Hallo" }], commentStatus: "open" });
      const result = renderer.renderArticle("DE", article);
      should(result).equal('<li id=\"undefined_0\">\nsmall markdown\n</li>\n');
      bddone();
    });
    it("should generate a preview (no markdown) with a comment and open status", function (bddone) {
      const article = articleModule.create({ collection: "small collection", commentList: [{ text: "Hallo @EN" }], commentStatus: "open", commentRead: { TheFive: 0 } });
      const result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\nsmall collection\n</li>\n');
      bddone();
    });
    it("should generate a preview (no markdown) with a comment and open status case insensitive test", function (bddone) {
      const article = articleModule.create({ collection: "small collection", commentList: [{ text: "Hallo @en" }], commentStatus: "open", commentRead: { PaulFromMars: 0 } });
      const result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\nsmall collection\n</li>\n');
      bddone();
    });
    it("should generate a preview with a comment and open status and reference for all user", function (bddone) {
      const article = articleModule.create({ markdownDE: "small markdown", commentList: [{ text: "Hallo @all" }], commentStatus: "open", commentRead: { TheFive: 0 } });
      const result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\nsmall markdown\n</li>\n');
      bddone();
    });
    it("should generate a preview with a comment and open status and reference for a specific user", function (bddone) {
      const article = articleModule.create({ markdownDE: "small markdown", commentList: [{ text: "Hallo @user" }], commentStatus: "open" });
      const result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\nsmall markdown\n</li>\n');
      bddone();
    });
    it("should generate a preview with a comment and open status and reference for a specific language", function (bddone) {
      const article = articleModule.create({ markdownDE: "small markdown", commentList: [{ text: "simpel text" }, { text: "Hallo @DE" }, { text: "dudeldü" }], commentStatus: "open", commentRead: { user: 0 } });
      const result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\nsmall markdown\n</li>\n');
      bddone();
    });
    it("should generate a preview with a comment and solved status", function (bddone) {
      const article = articleModule.create({ markdownDE: "small markdown", commentList: [{ text: "solved" }], commentStatus: "solved" });
      const result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\nsmall markdown\n</li>\n');
      bddone();
    });
    it("should generate a preview Github Error #102 in german", function (bddone) {
      const article = articleModule.create({ markdownDE: "Howto place an issue in OSMBC? \n1. open OSMBC, \n1. click Collect,\n1. choose a category from the pop up window\n1. write a Titel: example: Lidar,\n1. write at text or put a link\n1. click OK\n--- reday --- \n\nIf you like to write the news directly, do as follows:\n\n1. click Edit\n2. write your news in English (you can see it in \n3. click OK and ...\n... that's it.", commentList: [{ text: "Hallo" }], commentStatus: "solved" });
      const result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\n<p>Howto place an issue in OSMBC?</p>\n<ol>\n<li>open OSMBC,</li>\n<li>click Collect,</li>\n<li>choose a category from the pop up window</li>\n<li>write a Titel: example: Lidar,</li>\n<li>write at text or put a link</li>\n<li>click OK\n--- reday ---</li>\n</ol>\n<p>If you like to write the news directly, do as follows:</p>\n<ol>\n<li>click Edit</li>\n<li>write your news in English (you can see it in</li>\n<li>click OK and ...\n... that\'s it.</li>\n</ol>\n</li>\n');
      bddone();
    });
    it("should generate a preview Github Error #102 in english", function (bddone) {
      const article = articleModule.create({ markdownEN: "Howto place an issue in OSMBC? \n1. open OSMBC, \n1. click Collect,\n1. choose a category from the pop up window\n1. write a Titel: example: Lidar,\n1. write at text or put a link\n1. click OK\n--- reday --- \n\nIf you like to write the news directly, do as follows:\n1. click Edit\n2. write your news in English (you can see it in \n3. click OK and ...\n... that's it.", commentList: [{ text: "Hallo" }], commentStatus: "solved" });
      const result = renderer.renderArticle("EN", article);
      should(result).equal('<li id="undefined_0">\n<p>Howto place an issue in OSMBC?</p>\n<ol>\n<li>open OSMBC,</li>\n<li>click Collect,</li>\n<li>choose a category from the pop up window</li>\n<li>write a Titel: example: Lidar,</li>\n<li>write at text or put a link</li>\n<li>click OK\n--- reday ---</li>\n</ol>\n<p>If you like to write the news directly, do as follows:</p>\n<ol>\n<li>click Edit</li>\n<li>write your news in English (you can see it in</li>\n<li>click OK and ...\n... that\'s it.</li>\n</ol>\n</li>\n');
      bddone();
    });
    it("should generate a preview for a picture", function (bddone) {
      const article = articleModule.create({
        markdownEN: "![Alternative Text](https://osmbc.com/picture.jpg =300x200)\n\nSome caption text allowing superscript [^[1]^](#WN271_wetterabhängige_Karte)",
        categoryEN: "Picture",
        commentList: [{ text: "Hallo" }],
        commentStatus: "solved"
      });
      const result = renderer.renderArticle("EN", article);
      should(result).equal('<div style="width: 310px" class="wp-caption alignnone"> \n<p class="wp-caption-text"><img src="https://osmbc.com/picture.jpg" alt="Alternative Text" width="300" height="200"></p>\n<p class="wp-caption-text">Some caption text allowing superscript <a href="#WN271_wetterabh%C3%A4ngige_Karte"><sup>[1]</sup></a></p>\n</div>\n');
      bddone();
    });
    it("should generate a preview for a translation", function (bddone) {
      const article = articleModule.create({
        markdownEN: "We will tell you something about maps.",
        markdownDE: "Wir erzählen euch was über Karten.",
        categoryEN: "Maps",
        commentList: [{ text: "Hallo" }],
        commentStatus: "solved"
      });
      const result = renderer.renderArticle("DE", article);
      should(result).equal('<li id=\"undefined_0\">\nWir erzählen euch was über Karten.\n</li>\n');
      bddone();
    });
    it("should generate an article for Upcoming Events", function (bddone) {
      const article = articleModule.create({
        markdownEN: "This is a table",
        markdownDE: "Eine Tabelle",
        categoryEN: "Upcoming Events"
      });
      const result = renderer.renderArticle("DE", article);
      should(result).equal('<p>Eine Tabelle\n</p>\n<p>Hinweis:<br />Wer seinen Termin hier in der Liste sehen möchte, <a href=\"https://wiki.openstreetmap.org/wiki/Template:Calendar\">trage</a> ihn in den <a href=\"https://wiki.openstreetmap.org/wiki/Current_events\">Kalender</a> ein. Nur Termine, die dort stehen, werden in die Wochennotiz übernommen.</p>\n');
      bddone();
    });
    it("should work with Emojies", function (bddone) {
      const article = articleModule.create({
        markdownEN: "Greetings from [:germany:](https://en.wikipedia.org/wiki/Germany) :-)",
        categoryEN: "Maps"
      });
      const result = renderer.renderArticle("EN", article);
      should(result).equal('<li id="undefined_0">\nGreetings from <a href="https://en.wikipedia.org/wiki/Germany"><img src=\"/localMediaFOlder2015/de-black.svg\" /></a> 😃\n</li>\n');
      bddone();
    });
    it("should handle unpublished picture article with reason", function (bddone) {
      const article = articleModule.create({
        markdownEN: "![Alt Text](https://example.com/pic.jpg =300x200)\n\nCaption",
        categoryEN: "Picture",
        unpublishReason: "Image rights unclear"
      });
      const origCat = article.categoryEN;
      article.categoryEN = "--unpublished--";
      const result = renderer.renderArticle("EN", article);
      // When unpublished, it renders as standard article (li) with unpublish reason
      should(result).match(/Image rights unclear/);
      should(result).match(/Caption/);
      bddone();
    });
    it("should handle unpublished upcoming events article", function (bddone) {
      const article = articleModule.create({
        markdownDE: "Event scheduled for later",
        categoryEN: "Upcoming Events",
        unpublishReason: "Date not confirmed",
        unpublishReference: "Issue #123"
      });
      article.categoryEN = "--unpublished--";
      const result = renderer.renderArticle("DE", article);
      should(result).match(/Date not confirmed/);
      should(result).match(/Issue #123/);
      bddone();
    });
  });

  describe("hugoMarkdownArticle", function() {
    let markdownRenderer;
    before(function() {
      markdownRenderer = BlogRenderer.createRenderer("HUGO");
    });

    it("should generate markdown for standard article", function (bddone) {
      const article = articleModule.create({ markdownDE: "Test article with content" });
      const result = markdownRenderer.renderArticle("DE", article);
      should(result).equal('* {{< anchor "undefined_0" >}} Test article with content');
      bddone();
    });

    it("should generate markdown for picture article", function (bddone) {
      const article = articleModule.create({
        markdownEN: "![Alt Text](https://example.com/img.jpg =300x200)\n\nCaption text",
        categoryEN: "Picture"
      });
      const result = markdownRenderer.renderArticle("EN", article);
      should(result).equal("");
      bddone();
    });

    it("should generate markdown for upcoming events", function (bddone) {
      const article = articleModule.create({
        markdownDE: "Event details in markdown",
        categoryEN: "Upcoming Events"
      });
      const result = markdownRenderer.renderArticle("DE", article);
      // Upcoming Events in Markdown don't get the "* " prefix like Standard
      should(result).equal("Event details in markdown");
      bddone();
    });

    it("should indent leading asterisk in article content", function (bddone) {
      const article = articleModule.create({
        markdownEN: "* Already has asterisk",
        id: 3,
        blog: "BLOG"
      });
      const result = markdownRenderer.renderArticle("EN", article);
      should(result).equal('* {{< anchor "blog_3" >}}   * Already has asterisk');
      bddone();
    });

    it("should indent all leading asterisks in multiline article content", function (bddone) {
      const article = articleModule.create({
        markdownDE: "* line one\n* line two\n* line three",
        id: 5,
        blog: "TEST"
      });
      const result = markdownRenderer.renderArticle("DE", article);
      should(result).equal('* {{< anchor "test_5" >}}   * line one\n  * line two\n  * line three');
      bddone();
    });

    it("should only indent asterisks at start of line, not mid-line", function (bddone) {
      const article = articleModule.create({
        markdownDE: "normal line\n* sub item\nnormal again",
        id: 6,
        blog: "TEST"
      });
      const result = markdownRenderer.renderArticle("DE", article);
      should(result).equal('* {{< anchor "test_6" >}} normal line\n  * sub item\nnormal again');
      bddone();
    });

    it("should fallback to title for markdown article with no markdown", function (bddone) {
      const article = articleModule.create({ collection: "Collection Title" ,id: 4, blog: "BLOG" });
      const result = markdownRenderer.renderArticle("DE", article);
      should(result).equal('* {{< anchor "blog_4" >}} Collection Title\n');
      bddone();
    });

    it("should generate markdown for unpublished article (no metadata added)", function (bddone) {
      const article = articleModule.create({
        markdownDE: "Content",
        categoryEN: "--unpublished--",
        unpublishReason: "Test reason"
      });
      const result = markdownRenderer.renderArticle("DE", article);
      // Unpublished renders via renderArticleStandard (not recognized as special category)
      // which adds "* ", then renderArticleUnpublished returns it unchanged
      should(result).equal('* {{< anchor "undefined_0" >}} Content');
      bddone();
    });
  });

  describe("markdownArticle", function() {
    let markdownRenderer;
    before(function() {
      markdownRenderer = BlogRenderer.createRenderer("MARKDOWN");
    });

    it("should generate markdown for standard article", function (bddone) {
      const article = articleModule.create({ markdownDE: "Test article with content" });
      const result = markdownRenderer.renderArticle("DE", article);
      should(result).equal("* Test article with content");
      bddone();
    });

    it("should generate markdown for picture article", function (bddone) {
      const article = articleModule.create({
        markdownEN: "![Alt Text](https://example.com/img.jpg =300x200)\n\nCaption text",
        categoryEN: "Picture"
      });
      const result = markdownRenderer.renderArticle("EN", article);
      should(result).equal("* ![Alt Text](https://example.com/img.jpg =300x200)\n\nCaption text");
      bddone();
    });

    it("should generate markdown for upcoming events", function (bddone) {
      const article = articleModule.create({
        markdownDE: "Event details in markdown",
        categoryEN: "Upcoming Events"
      });
      const result = markdownRenderer.renderArticle("DE", article);
      should(result).equal("Event details in markdown");
      bddone();
    });

    it("should indent leading asterisk in article content", function (bddone) {
      const article = articleModule.create({
        markdownEN: "* Already has asterisk",
        id: 3,
        blog: "BLOG"
      });
      const result = markdownRenderer.renderArticle("EN", article);
      should(result).equal("*   * Already has asterisk");
      bddone();
    });

    it("should indent all leading asterisks in multiline article content", function (bddone) {
      const article = articleModule.create({
        markdownDE: "* line one\n* line two\n* line three",
        id: 5,
        blog: "TEST"
      });
      const result = markdownRenderer.renderArticle("DE", article);
      should(result).equal("*   * line one\n  * line two\n  * line three");
      bddone();
    });

    it("should only indent asterisks at start of line, not mid-line", function (bddone) {
      const article = articleModule.create({
        markdownDE: "normal line\n* sub item\nnormal again",
        id: 6,
        blog: "TEST"
      });
      const result = markdownRenderer.renderArticle("DE", article);
      should(result).equal("* normal line\n  * sub item\nnormal again");
      bddone();
    });

    it("should fallback to title for markdown article with no markdown", function (bddone) {
      const article = articleModule.create({ collection: "Collection Title" ,id: 4, blog: "BLOG" });
      const result = markdownRenderer.renderArticle("DE", article);
      should(result).equal("* Collection Title\n");
      bddone();
    });

    it("should generate markdown for unpublished article (no metadata added)", function (bddone) {
      const article = articleModule.create({
        markdownDE: "Content",
        categoryEN: "--unpublished--",
        unpublishReason: "Test reason"
      });
      const result = markdownRenderer.renderArticle("DE", article);
      should(result).equal("* Content");
      bddone();
    });
  });

  describe("renderBlog", function() {
    beforeEach(function (bddone) {
      testutil.clearDB(bddone);
    });
    function doATest(filename) {
      it("should handle testfile " + filename, function (bddone) {
        const file =  path.resolve(config.getDirName(), "test/data", filename);
        const data =  JSON.parse(fs.readFileSync(file));

        let blog;
        let html;

        async.series([
          function(done) {
            testutil.importData(data, done);
          },
          function(done) {
            blogModule.findOne({ name: data.testBlogName }, function(err, result) {
              should.not.exist(err);
              blog = result;
              should.exist(blog);
              done();
            });
          },
          function(done) {
            let renderer = BlogRenderer.createRenderer("HTML", blog);
            if (data.asMarkdown) renderer = BlogRenderer.createRenderer("HUGO", blog);

            blog.getPreviewData({ lang: data.lang, createTeam: true, disableNotranslation: true }, function(err, result) {
              should.not.exist(err);

              html = renderer.renderBlog(data.lang, result);
              done();
            });
          }

        ],
        function (err) {
          should.not.exist(err);

          let htmlResult = data.testBlogResultHtml;
          let htmlFile = "";
          let markdown = false;

          try {
            // try to read file content,
            // if it fails, use the already defined value
            const file =  path.resolve(config.getDirName(), "test/data", htmlResult);
            htmlFile =htmlResult;

            htmlResult = fs.readFileSync(file, "utf-8");
            if (file.indexOf(".md") >= 0) markdown = true;
          } catch (err) { /* ignore the error */ }

          if (markdown) {
            testutil.expectTextFile(html,"data",htmlFile);
          } else {
            should(html).eql(htmlResult);
          }

          bddone();
        }
        );
      });
    }
    testutil.generateTests("test/data", /^render.blog.renderBlog.+json/, doATest);
  });

  describe("renderBlog warning integration", function() {
    function createBlog(closed = true) {
      return {
        name: "WN999",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-07"),
        closeDE: closed,
        getCategories() {
          return [{ EN: "News", DE: "News" }];
        }
      };
    }

    it("should include empty-article warning via renderBlog when articleData flag is set", function() {
      const htmlRenderer = BlogRenderer.createRenderer("HTML", createBlog(true));
      const article = articleModule.create({
        id: 1,
        blog: "WN999",
        categoryEN: "News",
        title: "Article without DE markdown",
        markdownEN: "Only EN text"
      });

      const articleData = {
        articles: { News: [article] },
        teamString: "",
        containsEmptyArticlesWarning: true
      };

      const result = htmlRenderer.renderBlog("DE", articleData);
      should(result).containEql("Warning: This export contains empty Articles");
      should(result).containEql("Article without DE markdown");
    });

    it("should not include empty-article warning via renderBlog when flag is false", function() {
      const htmlRenderer = BlogRenderer.createRenderer("HTML", createBlog(true));
      const article = articleModule.create({
        id: 2,
        blog: "WN999",
        categoryEN: "News",
        markdownDE: "Vorhandener deutscher Text"
      });

      const articleData = {
        articles: { News: [article] },
        teamString: "",
        containsEmptyArticlesWarning: false
      };

      const result = htmlRenderer.renderBlog("DE", articleData);
      should(result).not.containEql("Warning: This export contains empty Articles");
    });

    it("should return only front text for not-closed blog when onlyClosed is true", function() {
      const htmlRenderer = BlogRenderer.createRenderer("HTML", createBlog(false));
      const articleData = {
        articles: { News: [] },
        teamString: "",
        containsEmptyArticlesWarning: true
      };

      const result = htmlRenderer.renderBlog("DE", articleData, true);
      should(result).equal("<meta charset=\"utf-8\"/>\n");
    });
  });

  describe("articleTitle method integration", function() {
    let htmlRenderer;
    let markdownRenderer;

    before(async function() {
      await configModule.initialise();
      htmlRenderer = BlogRenderer.createRenderer("HTML");
      markdownRenderer = BlogRenderer.createRenderer("MARKDOWN");
    });

    it("should render HTML article title from collection when no markdown exists", function() {
      const article = articleModule.create({
        collection: "Test Article via Collection",
        id: 1,
        blog: "TEST"
      });
      const result = htmlRenderer.articleTitle("DE", article);
      should(result).containEql("Test Article via Collection");
      should(result).match(/<li>/);
      should(result).match(/<\/li>/);
    });

    it("should render Markdown article title correctly", function() {
      const article = articleModule.create({
        title: "Markdown Title",
        id: 2,
        blog: "TEST"
      });
      const result = markdownRenderer.articleTitle("EN", article);
      should(result).match(/^\* /);
      should(result).containEql("Markdown Title");
    });

    it("should handle unpublished article with reason in articleTitle", function() {
      const article = articleModule.create({
        title: "Unpublished Article",
        categoryEN: "--unpublished--",
        unpublishReason: "Not ready yet",
        unpublishReference: "PR #123"
      });
      const result = htmlRenderer.articleTitle("EN", article);
      should(result).containEql("Unpublished Article");
      should(result).containEql("Not ready yet");
      should(result).containEql("PR #123");
      should(result).match(/<br>/);
    });

    it("should render unpublished article title without reason gracefully", function() {
      const article = articleModule.create({
        title: "Unpublished No Reason",
        categoryEN: "--unpublished--"
      });
      const result = htmlRenderer.articleTitle("DE", article);
      should(result).containEql("Unpublished No Reason");
      should(result).containEql("No Reason given");
    });
  });

  describe("Renderer base class abstract methods", function() {
    let baseRenderer;

    before(function() {
      const blog = {
        name: "WN000",
        closeDE: true,
        getCategories() {
          return [];
        }
      };
      baseRenderer = new Renderer(blog);
    });

    it("should throw on subtitle()", function() {
      should.throws(() => baseRenderer.subtitle("DE"), /subtitle\(\) must be implemented by subclass/);
    });

    it("should throw on _containsEmptyArticlesWarning()", function() {
      should.throws(
        () => baseRenderer._containsEmptyArticlesWarning("DE"),
        /_containsEmptyArticlesWarning\(\) must be implemented by subclass/
      );
    });

    it("should throw on categoryTitle()", function() {
      should.throws(
        () => baseRenderer.categoryTitle("DE", { EN: "News", DE: "News" }),
        /categoryTitle\(\) must be implemented by subclass/
      );
    });

    it("should throw on _renderArticleStandard()", function() {
      should.throws(
        () => baseRenderer._renderArticleStandard("DE", articleModule.create({ markdownDE: "x" })),
        /_renderArticleStandard\(\) must be implemented by subclass/
      );
    });

    it("should throw on _renderArticlePicture()", function() {
      should.throws(
        () => baseRenderer._renderArticlePicture("DE", articleModule.create({ markdownDE: "x" })),
        /_renderArticlePicture\(\) must be implemented by subclass/
      );
    });

    it("should throw on _renderArticleUpcomingEvents()", function() {
      should.throws(
        () => baseRenderer._renderArticleUpcomingEvents("DE", articleModule.create({ markdownDE: "x" })),
        /_renderArticleUpcomingEvents\(\) must be implemented by subclass/
      );
    });

    it("should throw on _renderArticleUnpublished()", function() {
      should.throws(
        () => baseRenderer._renderArticleUnpublished("text", articleModule.create({ title: "x" })),
        /_renderArticleUnpublished\(\) must be implemented by subclass/
      );
    });

    it("should throw on articleTitle()", function() {
      should.throws(
        () => baseRenderer.articleTitle("DE", articleModule.create({ title: "x" })),
        /articleTitle\(\) must be implemented by subclass/
      );
    });

    it("should throw on _listAroundArticles()", function() {
      should.throws(
        () => baseRenderer._listAroundArticles("content"),
        /_listAroundArticles\(\) must be implemented by subclass/
      );
    });

    it("should throw on _formatTeamString()", function() {
      should.throws(
        () => baseRenderer._formatTeamString("team"),
        /_formatTeamString\(\) must be implemented by subclass/
      );
    });

    it("should throw on _generateFrontText()", function() {
      should.throws(
        () => baseRenderer._generateFrontText("DE"),
        /_generateFrontText\(\) must be implemented by subclass/
      );
    });
  });

  describe("BlogRenderer factory", function() {
    it("should map renderer type names case-insensitively", function() {
      const htmlRenderer = BlogRenderer.createRenderer("hTmL");
      const mdRenderer = BlogRenderer.createRenderer("markdown");
      const hugoRenderer = BlogRenderer.createRenderer("HuGo");

      should(htmlRenderer).be.instanceOf(BlogRenderer.HtmlRenderer);
      should(mdRenderer).be.instanceOf(BlogRenderer.MarkdownRenderer);
      should(hugoRenderer).be.instanceOf(BlogRenderer.HugoMarkdownRenderer);
    });

    it("should map HUGOMARKDOWN alias", function() {
      const hugoRenderer = BlogRenderer.createRenderer("hugomarkdown");
      should(hugoRenderer).be.instanceOf(BlogRenderer.HugoMarkdownRenderer);
    });

    it("should throw on unknown renderer type", function() {
      should.throws(() => BlogRenderer.createRenderer("pdf"), /Unknown renderer type/);
    });
  });
});
