"use strict;";

import { By } from "selenium-webdriver";
import util from "../../util/util.js";

import Page from "./page.js";

const osmbcLink = util.osmbcLink;
class UserPage extends Page {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async assertPage() {
    await super.assertPage();
    await this._assertUrlStartsWith(osmbcLink("/usert"));
  }

  async fillOSMUser(userName) {
    await this.assertPage();
    await this._driver.findElement(By.id("OSMUser")).sendKeys(userName);
  }

  async fillEMail(eMail) {
    await this.assertPage();
    await this._driver.findElement(By.id("email")).sendKeys(eMail);
  }

  async fillMdWeeklyAuthor(mdWeeklyAuthor) {
    await this.assertPage();
    await this._driver.findElement(By.id("mdWeeklyAuthor")).sendKeys(mdWeeklyAuthor);
  }

  async selectPrimaryLanguage(lang) {
    await this.assertPage();
    await (await this._driver.findElement(By.id("language"))).click();
    await (await this._driver.findElement(By.css("#language > option[value='" + lang + "']"))).click();
  }

  async selectAccess(access) {
    await this.assertPage();
    await (await this._driver.findElement(By.id("access"))).click();
    await (await this._driver.findElement(By.css("#access > option[value='" + access + "']"))).click();
  }

  async toggleMailComment(language) {
    await this.assertPage();
    await (await this._driver.findElement(By.css("button[data-id='mailComment']"))).click();
    // xpath looks a little bit crazy. test in chrome javascript console with $x("..xpahtstring..") in the open window
    await (await this._driver.findElement(By.xpath("//select[@name='mailComment']/../div/div/ul/li/a/span[text()='" + language + "']"))).click();
    // click again to hide the pop up
    await (await this._driver.findElement(By.css("button[data-id='mailComment']"))).click();
  }

  async toggleBlogLanguageStatusChange(language) {
    await this.assertPage();
    await (await this._driver.findElement(By.css("button[data-id='mailBlogLanguageStatusChange']"))).click();
    // xpath looks a little bit crazy. test in chrome javascript console with $x("..xpahtstring..") in the open window
    await (await this._driver.findElement(By.xpath("//select[@name='mailBlogLanguageStatusChange']/../div/div/ul/li/a/span[text()='" + language + "']"))).click();
    // click again to hide popup
    await (await this._driver.findElement(By.css("button[data-id='mailBlogLanguageStatusChange']"))).click();
  }

  async clickSave() {
    await this.assertPage();
    await (await this._driver.findElement(By.id("save"))).click();
  }

  async getUserName() {
    await this.assertPage();
    const ele = await this._driver.findElement(By.xpath("//h1[1]"));
    const text = await ele.getText();
    return text.substring(16, 99);
  }
}

export default UserPage;
