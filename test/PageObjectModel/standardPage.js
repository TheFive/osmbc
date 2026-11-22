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

  // Card "Links to check" (blog and article page, mixin linkCheckCard)

  // waits until every link of the page has a link check result (known with
  // the page or asked for 500 ms after it is shown, osmbc_staff.js)
  async waitForLinkCheck() {
    await this._driver.wait(() => this._driver.executeScript(`
      const urls = Object.keys(collectAllLinks());
      return urls.length > 0 && !!window.cacheLink && urls.every(u => window.cacheLink[u]) && window.jQuery.active === 0;`),
    5000, "link check did not finish");
  }

  // {title, check: [{url, text}], ok: number}; null while the card is hidden
  async getLinkCard() {
    await this.waitForLinkCheck();
    const card = await this._driver.findElement(By.id("linkCheckCard"));
    if (!(await card.isDisplayed())) return null;
    const check = [];
    for (const row of await card.findElements(By.css("[data-link-list='check'] li[data-link-check-row]"))) {
      check.push({ url: await row.getAttribute("data-link-check-row"), text: await row.getText() });
    }
    const ok = (await card.findElements(By.css("[data-link-list='ok'] li[data-link-check-row]"))).length;
    return { title: await (await card.findElement(By.css("[data-link-card-title]"))).getText(), check: check, ok: ok };
  }

  // label of the button that opens / closes the links that are ok
  async getOkLinksToggleText() {
    await this.waitForLinkCheck();
    return (await this._driver.findElement(By.css("#linkCheckCard [data-link-toggle-ok]"))).getText();
  }

  // opens the collapsed list of links that are ok, returns its rows {url, text}
  async showOkLinks() {
    await this.waitForLinkCheck();
    const list = await this._driver.findElement(By.css("#linkCheckCard [data-link-list='ok']"));
    if (!(await list.isDisplayed())) await this.tap(await this._driver.findElement(By.css("#linkCheckCard [data-link-toggle-ok]")));
    const rows = [];
    for (const row of await list.findElements(By.css("li[data-link-check-row]"))) {
      rows.push({ url: await row.getAttribute("data-link-check-row"), text: await row.getText() });
    }
    return rows;
  }

  #linkRow(url) {
    return `#linkCheckCard li[data-link-check-row='${url}']`;
  }

  // "Exists" (true) / "Missing" (false) for a link in the card
  async answerLink(url, exists) {
    await this.tap(await this._driver.findElement(By.css(`${this.#linkRow(url)} button[data-link-answer='${exists}']`)));
    await this._driver.wait(until.elementLocated(By.css(`${this.#linkRow(url)} button[data-link-revoke]`)), 5000, "link not answered");
  }

  // "Undo" of an editor's answer in the card
  async undoLinkAnswer(url) {
    await this.tap(await this._driver.findElement(By.css(`${this.#linkRow(url)} button[data-link-revoke]`)));
    await this._driver.wait(until.elementLocated(By.css(`${this.#linkRow(url)} button[data-link-answer]`)), 5000, "answer not undone");
  }
};
