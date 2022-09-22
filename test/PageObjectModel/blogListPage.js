"use strict;";

const { osmbcLink } = require("../../util/util.js");

const { By } = require("selenium-webdriver");


const Page = require("./page.js");

class BlogListPage extends Page {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async assertPage() {
    await this._assertUrlStartsWith(osmbcLink("/blog/list"));
  }

  async clickBlogInList(blog) {
    await (await this._driver.findElement(By.xpath("//td/a[text()='" + blog + "']"))).click();
  }
}
module.exports = BlogListPage;
