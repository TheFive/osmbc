"use strict";

/* jshint ignore:start */


const nock       = require("nock");
const should     = require("should");
const request    = require("request");
const mockdate   = require("mockdate");
const yaml       = require("js-yaml");
const fs         = require("fs");
const path       = require("path");
const URL        = require("url").URL;

const testutil   = require("../testutil.js");


const initialise = require("../../util/initialise.js");
const userModule  = require("../../model/user.js");


function promiseTimeout (time) {
  return new Promise(function(resolve,reject){
    setTimeout(function(){resolve(time);},time);
  });
};



describe("uc/blog", function() {
  this.timeout(1000*60);
  let nockLoginPage;

  before(async function(){
    nock("https://hooks.slack.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    process.env.TZ = "Europe/Amsterdam";
    mockdate.set(new Date("2016-05-25T19:00:00Z"));
    await testutil.clearDB();
    await initialise.initialiseModules();

    testutil.startServerSync();
  })
  after(async function(){
    mockdate.reset();
    testutil.stopServer();
  })
  let nocklist = []
  beforeEach(async function() {
    nockLoginPage = testutil.nockLoginPage();
    let list = yaml.safeLoad(fs.readFileSync(path.resolve(__dirname, "..", "blog","DataWN290LinkList.txt"), "UTF8"));
    list.forEach(function(item){
      let url = new URL(item);
      let path = url.pathname;
      if (url.search) path = path + url.search;

      let n = nock(url.protocol+"//"+url.host)
        .get(path)
        .times(99)
        .reply(200,"OK");
      nocklist.push(n);
    });
  });
  afterEach(async function() {
    nock.cleanAll();
  });

  describe("status Functions", function() {
    beforeEach(async function() {
      await testutil.importData({clear: true,
        blog: [{name: "blog"}],
        user: [{OSMUser: "TheFive", access: "full", mainLang: "DE",email:"a@b.c"},
          {OSMUser: "TheOther", access: "full", mainLang: "EN",email:"d@e.f"}]});
    });
    it("should be able to manage a blog lifetime", async function() {
      let errors = [];
      let browserTheFive = await testutil.getNewBrowser("TheFive");
      let b2 = await testutil.getNewBrowser("TheOther");

      await browserTheFive.visit("/osmbc");

      // go to admin page and create a new blog
      await browserTheFive.click("a#adminlink");


      await browserTheFive.click("a#createblog");
      // Confirm that you really want to create a blog
      await browserTheFive.click("button#createBlog");

      // click on the second blog in the table (thats the WN251 new created)
      await browserTheFive.click("tbody>tr:nth-child(2)>td>a");

      // Have a look at the blog
      browserTheFive.assert.expectHtmlSync(errors, "blog", "WN251OpenMode");

      // Edit the blog, select EDIT status and stave it
      await browserTheFive.click("a#editBlogDetail");
      await browserTheFive.click("a.btn.btn-primary#edit");
      await browserTheFive.select("status", "edit");
      await browserTheFive.click("input[value='OK']");

      // go to the blog view with the articles
      await browserTheFive.click("a[href='/blog/WN251']");
      browserTheFive.assert.expectHtmlSync(errors, "blog", "WN251EditMode");

      // Start Review for blog
      await browserTheFive.click("button#readyreview");

      // start personal review
      await browserTheFive.click("button#reviewButtonDE");

      // Do a first review comment

      browserTheFive.fill("textarea#reviewCommentDE", "1rst Review Text for DE");
      // simulate keyup to enable button for click.
      browserTheFive.keyUp("textarea#reviewCommentDE", 30);
      await browserTheFive.click("button#reviewButtonDE:enabled");

      await browserTheFive.click("button#reviewButtonDE");

      // do a second review comment, and cancel that

      browserTheFive.fill("textarea#reviewCommentDE", "2nd Review Text for DE");
      // simulate keyup to enable button for click.
      browserTheFive.keyUp("textarea#reviewCommentDE", 30);
      await browserTheFive.click("button#reviewButtonCancelDE:enabled");
      browserTheFive.assert.expectHtmlSync(errors, "blog", "WN251Reviewed");

      await browserTheFive.click("button#didexport");

      browserTheFive.assert.expectHtmlSync(errors, "blog", "WN251Exported");

      await browserTheFive.click("button#closebutton");

      browserTheFive.assert.expectHtmlSync(errors, "blog", "WN251Closed");

      await b2.visit("/blog/WN251");
      // Start Review for blog in english
      await b2.click("button#readyreview");


      // start personal review
      await b2.click("button#reviewButtonEN");

      b2.fill("textarea#reviewCommentEN", "1rst Review Text for EN");
      // simulate keyup to enable button for click.
      b2.keyUp("textarea#reviewCommentEN", 30);
      await b2.click("button#reviewButtonEN");

      // in difference to DE language, here no export should appear.
      b2.assert.element("button#closebutton");
      should(errors).eql([]);
    });
  });
  describe("Test with Blog Data", function() {
    var browser;
    beforeEach(async function() {

      await testutil.importData("blog/DataWN290.json");
      await userModule.createNewUser({OSMUser: "TheFive", access: "full", mainLang: "DE", secondLang: "EN",email:"a@b.c"});
      browser = await testutil.getNewBrowser("TheFive");
    });
    describe("Blog Display", function() {
      it("should show Overview with some configurations", async function() {
        let errors = [];
        await browser.visit("/blog/WN290");
        browser.assert.expectHtmlSync(errors, "blog", "blog_wn290_overview"),
        await browser.click('span[name="choose_showNumbers"]'),
        await browser.click('span[name="choose_showMail"]'),
        await browser.click('span[name="choose_showVisibleLanguages"]'),
        await browser.click('span[name="choose_showCollector"]'),
        await browser.click('span[name="choose_showEditor"]'),
        await browser.click('span[name="choose_showColoredUser"]'),
        await browser.click('span[name="choose_showLanguages"]'),
        browser.assert.expectHtmlSync(errors, "blog", "blog_wn290_overview_withglab");

        //
        let selector = "table>tbody>tr:nth-child(11)>td:nth-child(3)>div>div>ul>li";
        // ensure that selector shows correct article
        browser.assert.text(selector, "jeden Tag...");
        // Open the edit box
        await browser.click(selector);
        browser.assert.text(selector, "jeden Tag...");

        // set value of textfield and trigger onchange
        // with browsers asnyc fire function
        browser.query("textarea#markdown24").value = "Changed Text";
        await browser.fire("textarea#markdown24", "change");


        // reload page again
        await browser.visit("/blog/WN290");
        browser.assert.text("textarea#markdown24", "Changed Text");
        should(errors).eql([]);
      });
      it("should show Full View", async function() {
        await browser.visit("/blog/WN290");
        await browser.click("a[href='/blog/WN290/Full']");
        await promiseTimeout(3000);
        browser.assert.expectHtmlSync("blog", "blog_wn290_full");

        let selector = "li#wn290_24";
        // ensure that selector shows correct article
        browser.assert.text(selector, "Ben Spaulding resümiert über seinen Mappingvorsatz für Januar 2016. Der Plan, jeden Tag im Januar mindestens 15 Minuten an seiner Heimatstadt Littleton zu mappen war zwar nicht ganz erfolgreich, aber seine Erfahrungen und Erkenntnisse sind trotzdem interessant. Ben Spaulding summarises the goals he had set for mapping for the month of January 2016. Though he didn't fully succeed in mapping for at least 15 minutes, but he still got some mapping done and his experiences are interesting none the less.");
        // Open the edit box
        await browser.click(selector);

        // set value of textfield and trigger onchange
        // with browsers asnyc fire function

        browser.query("textarea#lmarkdown24").value = "Changed Text in full review";
        await browser.fire("textarea#lmarkdown24", "change");

        await browser.visit("/blog/WN290");
        browser.assert.text("textarea#lmarkdown24", "Changed Text in full review");
      });
      it("should show Review View", async function() {
        await browser.visit("/blog/WN290?tab=review");
        browser.assert.expectHtmlSync("blog", "blog_wn290_review");

        let selector = "li#wn290_24";
        // ensure that selector shows correct article
        browser.assert.text(selector, "Ben Spaulding resümiert über seinen Mappingvorsatz für Januar 2016. Der Plan, jeden Tag im Januar mindestens 15 Minuten an seiner Heimatstadt Littleton zu mappen war zwar nicht ganz erfolgreich, aber seine Erfahrungen und Erkenntnisse sind trotzdem interessant.");
        // Open the edit box
        await browser.click(selector);

        // set value of textfield and trigger onchange
        // with browsers asnyc fire function

        browser.query("textarea#markdown24").value = "Changed Text in review mode";
        await browser.fire("textarea#markdown24", "change");

        await browser.visit("/blog/WN290");
        browser.assert.text("textarea#markdown24", "Changed Text in review mode");
      });
      it("should show Statistic View", async function() {
        await browser.visit("/blog/WN290/stat");
        browser.assert.expectHtmlSync("blog", "blog_wn290_stat");
      });
      it("should show edit View", async function() {
        await browser.visit("/blog/edit/WN290");
        browser.assert.expectHtmlSync("blog", "blog_wn290_edit");
      });
      it("should show the Blog List", async function() {
        await browser.visit("/blog/list?status=edit");
        browser.assert.expectHtmlSync("blog", "blog_list");
      });
    });
  });
});

/* jshint ignore:end */
