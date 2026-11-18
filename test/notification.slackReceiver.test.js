



import should from "should";
import async from "async";
import sinon from "sinon";


import testutil from "./testutil.js";

import articleModule from "../model/article.js";
import blogModule from "../model/blog.js";
import { initialiseSlackReceiver, SlackReceiver } from "../notification/slackReceiver.js";
import config from "../config.js";
import configModule from "../model/config.js";
import userModule from "../model/user.js";
import { mailReceiverUpdateUser } from "../notification/mailReceiver.js";



import nock from "nock";

function waitForMocksToComplete(scopes, callback, timeoutMs = 5000) {
  const startTime = Date.now();
  function verifyPending() {
    const allMocksDone = scopes.every((scope) => scope.isDone());
    if (allMocksDone) return callback();
    if (Date.now() - startTime >= timeoutMs) {
      return callback(new Error("Timeout while waiting for Slack notifications: " + nock.pendingMocks().join(", ")));
    }
    setTimeout(verifyPending, 25);
  }
  verifyPending();
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
    sinon.restore();
    nock.cleanAll();
    bddone();
  });
  it("should not crash on a null channel or a null list entry in slacknotification config", function (bddone) {
    configModule.getConfigObject("slacknotification", function(err, cf) {
      should.not.exist(err);
      cf.setAndSave({ OSMUser: "TheFive" }, {
        version: cf.version,
        yaml: cf.yaml + "\n- slack: osmde\n  channel:\n\n- \n"
      }, function(err) {
        should.not.exist(err);
        bddone();
      });
    });
  });
  describe("articles", function() {
    it("should slack message, when collecting article", function (bddone) {
      const slack = nock("https://missingmattermost.example.com")
        .post("/services/osmde",
          {
            text: "<https://localhost:35043/article/1|Test with Pipe - Title> added to <https://localhost:35043/blog/WN789|WN789>\n",
            username: "testbc(testuser)",
            icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcarticle"
          })
        .reply(200, "ok");
      articleModule.createNewArticle(function(err, article) {
        should.not.exist(err);
        article.setAndSave({ OSMUser: "testuser" }, { version: 1, blog: "WN789", collection: "newtext", title: "Test with Pipe | Title" }, function(err) {
          should.not.exist(err);
          waitForMocksToComplete([slack], function(waitErr) {
            should.not.exist(waitErr);
            should(slack.isDone()).is.True();
            bddone();
          });
        });
      });
    });
    it("should slack message, when changing a collection (with <..> in Title)", function (bddone) {
      let slack = nock("https://missingmattermost.example.com")
        .post("/services/osmde",
          {
            text: "<https://localhost:35043/article/1|Test «..» «..» Title> added to <https://localhost:35043/blog/WN789|WN789>\n",
            username: "testbc(testuser)",
            icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcarticle"
          })
        .reply(200, "ok");
      articleModule.createNewArticle(function(err, article) {
        should.not.exist(err);
        article.setAndSave({ OSMUser: "testuser" }, { version: 1, blog: "WN789", collection: "newtext", title: "Test <..> <..> Title" }, function(err) {
          should.not.exist(err);
          waitForMocksToComplete([slack], function(waitErr) {
            should.not.exist(waitErr);
            should(slack.isDone()).is.True();
            slack = nock("https://missingmattermost.example.com")
              .post("/services/osmde",
                {
                  text: "<https://localhost:35043/article/1|Test «..» «..» Title> changed collection\n",
                  username: "testbc(testuser)",
                  icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
                  channel: "#osmbcarticle"
                })
              .reply(200, "ok");
            article.setAndSave({ OSMUser: "testuser" }, { version: 2, collection: "New Text was to short" }, function(err) {
              should.not.exist(err);
              waitForMocksToComplete([slack], function(waitErr2) {
                should.not.exist(waitErr2);
                should(slack.isDone()).is.True();
                bddone();
              });
            });
          });
        });
      });
    });
    it("should slack message, when adding comment", function (bddone) {
      const slack = nock("https://missingmattermost.example.com")
        .post("/services/osmde",
          {
            text: "<https://localhost:35043/article/1|Test Title> added comment:\nInformation for @User3",
            username: "testbc(testuser)",
            icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcarticle"
          })
        .reply(200, "ok");
      articleModule.createNewArticle({ blog: "WN789", title: "Test Title" }, function(err, article) {
        should.not.exist(err);
        article.addCommentFunction({ OSMUser: "testuser" }, "Information for @User3", function(err) {
          should.not.exist(err);
          waitForMocksToComplete([slack], function(waitErr) {
            should.not.exist(waitErr);
            should(slack.isDone()).is.True();
            bddone();
          });
        });
      });
    });
    it("should slack message, when changing comment", function (bddone) {
      const slack = nock("https://missingmattermost.example.com")
        .post("/services/osmde",
          {
            text: "<https://localhost:35043/article/1|Test Title> added comment:\nInformation for @User3",
            username: "testbc(testuser)",
            icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcarticle"
          })
        .reply(200, "ok");
      articleModule.createNewArticle({ blog: "WN789", title: "Test Title" }, function(err, article) {
        should.not.exist(err);
        article.addCommentFunction({ OSMUser: "testuser" }, "Information for @User3", function(err) {
          should.not.exist(err);
          const slack2 = nock("https://missingmattermost.example.com")
            .post("/services/osmde",
              {
                text: "<https://localhost:35043/article/1|Test Title> changed comment:\nInformation for all",
                username: "testbc(testuser)",
                icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
                channel: "#osmbcarticle"
              })
            .reply(200, "ok");
          article.editComment({ OSMUser: "testuser" }, 0, "Information for all", function(err) {
            should.not.exist(err);
            waitForMocksToComplete([slack, slack2], function(waitErr) {
              should.not.exist(waitErr);
              should(slack.isDone()).is.True();
              should(slack2.isDone()).is.True();
              bddone();
            });
          });
        });
      });
    });
  });
  describe("blogs", function() {
    it("should log compact slack errors", function() {
      const logger = sinon.stub(config.logger, "error");
      const receiver = new SlackReceiver("test", "osmde", "#osmbcblog");
      receiver.hook = "https://missingmattermost.example.com/services/blogKeyWeekly";
      receiver.slack = {
        send(_message, cb) {
          cb(null, {
            name: "AxiosError",
            message: "Request failed with status code 404",
            status: 404,
            response: { status: 404, statusText: "Not Found" },
            request: {
              nativeProtocols: { http: { STATUS_CODES: { 404: "Not Found" } } },
              _redirectable: {},
              _headerSent: true
            }
          });
        }
      };

      receiver.sendReviewStatus(
        { OSMUser: "testuser" },
        { name: "blog" },
        "ES",
        "I have reviewed",
        function(err) {
          should.not.exist(err);
        });

      logger.called.should.be.True();
      const logLines = logger.getCalls().map((call) => String(call.args[0]));
      const compactErrorLine = logLines.find((line) => line.includes('"status":404'));

      should.exist(compactErrorLine);
      compactErrorLine.should.not.match(/nativeProtocols|_redirectable|_headerSent|\[Circular\]/);
    });

    it("should not slack when an unrelated field changes (e.g. the exportedBy export marker)", function (bddone) {
      const receiver = new SlackReceiver("test", "osmde", "#osmbcblog");
      let sendCalled = false;
      receiver.slack = {
        send(_message, cb) {
          sendCalled = true;
          cb();
        }
      };
      receiver.updateBlog(
        { OSMUser: "testuser" },
        { name: "WN251", status: "edit" },
        { exportedBy: { HugoDownload: { DE: "2026-01-01T00:00:00.000Z" } } },
        function (err) {
          should.not.exist(err);
          should(sendCalled).be.False();
          bddone();
        });
    });

    it("should slack message when creating a blog", function (bddone) {
      const slack1 = nock("https://missingmattermost.example.com")
        .post("/services/osmde",
          {
            text: "<https://localhost:35043/blog/WN251|WN251> was created\n",
            username: "testbc(testuser)",
            icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      const slack2 = nock("https://missingmattermost.example.com")
        .post("/services/theweeklyosm",
          {
            text: "<https://localhost:35043/blog/WN251|WN251> was created\n",
            username: "testbc(testuser)",
            icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      blogModule.createNewBlog({ OSMUser: "testuser" }, function(err) {
        should.not.exist(err);
        waitForMocksToComplete([slack1, slack2], function(waitErr) {
          should.not.exist(waitErr);
          should(slack1.isDone()).is.True();
          should(slack2.isDone()).is.True();
          bddone();
        });
      });
    });
    it("should slack message, when change blog status", function (bddone) {
      const slack1a = nock("https://missingmattermost.example.com")
        .post("/services/osmde",
          {
            text: "<https://localhost:35043/blog/WN251|WN251> was created\n",
            username: "testbc(testuser)",
            icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      const slack1b = nock("https://missingmattermost.example.com")
        .post("/services/theweeklyosm",
          {
            text: "<https://localhost:35043/blog/WN251|WN251> was created\n",
            username: "testbc(testuser)",
            icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      blogModule.createNewBlog({ OSMUser: "testuser" }, function(err, blog) {
        const slack2a = nock("https://missingmattermost.example.com")
          .post("/services/osmde",
            {
              text: "<https://localhost:35043/blog/WN251|WN251> changed status to edit\n",
              username: "testbc(testuser)",
              icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
              channel: "#osmbcblog"
            })
          .reply(200, "ok");
        const slack2b = nock("https://missingmattermost.example.com")
          .post("/services/theweeklyosm",
            {
              text: "<https://localhost:35043/blog/WN251|WN251> changed status to edit\n",
              username: "testbc(testuser)",
              icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
              channel: "#osmbcblog"
            })
          .reply(200, "ok");
        should.not.exist(err);
        blog.setAndSave({ OSMUser: "testuser" }, { status: "edit" }, function(err) {
          should.not.exist(err);
          waitForMocksToComplete([slack1a, slack1b, slack2a, slack2b], function(waitErr) {
            should.not.exist(waitErr);
            should(slack1a.isDone()).is.True();
            should(slack1b.isDone()).is.True();
            should(slack2a.isDone()).is.True();
            should(slack2b.isDone()).is.True();
            bddone();
          });
        });
      });
    });
    it("should slack message, when review status is set (no startreview)", function (bddone) {
      const slack1a = nock("https://missingmattermost.example.com")
        .post("/services/osmde",
          {
            text: "<https://localhost:35043/blog/blog|blog> was created\n",
            username: "testbc(testuser)",
            icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      const slack1b = nock("https://missingmattermost.example.com")
        .post("/services/theweeklyosm",
          {
            text: "<https://localhost:35043/blog/blog|blog> was created\n",
            username: "testbc(testuser)",
            icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      blogModule.createNewBlog({ OSMUser: "testuser" }, { name: "blog", status: "edit" }, function(err, blog) {
        const slack2a = nock("https://missingmattermost.example.com")
          .post("/services/theweeklyosm",
            {
              text: "<https://localhost:35043/blog/blog|blog>(ES) has been reviewed: I have reviewed (, )",
              username: "testbc(testuser)",
              icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
              channel: "#osmbcblog"
            })
          .reply(200, "ok");
        const slack2b = nock("https://missingmattermost.example.com")
          .post("/services/osmde",
            {
              text: "<https://localhost:35043/blog/blog|blog>(ES) has been reviewed: I have reviewed ()",
              username: "testbc(testuser)",
              icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
              channel: "#osmbcblog"
            })
          .reply(200, "ok");
        should.not.exist(err);
        blog.setReviewComment("ES", { OSMUser: "testuser" }, "I have reviewed", function(err) {
          should.not.exist(err);
          waitForMocksToComplete([slack1a, slack1b, slack2a], function(waitErr) {
            should.not.exist(waitErr);
            should(slack1a.isDone()).is.True();
            should(slack1b.isDone()).is.True();
            should(slack2a.isDone()).is.True();
            should(slack2b.isDone()).is.False();
            nock.cleanAll();
            bddone();
          });
        });
      });
    });
    it("should slack message, when review status is set (with startreview)", function (bddone) {
      const slack1a = nock("https://missingmattermost.example.com")
        .post("/services/osmde",
          {
            text: "<https://localhost:35043/blog/blog|blog> was created\n",
            username: "testbc(testuser)",
            icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      const slack1b = nock("https://missingmattermost.example.com")
        .post("/services/theweeklyosm",
          {
            text: "<https://localhost:35043/blog/blog|blog> was created\n",
            username: "testbc(testuser)",
            icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      blogModule.createNewBlog({ OSMUser: "testuser" }, { name: "blog", status: "edit", "reviewCommentPT-PT": [{ timestamp: "__timestamp__" }] }, function(err, blog) {
        const slack2a = nock("https://missingmattermost.example.com")
          .post("/services/theweeklyosm",
            {
              text: "<https://localhost:35043/blog/blog|blog>(PT-PT) has been reviewed: I have reviewed (<https://localhost:35043/changes/log?blog=blog&table=article&property=markdownPT-PT&date=GE:__timestamp__&user=testuser|User Review>, <https://localhost:35043/changes/log?blog=blog&table=article&property=markdownPT-PT&date=GE:__timestamp__|Full Review>)",
              username: "testbc(testuser)",
              icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
              channel: "#osmbcblog"
            })
          .reply(200, "ok");
        const slack2b = nock("https://missingmattermost.example.com")
          .post("/services/osmde",
            {
              text: "<https://localhost:35043/blog/blog|blog>(ES) has been reviewed: I have reviewed (<https://localhost:35043/changes/log?blog=blog&table=article&property=markdownES&date=GE:__timestamp__| view changes>)",
              username: "testbc(testuser)",
              icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
              channel: "#osmbcblog"
            })
          .reply(200, "ok");
        should.not.exist(err);
        blog.setReviewComment("PT-PT", { OSMUser: "testuser" }, "I have reviewed", function(err) {
          should.not.exist(err);
          waitForMocksToComplete([slack1a, slack1b, slack2a], function(waitErr) {
            should.not.exist(waitErr);
            should(slack1a.isDone()).is.True();
            should(slack1b.isDone()).is.True();
            should(slack2a.isDone()).is.True();
            should(slack2b.isDone()).is.False();
            nock.cleanAll();
            bddone();
          });
        });
      });
    });
    it("should slack message, when review is marked as exported", function (bddone) {
      const slack1a = nock("https://missingmattermost.example.com")
        .post("/services/osmde",
          {
            text: "<https://localhost:35043/blog/blog|blog> was created\n",
            username: "testbc(testuser)",
            icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      const slack1b = nock("https://missingmattermost.example.com")
        .post("/services/theweeklyosm",
          {
            text: "<https://localhost:35043/blog/blog|blog> was created\n",
            username: "testbc(testuser)",
            icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      blogModule.createNewBlog({ OSMUser: "testuser" }, { name: "blog", status: "edit" }, function(err, blog) {
        const slack2a = nock("https://missingmattermost.example.com")
          .post("/services/osmde",
            {
              text: "<https://localhost:35043/blog/blog|blog>(DE) is exported to WordPress",
              username: "testbc(testuser)",
              icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
              channel: "#osmbcblog"
            })
          .reply(200, "ok");
        const slack2b = nock("https://missingmattermost.example.com")
          .post("/services/theweeklyosm",
            {
              text: "<https://localhost:35043/blog/blog|blog>(DE) is exported to WordPress",
              username: "testbc(testuser)",
              icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
              channel: "#osmbcblog"
            })
          .reply(200, "ok");
        should.not.exist(err);
        blog.setReviewComment("DE", { OSMUser: "testuser" }, "markexported", function(err) {
          should.not.exist(err);
          waitForMocksToComplete([slack1a, slack1b, slack2a], function(waitErr) {
            should.not.exist(waitErr);
            should(slack1a.isDone()).is.True();
            should(slack1b.isDone()).is.True();
            should(slack2a.isDone()).is.True();
            should(slack2b.isDone()).is.False();
            nock.cleanAll();
            bddone();
          });
        });
      });
    });
    it("should slack message, when blog is closed", function (bddone) {
      const slack1a = nock("https://missingmattermost.example.com")
        .post("/services/osmde",
          {
            text: "<https://localhost:35043/blog/blog|blog> was created\n",
            username: "testbc(testuser)",
            icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      const slack1b = nock("https://missingmattermost.example.com")
        .post("/services/theweeklyosm",
          {
            text: "<https://localhost:35043/blog/blog|blog> was created\n",
            username: "testbc(testuser)",
            icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      blogModule.createNewBlog({ OSMUser: "testuser" }, { name: "blog", status: "edit" }, true, function(err, blog) {
        const slack2a = nock("https://missingmattermost.example.com")
          .post("/services/osmde",
            {
              text: "<https://localhost:35043/blog/blog|blog>(PT-PT) has been closed",
              username: "testbc(testuser)",
              icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
              channel: "#osmbcblog"
            })
          .reply(200, "ok");
        const slack2b = nock("https://missingmattermost.example.com")
          .post("/services/theweeklyosm",
            {
              text: "<https://localhost:35043/blog/blog|blog>(PT-PT) has been closed",
              username: "testbc(testuser)",
              icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
              channel: "#osmbcblog"
            })
          .reply(200, "ok");
        should.not.exist(err);
        blog.closeBlog({ lang: "PT-PT", user: { OSMUser: "testuser" }, status: true }, function(err) {
          should.not.exist(err);
          waitForMocksToComplete([slack1a, slack1b, slack2b], function(waitErr) {
            should.not.exist(waitErr);
            should(slack1a.isDone()).is.True();
            should(slack1b.isDone()).is.True();
            should(slack2a.isDone()).is.False();
            should(slack2b.isDone()).is.True();
            nock.cleanAll();
            bddone();
          });
        });
      });
    });
    it("should slack message once, when Auto Close could not close a language (#1130)", function (bddone) {
      const created = ["osmde", "theweeklyosm"].map((service) => nock("https://missingmattermost.example.com")
        .post("/services/" + service, (body) => / was created/.test(body.text))
        .reply(200, "ok"));
      blogModule.createNewBlog({ OSMUser: "testuser" }, { name: "blog", status: "edit" }, true, function(err, blog) {
        should.not.exist(err);
        const text = "<https://localhost:35043/blog/blog|blog>(PT-PT) could not be closed automatically: 1 article is not written yet.";
        const blockedDE = nock("https://missingmattermost.example.com")
          .post("/services/osmde", (body) => body.text === text)
          .reply(200, "ok");
        let posts = 0;
        const blocked = nock("https://missingmattermost.example.com")
          .post("/services/theweeklyosm", (body) => {
            should(body).eql({
              text: text,
              username: "testbc(autoclose-review)",
              icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
              channel: "#osmbcblog"
            });
            posts += 1;
            return true;
          })
          .times(2)
          .reply(200, "ok");
        const actor = { OSMUser: "autoclose-review" };
        blog.reportCloseBlocked(actor, "PT-PT", ["1 article is not written yet."], function(err) {
          should.not.exist(err);
          should(blog.closeBlockedNotified["PT-PT"]).be.a.String();
          // a second report for the same language sends nothing
          blog.reportCloseBlocked(actor, "PT-PT", ["1 article is not written yet."], function(err) {
            should.not.exist(err);
            // the iterator posts after the callback: wait for the first post,
            // then a moment longer, so a second post would be counted
            const start = Date.now();
            (function waitForPost() {
              if (posts === 0 && Date.now() - start < 5000) return setTimeout(waitForPost, 20);
              setTimeout(checkPosts, 200);
            })();
            function checkPosts() {
              should(created.every((scope) => scope.isDone())).be.true();
              should(posts).eql(1);
              // osmde gets the close status of DE only, not PT-PT
              should(blockedDE.isDone()).is.False();
              nock.cleanAll();
              bddone();
            }
          });
        });
      });
    });
    it("should slack message, when blog is reopened", function (bddone) {
      const slack1a = nock("https://missingmattermost.example.com")
        .post("/services/osmde",
          {
            text: "<https://localhost:35043/blog/blog|blog> was created\n",
            username: "testbc(testuser)",
            icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      const slack1b = nock("https://missingmattermost.example.com")
        .post("/services/theweeklyosm",
          {
            text: "<https://localhost:35043/blog/blog|blog> was created\n",
            username: "testbc(testuser)",
            icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
            channel: "#osmbcblog"
          })
        .reply(200, "ok");
      blogModule.createNewBlog({ OSMUser: "testuser" }, { name: "blog", status: "edit" }, true, function(err, blog) {
        const slack2a = nock("https://missingmattermost.example.com")
          .post("/services/osmde",
            {
              text: "<https://localhost:35043/blog/blog|blog>(PT-PT) has been closed",
              username: "testbc(testuser)",
              icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
              channel: "#osmbcblog"
            })
          .reply(200, "ok");
        let slack2b = nock("https://missingmattermost.example.com")
          .post("/services/theweeklyosm",
            {
              text: "<https://localhost:35043/blog/blog|blog>(PT-PT) has been closed",
              username: "testbc(testuser)",
              icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
              channel: "#osmbcblog"
            })
          .reply(200, "ok");
        should.not.exist(err);
        blog.closeBlog({ lang: "PT-PT", user: { OSMUser: "testuser" }, status: true }, function(err) {
          should.not.exist(err);
          waitForMocksToComplete([slack1a, slack1b, slack2b], function(waitErr) {
            should.not.exist(waitErr);
            should(slack1a.isDone()).is.True();
            should(slack1b.isDone()).is.True();
            should(slack2a.isDone()).is.False();
            should(slack2b.isDone()).is.True();
            slack2b = nock("https://missingmattermost.example.com")
              .post("/services/theweeklyosm",
                {
                  text: "<https://localhost:35043/blog/blog|blog>(PT-PT) has been reopened",
                  username: "testbc(testuser)",
                  icon_url: "https://localhost:35043/images/osmbc_im_logo.png",
                  channel: "#osmbcblog"
                })
              .reply(200, "ok");
            blog.closeBlog({ lang: "PT-PT", user: { OSMUser: "testuser" }, status: false }, function(err) {
              should.not.exist(err);
              waitForMocksToComplete([slack2b], function(waitErr2) {
                should.not.exist(waitErr2);
                should(slack2b.isDone()).is.True();
                bddone();
              });
            });
          });
        });
      });
    });
  });
  describe("article notifications by kind (#1170)", function() {
    const editor = { OSMUser: "Editor", access: "full" };
    const guest = { OSMUser: "Visitor", access: "guest" };
    let posted;
    function captureAll() {
      posted = [];
      nock("https://missingmattermost.example.com")
        .post(/\/services\/.*/, function(body) { posted.push(body); return true; })
        .times(20)
        .reply(200, "ok");
    }
    function setChannels(yaml, cb) {
      configModule.getConfigObject("slacknotification", function(err, cf) {
        should.not.exist(err);
        cf.setAndSave({ OSMUser: "TheFive" }, { version: cf.version, yaml: yaml }, function(err) {
          should.not.exist(err);
          initialiseSlackReceiver(cb);
        });
      });
    }
    function afterSends(cb) { setTimeout(cb, 150); }
    function collect(user, cb) {
      articleModule.createNewArticle(function(err, article) {
        should.not.exist(err);
        article.setAndSave(user, { version: article.version, blog: "WN1", collection: "https://example.com", title: "T" }, function(err) {
          should.not.exist(err);
          afterSends(() => cb(article));
        });
      });
    }
    it("should post only guest submissions and guest texts to a guest channel", function (bddone) {
      setChannels("- slack: osmde\n  channel: \"#guests\"\n  notifyNewCollection: guest\n  notifyGuestTextChange: true\n", function(err) {
        should.not.exist(err);
        captureAll();
        collect(editor, function(article) {
          should(posted).eql([]);
          collect(guest, function() {
            should(posted.length).eql(1);
            should(posted[0].channel).eql("#guests");
            should(posted[0].text).containEql("added to");
            posted.length = 0;
            article.setAndSave(guest, { version: article.version, markdownDE: "Text vom Gast" }, function(err) {
              should.not.exist(err);
              afterSends(function() {
                should(posted.length).eql(1);
                should(posted[0].text).eql("<https://localhost:35043/article/1|T> text (DE) changed by guest Visitor\n");
                bddone();
              });
            });
          });
        });
      });
    });
    it("should split guest and editor submissions between two channels", function (bddone) {
      setChannels("- slack: osmde\n  channel: \"#guests\"\n  notifyNewCollection: guest\n" +
        "- slack: osmde\n  channel: \"#editors\"\n  notifyNewCollection: editor\n", function(err) {
        should.not.exist(err);
        captureAll();
        collect(editor, function() {
          should(posted.map(p => p.channel)).eql(["#editors"]);
          posted.length = 0;
          collect(guest, function() {
            should(posted.map(p => p.channel)).eql(["#guests"]);
            bddone();
          });
        });
      });
    });
    it("should still post changed collections where only notifyNewCollection is set", function (bddone) {
      setChannels("- slack: osmde\n  channel: \"#articles\"\n  notifyNewCollection: true\n", function(err) {
        should.not.exist(err);
        captureAll();
        collect(editor, function(article) {
          should(posted.length).eql(1);
          article.setAndSave(editor, { version: article.version, collection: "https://example.com/other" }, function(err) {
            should.not.exist(err);
            afterSends(function() {
              should(posted.length).eql(2);
              should(posted[1].text).containEql("changed collection");
              bddone();
            });
          });
        });
      });
    });
    it("should send a user's notifications as Mattermost direct message", function (bddone) {
      const getValue = config.getValue;
      sinon.stub(config, "getValue").callsFake(function(key, ...rest) {
        if (key === "MattermostUserNotification") return { team: "theweeklyosm" };
        return getValue.call(config, key, ...rest);
      });
      setChannels("[]\n", function(err) {
        should.not.exist(err);
        userModule.createNewUser({ OSMUser: "Reader", access: "full", email: "reader@mail.bc", SlackUser: "@reader.mm", notifyVia: "mattermost", notifyNewCollection: "all" }, function(err, user) {
          should.not.exist(err);
          mailReceiverUpdateUser(user);
          captureAll();
          collect(editor, function() {
            mailReceiverUpdateUser({ OSMUser: "Reader", access: "denied" });
            should(posted.length).eql(1);
            should(posted[0].channel).eql("@reader.mm");
            should(posted[0].text).containEql("added to");
            bddone();
          });
        });
      });
    });
  });
});
