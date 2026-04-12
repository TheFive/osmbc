"use strict;";

import { By, until } from "selenium-webdriver";
import util from "../../util/util.js";

import Page from "./page.js";

const osmbcLink = util.osmbcLink;
class UserPage extends Page {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async _setSelectValue(selectId, value) {
    // introduced because of the special select with search field for translation services. normal select does not work here
    // (CoPilot)
    const selectElement = await this._driver.findElement(By.id(selectId));
    await this.scrollIntoView(selectElement);
    await this._driver.executeScript(
      "arguments[0].value = arguments[1]; arguments[0].dispatchEvent(new Event('input', { bubbles: true })); arguments[0].dispatchEvent(new Event('change', { bubbles: true }));",
      selectElement,
      value
    );
  }

  async _safeClick(element) {
    //
    await this.scrollIntoView(element);
    try {
      await element.click();
    } catch (error) {
      const message = error && error.message ? error.message : "";
      if (message.includes("element click intercepted") || message.includes("element not interactable")) {
        await this._driver.executeScript("arguments[0].click();", element);
      } else {
        throw error;
      }
    }
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
    await this._setSelectValue("language", lang);
  }

  async selectAccess(access) {
    await this.assertPage();
    await this._setSelectValue("access", access);
  }

  async toggleMailComment(language) {
    await this.assertPage();
    const toggleButton = await this._driver.findElement(By.css("button[data-id='mailComment']"));
    await this._safeClick(toggleButton);
    // xpath looks a little bit crazy. test in chrome javascript console with $x("..xpahtstring..") in the open window
    const item = await this._driver.findElement(By.xpath("//select[@name='mailComment']/../div/div/ul/li/a/span[text()='" + language + "']"));
    await this._safeClick(item);
    // click again to hide the pop up
    await this._safeClick(toggleButton);
  }

  async toggleBlogLanguageStatusChange(language) {
    await this.assertPage();
    const toggleButton = await this._driver.findElement(By.css("button[data-id='mailBlogLanguageStatusChange']"));
    await this._safeClick(toggleButton);
    // xpath looks a little bit crazy. test in chrome javascript console with $x("..xpahtstring..") in the open window
    const item = await this._driver.findElement(By.xpath("//select[@name='mailBlogLanguageStatusChange']/../div/div/ul/li/a/span[text()='" + language + "']"));
    await this._safeClick(item);
    // click again to hide popup
    await this._safeClick(toggleButton);
  }

  async clickSave() {
    await this.assertPage();
    const saveButton = await this._driver.findElement(By.id("save"));
    await this._safeClick(saveButton);
    await (this._driver.wait(until.stalenessOf(saveButton)));
  }

  async getUserName() {
    await this.assertPage();
    const ele = await this._driver.findElement(By.xpath("//h1[1]"));
    const text = await ele.getText();
    return text.substring(16, 99);
  }
}

export default UserPage;
