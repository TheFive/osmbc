"use strict;";

import util from "../../util/util.js";

import { By, until } from "selenium-webdriver";


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

  // the language columns of the table
  async getLanguageColumns() {
    await this.assertPage();
    const heads = await this._driver.findElements(By.css("table thead th"));
    const texts = await Promise.all(heads.map(h => h.getText()));
    return texts.filter(t => /^[A-Z]{2}$/.test(t));
  }

  async hasCloseBlogLink() {
    return (await this._driver.findElements(By.xpath("//a[text()='Close Blog']"))).length > 0;
  }

  async clickBlogInList(blog) {
    await this.assertPage();
    const blogButton = await this._driver.findElement(By.xpath("//td/a[text()='" + blog + "']"));
    await this._clickAndWaitForNavigation(blogButton);
  }
}
