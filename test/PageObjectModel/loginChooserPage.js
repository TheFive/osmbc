"use strict;";

const { By } = require("selenium-webdriver");

const { osmbcLink } = require("../../util/util.js");

const Page = require("./page.js");

class LoginChooserPage extends Page {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async isPage() {
    return (await this._checkUrl(osmbcLink("/login")));
  }

  async assertPage() {
    await this._assertUrl(osmbcLink("/login"));
  }

  async clickHtAccessLogin() {
    const button = await this._driver.findElement(By.id("htaccesLoginButton"));
    await button.click();
  }
}
module.exports = LoginChooserPage;
