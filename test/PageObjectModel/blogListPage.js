"use strict;";

import util from "../../util/util.js";

import { By } from "selenium-webdriver";


import StandardPage from "./standardPage.js";

const osmbcLink = util.osmbcLink;

export default class BlogListPage extends StandardPage {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async assertPage() {
    await super.assertPage();
    await this._assertUrlStartsWith(osmbcLink("/blog/list"));
  }

  async clickBlogInList(blog) {
    await this.assertPage();
    await (await this._driver.findElement(By.xpath("//td/a[text()='" + blog + "']"))).click();
  }
}
