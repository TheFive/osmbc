



import should from "should";
import async from "async";


import testutil from "./testutil.js";

import articleModule from "../model/article.js";
import blogModule from "../model/blog.js";
import { initialiseSlackReceiver } from "../notification/slackReceiver.js";
import configModule from "../model/config.js";



import nock from "nock";




function checkPostJson(check) {
  return function(result) {
    console.log("Check Called");
    should(result.body).eql(check);
    return true;
  };
}



describe("notification/slackReceiver", function() {
  beforeEach(function (bddone) {
    async.series([
      testutil.clearDB,
      configModule.initialise,
      initialiseSlackReceiver
    ], bddone);
  });
  afterEach(function(bddone) {
    nock.cleanAll();
    bddone();
  });
  describe("articles", function() {
    it("should slack message, when collecting article", function (bddone) {
      const slack = nock("https://hooks.slack.com")
        .post("/services/osmde",
          {
            text: "<http://localhost:35043/article/1|Test Title> added to <http://localhost:35043/blog/WN789|WN789>\n",
            username: "testbc(testuser)",
            icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcarticle"
          })
        .reply(200, "ok");
      articleModule.createNewArticle(function(err, article) {
        should.not.exist(err);
        article.setAndSave({ OSMUser: "testuser" }, { version: 1, blog: "WN789", collection: "newtext", title: "Test Title" }, function(err) {
          should.not.exist(err);
          should(slack.isDone()).is.True();
          bddone();
        });
      });
    });
    it("should slack message, when changing a collection (with <..> in Title)", function (bddone) {
      let slack = nock("https://hooks.slack.com")
        .post("/services/osmde",
          {
            text: "<http://localhost:35043/article/1|Test «..» «..» Title> added to <http://localhost:35043/blog/WN789|WN789>\n",
            username: "testbc(testuser)",
            icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcarticle"
          })
        .reply(200, "ok");
      articleModule.createNewArticle(function(err, article) {
        should.not.exist(err);
        article.setAndSave({ OSMUser: "testuser" }, { version: 1, blog: "WN789", collection: "newtext", title: "Test <..> <..> Title" }, function(err) {
          should.not.exist(err);
          should(slack.isDone()).is.True();
          slack = nock("https://hooks.slack.com")
            .post("/services/osmde", 
              {
                text: "<http://localhost:35043/article/1|Test «..» «..» Title> changed collection\n",
                username: "testbc(testuser)",
                icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
                channel: "#osmbcarticle"
              })
            .reply(200, "ok");
          article.setAndSave({ OSMUser: "testuser" }, { version: 2, collection: "New Text was to short" }, function(err) {
            should.not.exist(err);
            should(slack.isDone()).is.True();
            bddone();
          });
        });
      });
    });
    it("should slack message, when adding comment", function (bddone) {
      const slack = nock("https://hooks.slack.com")
        .post("/services/osmde", 
          {
            text: "<http://localhost:35043/article/1|Test Title> added comment:\nInformation for @User3",
            username: "testbc(testuser)",
            icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcarticle"
          })
        .reply(200, "ok");
      articleModule.createNewArticle({ blog: "WN789", title: "Test Title" }, function(err, article) {
        should.not.exist(err);
        article.addCommentFunction({ OSMUser: "testuser" }, "Information for @User3", function(err) {
          should.not.exist(err);
          should(slack.isDone()).is.True();
          bddone();
        });
      });
    });
    it("should slack message, when changing comment", function (bddone) {
      const slack = nock("https://hooks.slack.com")
        .post("/services/osmde",
          {
            text: "<http://localhost:35043/article/1|Test Title> added comment:\nInformation for @User3",
            username: "testbc(testuser)",
            icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcarticle"
          })
        .reply(200, "ok");
      articleModule.createNewArticle({ blog: "WN789", title: "Test Title" }, function(err, article) {
        should.not.exist(err);
        article.addCommentFunction({ OSMUser: "testuser" }, "Information for @User3", function(err) {
          should.not.exist(err);
          const slack2 = nock("https://hooks.slack.com")
            .post("/services/osmde", 
              {
                text: "<http://localhost:35043/article/1|Test Title> changed comment:\nInformation for all",
                username: "testbc(testuser)",
                icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
                channel: "#osmbcarticle"
              })
            .reply(200, "ok");
          article.editComment({ OSMUser: "testuser" }, 0, "Information for all", function(err) {
            should.not.exist(err);
            should(slack.isDone()).is.True();
            should(slack2.isDone()).is.True();
            bddone();
          });
        });
      });
    });
  });
  describe("blogs", function() {
    it("should slack message when creating a blog", function (bddone) {
      const slack1 = nock("https://hooks.slack.com")
        .post("/services/osmde", 
          {
            text: "<http://localhost:35043/blog/WN251|WN251> was created\n",
            username: "testbc(testuser)",
            icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      const slack2 = nock("https://hooks.slack.com")
        .post("/services/theweeklyosm", 
          {
            text: "<http://localhost:35043/blog/WN251|WN251> was created\n",
            username: "testbc(testuser)",
            icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      blogModule.createNewBlog({ OSMUser: "testuser" }, function(err) {
        should.not.exist(err);
        should(slack1.isDone()).is.True();
        should(slack2.isDone()).is.True();

        bddone();
      });
    });
    it("should slack message, when change blog status", function (bddone) {
      const slack1a = nock("https://hooks.slack.com")
        .post("/services/osmde", 
          {
            text: "<http://localhost:35043/blog/WN251|WN251> was created\n",
            username: "testbc(testuser)",
            icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      const slack1b = nock("https://hooks.slack.com")
        .post("/services/theweeklyosm", 
          {
            text: "<http://localhost:35043/blog/WN251|WN251> was created\n",
            username: "testbc(testuser)",
            icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      blogModule.createNewBlog({ OSMUser: "testuser" }, function(err, blog) {
        const slack2a = nock("https://hooks.slack.com")
          .post("/services/osmde", 
            {
              text: "<http://localhost:35043/blog/WN251|WN251> changed status to edit\n",
              username: "testbc(testuser)",
              icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
              channel: "#osmbcblog"
            })
          .reply(200, "ok");
        const slack2b = nock("https://hooks.slack.com")
          .post("/services/theweeklyosm", 
            {
              text: "<http://localhost:35043/blog/WN251|WN251> changed status to edit\n",
              username: "testbc(testuser)",
              icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
              channel: "#osmbcblog"
            })
          .reply(200, "ok");
        should.not.exist(err);
        blog.setAndSave({ OSMUser: "testuser" }, { status: "edit" }, function(err) {
          should.not.exist(err);
          should(slack1a.isDone()).is.True();
          should(slack1b.isDone()).is.True();
          should(slack2a.isDone()).is.True();
          should(slack2b.isDone()).is.True();


          bddone();
        });
      });
    });
    it("should slack message, when review status is set (no startreview)", function (bddone) {
      const slack1a = nock("https://hooks.slack.com")
        .post("/services/osmde", 
          {
            text: "<http://localhost:35043/blog/blog|blog> was created\n",
            username: "testbc(testuser)",
            icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      const slack1b = nock("https://hooks.slack.com")
        .post("/services/theweeklyosm", 
          {
            text: "<http://localhost:35043/blog/blog|blog> was created\n",
            username: "testbc(testuser)",
            icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      blogModule.createNewBlog({ OSMUser: "testuser" }, { name: "blog", status: "edit" }, function(err, blog) {
        const slack2a = nock("https://hooks.slack.com")
          .post("/services/theweeklyosm", 
            {
              text: "<http://localhost:35043/blog/blog|blog>(ES) has been reviewed: I have reviewed (, )",
              username: "testbc(testuser)",
              icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
              channel: "#osmbcblog"
            })
          .reply(200, "ok");
        const slack2b = nock("https://hooks.slack.com")
          .post("/services/osmde", 
            {
              text: "<http://localhost:35043/blog/blog|blog>(ES) has been reviewed: I have reviewed ()",
              username: "testbc(testuser)",
              icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
              channel: "#osmbcblog"
            })
          .reply(200, "ok");
        should.not.exist(err);
        blog.setReviewComment("ES", { OSMUser: "testuser" }, "I have reviewed", function(err) {
          should.not.exist(err);
          should(slack1a.isDone()).is.True();
          should(slack1b.isDone()).is.True();
          should(slack2a.isDone()).is.True();
          should(slack2b.isDone()).is.False();
          nock.cleanAll();


          bddone();
        });
      });
    });
    it("should slack message, when review status is set (with startreview)", function (bddone) {
      const slack1a = nock("https://hooks.slack.com")
        .post("/services/osmde", 
          {
            text: "<http://localhost:35043/blog/blog|blog> was created\n",
            username: "testbc(testuser)",
            icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      const slack1b = nock("https://hooks.slack.com")
        .post("/services/theweeklyosm", 
          {
            text: "<http://localhost:35043/blog/blog|blog> was created\n",
            username: "testbc(testuser)",
            icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      blogModule.createNewBlog({ OSMUser: "testuser" }, { name: "blog", status: "edit", "reviewCommentPT-PT": [{ timestamp: "__timestamp__" }] }, function(err, blog) {
        const slack2a = nock("https://hooks.slack.com")
          .post("/services/theweeklyosm", 
            {
              text: "<http://localhost:35043/blog/blog|blog>(PT-PT) has been reviewed: I have reviewed (<http://localhost:35043/changes/log?blog=blog&table=article&property=markdownPT-PT&date=GE:__timestamp__&user=testuser|User Review>, <http://localhost:35043/changes/log?blog=blog&table=article&property=markdownPT-PT&date=GE:__timestamp__|Full Review>)",
              username: "testbc(testuser)",
              icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
              channel: "#osmbcblog"
            })
          .reply(200, "ok");
        const slack2b = nock("https://hooks.slack.com")
          .post("/services/osmde", 
            {
              text: "<http://localhost:35043/blog/blog|blog>(ES) has been reviewed: I have reviewed (<http://localhost:35043/changes/log?blog=blog&table=article&property=markdownES&date=GE:__timestamp__| view changes>)",
              username: "testbc(testuser)",
              icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
              channel: "#osmbcblog"
            })
          .reply(200, "ok");
        should.not.exist(err);
        blog.setReviewComment("PT-PT", { OSMUser: "testuser" }, "I have reviewed", function(err) {
          should.not.exist(err);
          should(slack1a.isDone()).is.True();
          should(slack1b.isDone()).is.True();
          should(slack2a.isDone()).is.True();
          should(slack2b.isDone()).is.False();
          nock.cleanAll();


          bddone();
        });
      });
    });
    it("should slack message, when review is marked as exported", function (bddone) {
      const slack1a = nock("https://hooks.slack.com")
        .post("/services/osmde", 
          {
            text: "<http://localhost:35043/blog/blog|blog> was created\n",
            username: "testbc(testuser)",
            icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      const slack1b = nock("https://hooks.slack.com")
        .post("/services/theweeklyosm", 
          {
            text: "<http://localhost:35043/blog/blog|blog> was created\n",
            username: "testbc(testuser)",
            icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      blogModule.createNewBlog({ OSMUser: "testuser" }, { name: "blog", status: "edit" }, function(err, blog) {
        const slack2a = nock("https://hooks.slack.com")
          .post("/services/osmde", 
            {
              text: "<http://localhost:35043/blog/blog|blog>(DE) is exported to WordPress",
              username: "testbc(testuser)",
              icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
              channel: "#osmbcblog"
            })
          .reply(200, "ok");
        const slack2b = nock("https://hooks.slack.com")
          .post("/services/theweeklyosm", 
            {
              text: "<http://localhost:35043/blog/blog|blog>(DE) is exported to WordPress",
              username: "testbc(testuser)",
              icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
              channel: "#osmbcblog"
            })
          .reply(200, "ok");
        should.not.exist(err);
        blog.setReviewComment("DE", { OSMUser: "testuser" }, "markexported", function(err) {
          should.not.exist(err);
          should(slack1a.isDone()).is.True();
          should(slack1b.isDone()).is.True();
          should(slack2a.isDone()).is.True();
          should(slack2b.isDone()).is.False();
          nock.cleanAll();


          bddone();
        });
      });
    });
    it("should slack message, when blog is closed", function (bddone) {
      const slack1a = nock("https://hooks.slack.com")
        .post("/services/osmde", 
          {
            text: "<http://localhost:35043/blog/blog|blog> was created\n",
            username: "testbc(testuser)",
            icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      const slack1b = nock("https://hooks.slack.com")
        .post("/services/theweeklyosm", 
          {
            text: "<http://localhost:35043/blog/blog|blog> was created\n",
            username: "testbc(testuser)",
            icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      blogModule.createNewBlog({ OSMUser: "testuser" }, { name: "blog", status: "edit" }, function(err, blog) {
        const slack2a = nock("https://hooks.slack.com")
          .post("/services/osmde", 
            {
              text: "<http://localhost:35043/blog/blog|blog>(PT-PT) has been closed",
              username: "testbc(testuser)",
              icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
              channel: "#osmbcblog"
            })
          .reply(200, "ok");
        const slack2b = nock("https://hooks.slack.com")
          .post("/services/theweeklyosm", 
            {
              text: "<http://localhost:35043/blog/blog|blog>(PT-PT) has been closed",
              username: "testbc(testuser)",
              icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
              channel: "#osmbcblog"
            })
          .reply(200, "ok");
        should.not.exist(err);
        blog.closeBlog({ lang: "PT-PT", user: { OSMUser: "testuser" }, status: true }, function(err) {
          should.not.exist(err);
          should(slack1a.isDone()).is.True();
          should(slack1b.isDone()).is.True();
          should(slack2a.isDone()).is.False();
          should(slack2b.isDone()).is.True();
          nock.cleanAll();

          bddone();
        });
      });
    });
    it("should slack message, when blog is reopened", function (bddone) {
      const slack1a = nock("https://hooks.slack.com")
        .post("/services/osmde", 
          {
            text: "<http://localhost:35043/blog/blog|blog> was created\n",
            username: "testbc(testuser)",
            icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      const slack1b = nock("https://hooks.slack.com")
        .post("/services/theweeklyosm", 
          {
            text: "<http://localhost:35043/blog/blog|blog> was created\n",
            username: "testbc(testuser)",
            icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      blogModule.createNewBlog({ OSMUser: "testuser" }, { name: "blog", status: "edit" }, function(err, blog) {
        const slack2a = nock("https://hooks.slack.com")
          .post("/services/osmde", 
            {
              text: "<http://localhost:35043/blog/blog|blog>(PT-PT) has been closed",
              username: "testbc(testuser)",
              icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
              channel: "#osmbcblog"
            })
          .reply(200, "ok");
        let slack2b = nock("https://hooks.slack.com")
          .post("/services/theweeklyosm", 
            {
              text: "<http://localhost:35043/blog/blog|blog>(PT-PT) has been closed",
              username: "testbc(testuser)",
              icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
              channel: "#osmbcblog"
            })
          .reply(200, "ok");
        should.not.exist(err);
        blog.closeBlog({ lang: "PT-PT", user: { OSMUser: "testuser" }, status: true }, function(err) {
          should.not.exist(err);
          should(slack1a.isDone()).is.True();
          should(slack1b.isDone()).is.True();
          should(slack2a.isDone()).is.False();
          should(slack2b.isDone()).is.True();
          slack2b = nock("https://hooks.slack.com")
            .post("/services/theweeklyosm", 
              {
                text: "<http://localhost:35043/blog/blog|blog>(PT-PT) has been reopened",
                username: "testbc(testuser)",
                icon_url: "http://localhost:35043/images/osmbc_im_logo.png",
                channel: "#osmbcblog"
              })
            .reply(200, "ok");
          blog.closeBlog({ lang: "PT-PT", user: { OSMUser: "testuser" }, status: false }, function(err) {
            should.not.exist(err);

            should(slack2b.isDone()).is.True();
            bddone();
          });
        });
      });
    });
  });
});
