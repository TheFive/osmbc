"use strict;";

import util from "../../util/util.js";
import Page from "./page.js";

import { By } from "selenium-webdriver";

const osmbcLink = util.osmbcLink;


export default class UserListPage extends Page {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async assertPage() {
    await super.assertPage();
    await this._assertUrlStartsWith(osmbcLink("/usert/list"));
  }

  async clickSortByWeeklyAuthor() {
    await this.assertPage();
    await this._clickAndWaitForNavigation(await this._driver.findElement(By.id("sortWeeklyAuthor")));
  }

  // types the text into the search field and starts the search
  async searchFor(text) {
    await this.assertPage();
    const field = await this._driver.findElement(By.id("userSearchText"));
    await field.sendKeys(await this.getCtrlA());
    await field.sendKeys(text);
    await this._clickAndWaitForNavigation(await this._driver.findElement(By.id("userSearchButton")));
  }

  // OSM names of the users in the table, in the shown order
  async getShownUserNames() {
    await this.assertPage();
    const links = await this._driver.findElements(By.css("table tbody tr td:nth-child(2) a"));
    return Promise.all(links.map(link => link.getText()));
  }

  async getSearchCount() {
    return this._driver.findElement(By.id("userSearchCount")).getText();
  }
}
