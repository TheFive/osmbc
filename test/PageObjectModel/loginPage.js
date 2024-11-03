"use strict;";

import { By } from "selenium-webdriver";

import Page from "../../test/PageObjectModel/page.js";
import util from "../../util/util.js";

const osmbcLink = util.osmbcLink;

class LoginPage extends Page {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async isPage() {
    return (await this._checkUrl(osmbcLink("/htaccess/login")));
  }

  async assertPage() {
    await super.assertPage();
    await this._assertUrl(osmbcLink("/htaccess/login"));
  }

  async typeUsername(userName) {
    await this._driver.findElement(By.id("username")).sendKeys(userName);
  }

  async typePassword(password) {
    await this._driver.findElement(By.id("password")).sendKeys(password);
  }

  async clickOK() {
    await (await this._driver.findElement(By.id("submitbutton"))).click();
  }
}
export default LoginPage;
