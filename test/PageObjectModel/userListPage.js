"use strict;";

const { osmbcLink } = require("../../util/util.js");

const { By } = require("selenium-webdriver");


const Page = require("./page.js");

class UserListPage extends Page {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async assertPage() {
    await this._assertUrlStartsWith(osmbcLink("/usert/list"));
  }

  async clickSortByWeeklyAuthor() {
    await this.assertPage();
    await (await this._driver.findElement(By.id("sortWeeklyAuthor"))).click();
  }
}
module.exports = UserListPage;
