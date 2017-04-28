"use strict";



var should = require("should");
var testutil = require("./testutil.js");

var path = require("path");
var fs = require("fs");
var async = require("async");
var nock = require("nock");

var articleModule = require("../model/article.js");
var blogModule = require("../model/blog.js");
var BlogRenderer = require("../render/BlogRenderer.js");







describe("render/blogrenderer", function() {
  var renderer =  new BlogRenderer.HtmlRenderer();
  before(function (bddone) {
    nock("https://hooks.slack.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");

    process.env.TZ = "Europe/Amsterdam";
    testutil.clearDB(bddone);
  });
  after(function (bddone) {
    nock.cleanAll();
    bddone();
  });


  describe("htmlArticle", function() {
    it("should generate a preview when no markdown is specified (no Edit Link)", function (bddone) {
      var article = articleModule.create({title: "Test Title"});
      var result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\nTest Title\n</li>\n');
      bddone();
    });
    it("should generate a preview when no markdown2 is specified (no Edit Link)", function (bddone) {
      var article = articleModule.create({collection: "Test Collection"});
      var result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\nTest Collection\n</li>\n');
      bddone();
    });
    it("should generate a preview when no markdown2 is specified (Edit Link)", function (bddone) {
      var article = articleModule.create({collection: "Test Collection"});
      var result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\nTest Collection\n</li>\n');
      bddone();
    });
    it("should generate a preview when markdown is specified (Edit Link)", function (bddone) {
      var article = articleModule.create({markdownDE: "[Paul](https://test.link.de) tells something about [nothing](www.nothing.de)."});
      var result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\n<a href="https://test.link.de">Paul</a> tells something about <a href="www.nothing.de">nothing</a>.\n</li>\n');
      bddone();
    });
    it("should generate a preview when markdown is specified (Translate Link Required)", function (bddone) {
      var article = articleModule.create({markdownDE: "[Paul](https://test.link.de) tells something about [nothing](www.nothing.de)."});
      var result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\n<a href="https://test.link.de">Paul</a> tells something about <a href="www.nothing.de">nothing</a>.\n</li>\n');
      bddone();
    });
    it("should generate a preview when markdown is specified (with Star)", function (bddone) {
      var article = articleModule.create({markdownDE: "* [Paul](https://test.link.de) tells something about [nothing](www.nothing.de)."});
      var result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\n<a href="https://test.link.de">Paul</a> tells something about <a href="www.nothing.de">nothing</a>.\n</li>\n');
      bddone();
    });
    it("should generate a preview with a comment and no status", function (bddone) {
      var article = articleModule.create({markdownDE: "small markdown", commentList: [{text: "Hallo"}], commentRead: {TheFive: 0}});
      var result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\nsmall markdown\n</li>\n');
      bddone();
    });
    it("should generate a preview with a comment and open status", function (bddone) {
      var article = articleModule.create({markdownDE: "small markdown", commentList: [{text: "Hallo"}], commentStatus: "open", commentRead: {TheFive: 0}});
      var result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\nsmall markdown\n</li>\n');
      bddone();
    });
    it("should generate a preview with a comment and open status checking Marktext", function (bddone) {
      var article = articleModule.create({markdownDE: "small markdown", commentList: [{text: "Hallo"}], commentStatus: "open"});
      var result = renderer.renderArticle("DE", article);
      should(result).equal('<li id=\"undefined_0\">\nsmall markdown\n</li>\n');
      bddone();
    });
    it("should generate a preview (no markdown) with a comment and open status", function (bddone) {
      var article = articleModule.create({collection: "small collection", commentList: [{text: "Hallo @EN"}], commentStatus: "open", commentRead: {TheFive: 0}});
      var result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\nsmall collection\n</li>\n');
      bddone();
    });
    it("should generate a preview (no markdown) with a comment and open status case insensitive test", function (bddone) {
      var article = articleModule.create({collection: "small collection", commentList: [{text: "Hallo @en"}], commentStatus: "open", commentRead: {PaulFromMars: 0}});
      var result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\nsmall collection\n</li>\n');
      bddone();
    });
    it("should generate a preview with a comment and open status and reference for all user", function (bddone) {
      var article = articleModule.create({markdownDE: "small markdown", commentList: [{text: "Hallo @all"}], commentStatus: "open", commentRead: {TheFive: 0}});
      var result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\nsmall markdown\n</li>\n');
      bddone();
    });
    it("should generate a preview with a comment and open status and reference for a specific user", function (bddone) {
      var article = articleModule.create({markdownDE: "small markdown", commentList: [{text: "Hallo @user"}], commentStatus: "open"});
      var result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\nsmall markdown\n</li>\n');
      bddone();
    });
    it("should generate a preview with a comment and open status and reference for a specific language", function (bddone) {
      var article = articleModule.create({markdownDE: "small markdown", commentList: [{text: "simpel text"}, {text: "Hallo @DE"}, {text: "dudeldü"}], commentStatus: "open", commentRead: {user: 0}});
      var result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\nsmall markdown\n</li>\n');
      bddone();
    });
    it("should generate a preview with a comment and solved status", function (bddone) {
      var article = articleModule.create({markdownDE: "small markdown", commentList: [{text: "solved"}], commentStatus: "solved"});
      var result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\nsmall markdown\n</li>\n');
      bddone();
    });
    it("should generate a preview Github Error #102 in german", function (bddone) {
      var article = articleModule.create({markdownDE: "Howto place an issue in OSMBC? \n1. open OSMBC, \n1. click Collect,\n1. choose a category from the pop up window\n1. write a Titel: example: Lidar,\n1. write at text or put a link\n1. click OK\n--- reday --- \n\nIf you like to write the news directly, do as follows:\n\n1. click Edit\n2. write your news in English (you can see it in \n3. click OK and ...\n... that's it.", commentList: [{text: "Hallo"}], commentStatus: "solved"});
      var result = renderer.renderArticle("DE", article);
      should(result).equal('<li id="undefined_0">\n<p>Howto place an issue in OSMBC?</p>\n<ol>\n<li>open OSMBC,</li>\n<li>click Collect,</li>\n<li>choose a category from the pop up window</li>\n<li>write a Titel: example: Lidar,</li>\n<li>write at text or put a link</li>\n<li>click OK\n--- reday ---</li>\n</ol>\n<p>If you like to write the news directly, do as follows:</p>\n<ol>\n<li>click Edit</li>\n<li>write your news in English (you can see it in</li>\n<li>click OK and ...\n... that\'s it.</li>\n</ol>\n</li>\n');
      bddone();
    });
    it("should generate a preview Github Error #102 in english", function (bddone) {
      var article = articleModule.create({markdownEN: "Howto place an issue in OSMBC? \n1. open OSMBC, \n1. click Collect,\n1. choose a category from the pop up window\n1. write a Titel: example: Lidar,\n1. write at text or put a link\n1. click OK\n--- reday --- \n\nIf you like to write the news directly, do as follows:\n1. click Edit\n2. write your news in English (you can see it in \n3. click OK and ...\n... that's it.", commentList: [{text: "Hallo"}], commentStatus: "solved"});
      var result = renderer.renderArticle("EN", article);
      should(result).equal('<li id="undefined_0">\n<p>Howto place an issue in OSMBC?</p>\n<ol>\n<li>open OSMBC,</li>\n<li>click Collect,</li>\n<li>choose a category from the pop up window</li>\n<li>write a Titel: example: Lidar,</li>\n<li>write at text or put a link</li>\n<li>click OK\n--- reday ---</li>\n</ol>\n<p>If you like to write the news directly, do as follows:</p>\n<ol>\n<li>click Edit</li>\n<li>write your news in English (you can see it in</li>\n<li>click OK and ...\n... that\'s it.</li>\n</ol>\n</li>\n');
      bddone();
    });
    it("should generate a preview for a picture", function (bddone) {
      var article = articleModule.create({markdownEN: "![Alternative Text](https://osmbc.com/picture.jpg =300x200)\n\nSome caption text allowing superscript [^[1]^](#WN271_wetterabhängige_Karte)",
        categoryEN: "Picture",
        commentList: [{text: "Hallo"}],
        commentStatus: "solved"});
      var result = renderer.renderArticle("EN", article);
      should(result).equal('<div style="width: 310px" class="wp-caption alignnone"> \n<p class="wp-caption-text"><img src="https://osmbc.com/picture.jpg" alt="Alternative Text" width="300" height="200"></p>\n<p class="wp-caption-text">Some caption text allowing superscript <a href="#WN271_wetterabh%C3%A4ngige_Karte"><sup>[1]</sup></a></p>\n</div>\n');
      bddone();
    });
    it("should generate a preview for a translation", function (bddone) {
      var article = articleModule.create({markdownEN: "We will tell you something about maps.",
        markdownDE: "Wir erzählen euch was über Karten.",
        categoryEN: "Maps",
        commentList: [{text: "Hallo"}],
        commentStatus: "solved"});
      var result = renderer.renderArticle("DE", article);
      should(result).equal('<li id=\"undefined_0\">\nWir erzählen euch was über Karten.\n</li>\n');
      bddone();
    });
    it("should generate an article for Upcoming Events", function (bddone) {
      var article = articleModule.create({markdownEN: "This is a table",
        markdownDE: "Eine Tabelle",
        categoryEN: "Upcoming Events"});
      var result = renderer.renderArticle("DE", article);
      should(result).equal('<p>Eine Tabelle\n</p>\n<p>Hinweis:<br />Wer seinen Termin hier in der Liste sehen möchte, <a href=\"https://wiki.openstreetmap.org/wiki/Template:Calendar\">trage</a> ihn in den <a href=\"https://wiki.openstreetmap.org/wiki/Current_events\">Kalender</a> ein. Nur Termine, die dort stehen, werden in die Wochennotiz übernommen.</p>\n');
      bddone();
    });
    it("should generate an article for Long Term Dates", function (bddone) {
      var article = articleModule.create({markdownEN: "This is a table",
        markdownDE: "Eine Tabelle",
        categoryEN: "Long Term Dates"});
      var result = renderer.renderArticle("DE", article);
      should(result).equal("<p>Eine Tabelle\n</p>");
      bddone();
    });
  });

  describe("renderBlog", function() {
    beforeEach(function (bddone) {
      testutil.clearDB(bddone);
    });
    function doATest(filename) {
      it("should handle testfile " + filename, function (bddone) {
        var file =  path.resolve(__dirname, "data", filename);
        var data =  JSON.parse(fs.readFileSync(file));

        var blog;
        var html;

        async.series([
          function(done) {
            testutil.importData(data, done);
          },
          function(done) {
            blogModule.findOne({name: data.testBlogName}, function(err, result) {
              should.not.exist(err);
              blog = result;
              should.exist(blog);
              done();
            });
          },
          function(done) {
            let renderer = new BlogRenderer.HtmlRenderer(blog);
            if (data.asMarkdown) renderer = new BlogRenderer.MarkdownRenderer(blog);

            blog.getPreviewData({lang: data.lang, createTeam: true, disableNotranslation: true}, function(err, result) {
              should.not.exist(err);

              html = renderer.renderBlog(data.lang, result);
              done();
            });
          }

        ],
          function (err) {
            should.not.exist(err);

            var htmlResult = data.testBlogResultHtml;
            var markdown = false;

            try {
              // try to read file content,
              // if it fails, use the already defined value
              var file =  path.resolve(__dirname, "data", htmlResult);
              htmlResult = fs.readFileSync(file, "utf-8");
              if (file.indexOf(".md") >= 0) markdown = true;
            } catch (err) { /* ignore the error */ }

            if (markdown) {
              should(html).eql(htmlResult);
            } else {
              //should(html).eql(htmlResult);
              should(testutil.equalHtml(html, htmlResult)).be.True();
            }

            bddone();
          }
        );
      });
    }
    testutil.generateTests("data", /^render.blog.renderBlog.+json/, doATest);
  });
});
