"use strict;";

import { By, until } from "selenium-webdriver";

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

  // List "Links that can't be checked automatically" (blog and article page)

  // the link check starts 500 ms after the page is shown (osmbc_staff.js)
  async waitForLinkCheck() {
    await this._driver.wait(() => this._driver.executeScript("return !!window.cacheLink && Object.keys(window.cacheLink).length > 0;"), 5000, "link check did not run");
    await this.waitForBackgroundRequests();
  }

  // Rows of the list "Links that can't be checked automatically" as
  // {url, text}; empty while the list is hidden. Waits for the link check.
  async getUncheckableLinks() {
    await this.waitForLinkCheck();
    const area = await this._driver.findElement(By.id("uncheckableLinks"));
    if (!(await area.isDisplayed())) return [];
    const rows = await area.findElements(By.css("li[data-uncheckable-link]"));
    const result = [];
    for (const row of rows) {
      result.push({ url: await row.getAttribute("data-uncheckable-link"), text: await row.getText() });
    }
    return result;
  }

  #uncheckableRow(url) {
    return `#uncheckableLinks li[data-uncheckable-link='${url}']`;
  }

  // "Exists" (true) / "Missing" (false) in that list
  async answerUncheckableLink(url, exists) {
    await this.tap(await this._driver.findElement(By.css(`${this.#uncheckableRow(url)} button[data-link-answer='${exists}']`)));
    await this._driver.wait(until.elementLocated(By.css(`${this.#uncheckableRow(url)} button[data-link-revoke]`)), 5000, "link not answered");
  }

  // "Undo" in that list, waits for the "Exists" button again
  async undoUncheckableLink(url) {
    await this.tap(await this._driver.findElement(By.css(`${this.#uncheckableRow(url)} button[data-link-revoke]`)));
    await this._driver.wait(until.elementLocated(By.css(`${this.#uncheckableRow(url)} button[data-link-answer='true']`)), 5000, "answer not undone");
  }
};
