import should from "should";

import testutil from "../testutil.js";
import userModule from "../../model/user.js";
import articleModule from "../../model/article.js";
import blogModule from "../../model/blog.js";
import util from "../../util/util.js";
import ArticlePage from "../PageObjectModel/articlePage.js";

const osmbcLink = util.osmbcLink;

const maxTimer = 30000;
const HOUR = 60 * 60 * 1000;

// Comments older than 24 hours show date and time in the browser's
// timezone, so their order is clear without hovering (#952).
describe("uc.article comment times", function() {
  this.timeout(maxTimer);
  let driver;
  let articleId;

  beforeEach(async function() {
    testutil.startServerSync();
    await testutil.clearDB();
    await userModule.createNewUser({ OSMUser: "TheFive", access: "full", mainLang: "DE", secondLang: "EN", email: "a@b.c" });
    await blogModule.createNewBlog({ OSMUser: "test" }, { name: "WN1", status: "edit" });
    const article = await articleModule.createNewArticle({
      blog: "WN1",
      title: "Title",
      commentStatus: "open",
      commentList: [
        { user: "TheFive", timestamp: new Date(Date.now() - 3 * 24 * HOUR).toISOString(), text: "old comment" },
        { user: "TheFive", timestamp: new Date(Date.now() - 2 * HOUR).toISOString(), text: "new comment" }
      ]
    });
    articleId = article.id;
  });
  afterEach(async function() {
    await testutil.safeQuit(driver);
    testutil.stopServer();
  });

  function checkTimes(times) {
    should(times.length).eql(2);
    const oldDay = String(new Date(Date.now() - 3 * 24 * HOUR).getDate());
    should(times[0].text).not.match(/ago/);
    should(times[0].text).containEql(oldDay);
    should(times[0].title).eql("3 days ago");
    should(times[1].text).eql("2 hours ago");
    should(times[1].title).not.eql("");
  }

  it("should show the date of older comments on a desktop", async function() {
    driver = await testutil.getNewDriver("TheFive");
    const articlePage = new ArticlePage(driver);
    await driver.get(osmbcLink("/article/" + articleId));
    checkTimes(await articlePage.getCommentTimes());
  });

  it("should show the date of older comments on a phone, also after a redraw", async function() {
    driver = await testutil.getNewDriver("TheFive", { device: "phone" });
    const articlePage = new ArticlePage(driver);
    await driver.get(osmbcLink("/article/" + articleId));
    checkTimes(await articlePage.getCommentTimes());
    await articlePage.clickMarkFirstUnreadCommentRead();
    checkTimes(await articlePage.getCommentTimes());
  });
});
