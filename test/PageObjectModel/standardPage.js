"use strict;";

const { By } = require("selenium-webdriver");

const Page = require("../../test/PageObjectModel/page.js");

class StandardPage extends Page {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async clickBlogMenu(blog) {
    await (await this._driver.findElement(By.css("a[href='/blog/" + blog + "']"))).click();
  }
}
module.exports = StandardPage;
