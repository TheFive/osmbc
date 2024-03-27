"use strict;";

import { By } from "selenium-webdriver";

import util from "../../util/util.js";

import Page from "./page.js";

const osmbcLink = util.osmbcLink;

class LoginChooserPage extends Page {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async isPage() {
    return (await this._checkUrl(osmbcLink("/login")));
  }

  async assertPage() {
    await super.assertPage();
    await this._assertUrl(osmbcLink("/login"));
  }

  async clickHtAccessLogin() {
    const button = await this._driver.findElement(By.id("htaccesLoginButton"));
    await button.click();
  }
}
export default LoginChooserPage;
