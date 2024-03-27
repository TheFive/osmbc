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
    await (await this._driver.findElement(By.id("sortWeeklyAuthor"))).click();
  }
}
