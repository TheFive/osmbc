import should from "should";
import nock from "nock";
import mockdate from "mockdate";
import sinon from "sinon";

import testutil from "./testutil.js";
import articleModule from "../model/article.js";
import blogModule from "../model/blog.js";
import userModule from "../model/user.js";
import navbarBlogs from "../model/navbarBlogs.js";
import logModule from "../model/logModule.js";
import { NO_CATEGORY_YET, UNPUBLISHED } from "../model/specialCategories.js";


function getNavbarBlogs() {
  return new Promise((resolve, reject) => navbarBlogs.getNavbarBlogs((err, r) => err ? reject(err) : resolve(r)));
}

function names(list) { return list.map(b => b.name); }

describe("model/navbarBlogs", function() {
  const testUser = { OSMUser: "user" };
  before(function () {
    nock("https://missingmattermost.example.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
  });
  after(function () {
    nock.cleanAll();
    mockdate.reset();
  });
  beforeEach(async function () {
    mockdate.reset();
    await testutil.clearDB();
    await blogModule.createNewBlog(testUser, { name: "WN1", status: "edit" }, true);
    await blogModule.createNewBlog(testUser, { name: "WN2", status: "open" }, true);
    await blogModule.createNewBlog(testUser, { name: "WN0", status: "closed" }, true);
    await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", markdownDE: "Text" });
    await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping" });
    await articleModule.createNewArticle({ blog: "TBC", firstCollector: "reader" });
    navbarBlogs.invalidate();
  });

  it("should return TBC, the open and the edit blogs with their status", async function () {
    const blogs = await getNavbarBlogs();
    should(names(blogs.open)).eql(["WN2"]);
    should(names(blogs.edit)).eql(["WN1"]);
    should(blogs.tbc.name).eql("TBC");
    should(blogs.edit[0].getExpected("DE")).eql(2);
    should(blogs.edit[0].getUnEdited("DE")).eql(1);
    should(blogs.edit[0].getUnEdited("EN")).eql(2);
    should(blogs.edit[0]._usedLanguages).eql({ DE: true });
  });

  it("should not read the authors from changes for the menu bar", async function () {
    const spy = sinon.spy(logModule, "findAuthorSummary");
    try {
      const blogs = await getNavbarBlogs();
      should(spy.callCount).eql(0);
      should(blogs.edit[0].getAutoTranslate("DE")).eql("?");
    } finally {
      spy.restore();
    }
  });

  it("should add the automated translation counts on request, once", async function () {
    const blogs = await getNavbarBlogs();
    const spy = sinon.spy(logModule, "findAuthorSummary");
    try {
      const all = [...blogs.open, ...blogs.edit];
      await new Promise((resolve, reject) => navbarBlogs.calculateAutoTranslate(all, (err) => err ? reject(err) : resolve()));
      await new Promise((resolve, reject) => navbarBlogs.calculateAutoTranslate(all, (err) => err ? reject(err) : resolve()));
      should(spy.callCount).eql(1); // WN2 has no articles, nothing to read
      should(blogs.edit[0].getAutoTranslate("DE")).eql(0);
    } finally {
      spy.restore();
    }
  });

  it("should count the same as Blog.calculateDerived", async function () {
    const blogs = await getNavbarBlogs();
    await new Promise((resolve, reject) => navbarBlogs.calculateAutoTranslate(blogs.edit, (err) => err ? reject(err) : resolve()));
    const direct = await blogModule.findOne({ name: "WN1" });
    await new Promise((resolve, reject) => direct.calculateDerived(testUser, (err) => err ? reject(err) : resolve()));
    for (const l of ["DE", "EN"]) {
      should(blogs.edit[0].getUnEdited(l)).eql(direct.getUnEdited(l));
      should(blogs.edit[0].getExpected(l)).eql(direct.getExpected(l));
      should(blogs.edit[0].getAutoTranslate(l)).eql(direct.getAutoTranslate(l));
    }
  });

  it("should serve the same objects until something is written", async function () {
    const first = await getNavbarBlogs();
    const second = await getNavbarBlogs();
    should(second.edit[0]).equal(first.edit[0]);
    should(second.tbc).equal(first.tbc);
  });

  it("should share one load between concurrent requests", async function () {
    const [a, b] = await Promise.all([getNavbarBlogs(), getNavbarBlogs()]);
    should(a.edit[0]).equal(b.edit[0]);
  });

  it("should reload after an article was created", async function () {
    const first = await getNavbarBlogs();
    await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping" });
    const second = await getNavbarBlogs();
    should(second.edit[0]).not.equal(first.edit[0]);
    should(second.edit[0].getExpected("DE")).eql(3);
  });

  it("should reload after a plain save of an article (votes, comment read)", async function () {
    await getNavbarBlogs();
    const article = (await articleModule.find({ blog: "WN1", markdownDE: "Text" }))[0];
    article.markdownEN = "Text";
    await article.save();
    const blogs = await getNavbarBlogs();
    should(blogs.edit[0].getUnEdited("EN")).eql(1);
  });

  it("should reload after a blog changed its status", async function () {
    await getNavbarBlogs();
    const blog = await blogModule.findOne({ name: "WN2" });
    await new Promise((resolve, reject) => blog.setAndSave(testUser, { status: "edit" }, (err) => err ? reject(err) : resolve()));
    const blogs = await getNavbarBlogs();
    should(names(blogs.open)).eql([]);
    should(names(blogs.edit)).eql(["WN1", "WN2"]);
  });

  it("should reload after 60 seconds without any write", async function () {
    const first = await getNavbarBlogs();
    mockdate.set(new Date(Date.now() + 61 * 1000));
    const second = await getNavbarBlogs();
    should(second.edit[0]).not.equal(first.edit[0]);
  });

  describe("Article.textStatus (one rule for counts and list filters)", function() {
    it("should classify the text of a language", function () {
      const a = (proto) => articleModule.create(proto);
      should(a({ categoryEN: UNPUBLISHED, markdownDE: "x" }).textStatus("DE")).eql("unpublished");
      should(a({ categoryEN: "Mapping", markdownDE: "no translation" }).textStatus("DE")).eql("noTranslation");
      should(a({ categoryEN: "Mapping" }).textStatus("DE")).eql("unwritten");
      should(a({ categoryEN: "Mapping", markdownDE: "" }).textStatus("DE")).eql("unwritten");
      should(a({ categoryEN: NO_CATEGORY_YET, markdownDE: "x" }).textStatus("DE")).eql("unwritten");
      should(a({ categoryEN: "Mapping", markdownDE: "x" }).textStatus("DE")).eql("written");
    });

    it("should count written texts like the article list selects them", async function () {
      // text without category: unwritten in the badge, so not in the "written" list
      await articleModule.createNewArticle({ blog: "WN1", categoryEN: NO_CATEGORY_YET, markdownDE: "Text" });
      const blogs = await getNavbarBlogs();
      const articles = await articleModule.find({ blog: "WN1" });
      should(blogs.edit[0].getWritten("DE")).eql(articles.filter((x) => x.textStatus("DE") === "written").length);
      should(blogs.edit[0].getUnEdited("DE")).eql(articles.filter((x) => x.textStatus("DE") === "unwritten").length);
      should(blogs.edit[0].getWritten("DE")).eql(1);
      should(blogs.edit[0].getUnEdited("DE")).eql(2);
    });
  });

  describe("Blog.mentionsFor", function() {
    it("should use the user's current languages, not a stale mainLang field", async function () {
      await articleModule.createNewArticle({
        blog: "WN1",
        commentStatus: "open",
        commentList: [{ user: "x", timestamp: "2026-11-20T10:00:00.000Z", text: "@FR please check" }]
      });
      await articleModule.createNewArticle({
        blog: "WN1",
        commentStatus: "open",
        commentList: [{ user: "x", timestamp: "2026-11-20T10:00:00.000Z", text: "@DE please check" }]
      });
      const reader = userModule.create({ OSMUser: "reader", langArray: ["FR", "EN"], mainLang: "DE" });
      const blogs = await getNavbarBlogs();
      const mentions = blogs.edit[0].mentionsFor(reader);
      should(mentions.mainLangMention.length).eql(1);
      should(mentions.mainLangMention[0].commentList[0].text).eql("@FR please check");
      should(mentions.userMention.length).eql(0);
    });

    it("should prefer a direct mention to a language mention in an earlier comment", async function () {
      await articleModule.createNewArticle({
        blog: "WN1",
        commentStatus: "open",
        commentList: [
          { user: "x", timestamp: "2026-11-20T10:00:00.000Z", text: "@FR please check" },
          { user: "x", timestamp: "2026-11-20T10:01:00.000Z", text: "@reader too" }
        ]
      });
      const reader = userModule.create({ OSMUser: "reader", langArray: ["FR", "EN"] });
      const blogs = await getNavbarBlogs();
      const mentions = blogs.edit[0].mentionsFor(reader);
      should(mentions.userMention.length).eql(1);
      should(mentions.mainLangMention.length).eql(0);
    });

    it("should count the user's own TBC articles", async function () {
      const reader = userModule.create({ OSMUser: "reader", langArray: ["DE", "EN"] });
      const blogs = await getNavbarBlogs();
      should(blogs.tbc.mentionsFor(reader).tbcOwnArticleNumber).eql(1);
      should(blogs.tbc.mentionsFor(userModule.create({ OSMUser: "other" })).tbcOwnArticleNumber).eql(0);
    });

    it("should return new lists for every call, not change the shared blog", async function () {
      const reader = userModule.create({ OSMUser: "reader", langArray: ["DE", "EN"] });
      const blogs = await getNavbarBlogs();
      const a = blogs.edit[0].mentionsFor(reader);
      a.userMention.push("x");
      should(blogs.edit[0].mentionsFor(reader).userMention).eql([]);
      should(blogs.edit[0]._userMention).be.undefined();
    });
  });
});
