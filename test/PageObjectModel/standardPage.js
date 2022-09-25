"use strict;";

const { By } = require("selenium-webdriver");

const Page = require("../../test/PageObjectModel/page.js");

class StandardPage extends Page {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async clickBlogMenu(blog) {
    await this.assertPage();
    await (await this._driver.findElement(By.css("a[href='/blog/" + blog + "']"))).click();
  }

  async clickInboxMenu(blog) {
    await this.assertPage();
    await (await this._driver.findElement(By.id("inbox"))).click();
  }

  async clickMyArticlesMenu() {
    await this.assertPage();
    await (await this._driver.findElement(By.css("a.nav-link#myArticles"))).click();
  }

  async clickCollect() {
    await this.assertPage();
    await (await this._driver.findElement(By.css("#collect"))).click();
  }
}
module.exports = StandardPage;
