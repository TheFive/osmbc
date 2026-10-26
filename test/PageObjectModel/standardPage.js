"use strict;";

import { By } from "selenium-webdriver";

import Page from "../../test/PageObjectModel/page.js";

export default class StandardPage extends Page {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }


  async clickBlogMenu(blog) {
    await this.assertPage();
    const blogMenu = await this._driver.findElement(By.css("a[href='/blog/" + blog + "']"));
    await this._clickAndWaitForNavigation(blogMenu);
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
    await this._clickAndWaitForNavigation(collectButton);
  }

  // small screens: the app name at the top of the menu panel leads home
  async clickHomeInMenu() {
    await this.assertPage();
    await this.tap(await this._driver.findElement(By.css("button.navbar-toggler")));
    // Bootstrap marks the panel .show at the start of its slide-in and drops
    // .showing when it has arrived
    const panel = await this._driver.findElement(By.id("navbarSupportedContent"));
    await this._driver.wait(async () => {
      const cls = await panel.getAttribute("class");
      return cls.includes("show") && !cls.includes("showing");
    }, 3000, "menu panel did not open");
    await this._tapAndWaitForNavigation(await this._driver.findElement(By.id("menuHome")));
  }

  async clickUserIcon() {
    await this.assertPage();
    await (await this._driver.findElement(By.css("#navbarSupportedContent #userAvatar"))).click();
  }
};
