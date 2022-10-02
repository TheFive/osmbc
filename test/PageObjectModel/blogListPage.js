"use strict;";

const { osmbcLink } = require("../../util/util.js");

const { By } = require("selenium-webdriver");


const StandardPage = require("./standardPage.js");

class BlogListPage extends StandardPage {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async assertPage() {
    await this._assertUrlStartsWith(osmbcLink("/blog/list"));
  }

  async clickBlogInList(blog) {
    await this.assertPage();
    await (await this._driver.findElement(By.xpath("//td/a[text()='" + blog + "']"))).click();
  }
}
module.exports = BlogListPage;
