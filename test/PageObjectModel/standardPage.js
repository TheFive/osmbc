"use strict;";

import { By } from "selenium-webdriver";
import { untilStale } from "./page.js";

import Page from "../../test/PageObjectModel/page.js";

export default class StandardPage extends Page {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }


  async clickBlogMenu(blog) {
    await this.assertPage();
    const blogMenu = await this._driver.findElement(By.css("a[href='/blog/" + blog + "']"));
    await blogMenu.click();
    await this._driver.wait(untilStale(blogMenu));
  }

  async clickInboxMenu(blog) {
    await this.assertPage();
    await this._clickAndWaitForNavigation(await this._driver.findElement(By.id("inbox")));
  }

  async clickMyArticlesMenu() {
    await this.assertPage();
    await this._clickAndWaitForNavigation(await this._driver.findElement(By.css("a.nav-link#myArticles")));
  }

  async clickCollect() {
    await this.assertPage();
    const collectButton = await this._driver.findElement(By.css("#collect"));
    await (collectButton).click();
    await this._driver.wait(untilStale(collectButton));
  }

  async clickUserIcon() {
    await this.assertPage();
    await (await this._driver.findElement(By.css("nav#fixedNavbar>div>div>ul>li>img"))).click();
  }
};
