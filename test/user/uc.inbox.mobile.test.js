import should from "should";
import nock from "nock";

import testutil from "../testutil.js";
import userModule from "../../model/user.js";
import articleModule from "../../model/article.js";
import blogModule from "../../model/blog.js";
import util from "../../util/util.js";
import InboxPage from "../PageObjectModel/inboxPage.js";

const osmbcLink = util.osmbcLink;

const maxTimer = 30000;

// Inbox on a phone: open the article and mark comments read with tap-sized
// buttons (X10).
describe("uc/inbox on small screens", function() {
  this.timeout(maxTimer);
  let driver;
  let articleId;

  beforeEach(async function() {
    nock("https://missingmattermost.example.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    testutil.startServerSync();
    await testutil.clearDB();
    await userModule.createNewUser({ OSMUser: "TheFive", access: "full", mainLang: "DE", secondLang: "EN", email: "a@b.c" });
    await blogModule.createNewBlog({ OSMUser: "test" }, { name: "WN1", status: "edit" });
    const now = new Date().toISOString();
    const article = await articleModule.createNewArticle({
      blog: "WN1", categoryEN: "Mapping", title: "Title",
      commentList: [{ user: "Other", text: "@TheFive first", timestamp: now }, { user: "Other", text: "@TheFive second", timestamp: now }]
    });
    articleId = article.id;
  });
  afterEach(async function() {
    nock.cleanAll();
    await testutil.safeQuit(driver);
    testutil.stopServer();
  });

  it("should open articles and mark comments read by tapping", async function() {
    driver = await testutil.getNewDriver("TheFive", { device: "phone" });
    const inboxPage = new InboxPage(driver);
    await driver.get(osmbcLink("/usert/inbox"));
    should(await inboxPage.hasHorizontalScroll()).be.False();
    should(await inboxPage.tapTargetsTooSmall(".osmbc-article-open, a[aria-label='Mark as read']")).eql([]);
    should(await inboxPage.countUnreadComments()).eql(2);
    await inboxPage.clickMarkFirstCommentRead();
    await driver.wait(async () => String((await articleModule.findById(articleId)).commentRead.TheFive) === "0", 5000, "not marked read");
    // back in the inbox: the first comment counts as read (commentRead 0)
    await driver.get(osmbcLink("/usert/inbox"));
    should(await inboxPage.countUnreadComments()).eql(1);
  });
});
