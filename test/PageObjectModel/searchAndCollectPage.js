"use strict;";

import { By, until } from "selenium-webdriver";
import util from "../../util/util.js";

import StandardPage from "./standardPage.js";

const osmbcLink = util.osmbcLink;


export default class SearchAndCollectPage extends StandardPage {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async assertPage() {
    await super.assertPage();
    await this._assertUrlStartsWith(osmbcLink(["/article/create", "/article/search"]));
  }

  async fillAndStartSearch(text) {
    await this.assertPage();
    const ele =  await this._driver.findElement(By.css("input#searchField"));
    await (ele).sendKeys(await this.getCtrlA());
    await (ele).sendKeys(text);
    await (await this._driver.findElement(By.css("button[name='SearchNow']"))).click();
  }

  async fillTitleInput(text) {
    await this.assertPage();
    const ele = await this._driver.findElement(By.id("title"));
    await (ele).sendKeys(await this.getCtrlA());
    await (ele).sendKeys(text);
  }

  async fillCollectionInput(text) {
    await this.assertPage();
    const ele =  await this._driver.findElement(By.css("textarea[name='collection']"));
    await (ele).sendKeys(await this.getCtrlA());
    await (ele).sendKeys(text);
  }

  async clickOK() {
    await this.assertPage();
    const okButton = await this._driver.findElement(By.css("button#OK"));
    await (okButton).click();
    await this._driver.wait(until.stalenessOf(okButton));
  }

  // small screens: the search button in the same row as the field
  async isSearchButtonBesideField() {
    await this.assertPage();
    return this._driver.executeScript(`
      const f = document.getElementById("searchField").getBoundingClientRect();
      const b = document.getElementById("searchButton").getBoundingClientRect();
      return b.left >= f.right && b.top < f.bottom;`);
  }

  // First Draft while collecting: the draft field once the draft is there
  async waitForDraft() {
    await this.assertPage();
    const field = await this._driver.findElement(By.id("firstDraftMarkdown"));
    await this._driver.wait(until.elementIsVisible(field), 5000, "no draft shown");
    return field.getAttribute("value");
  }

  async isDraftAreaShown() {
    return (await this._driver.findElements(By.id("firstDraftArea"))).length > 0;
  }

  async isStartDraftShown() {
    return this._driver.findElement(By.id("firstDraftStart")).isDisplayed();
  }

  async clickStartDraft() {
    await this.assertPage();
    await this.tap(await this._driver.findElement(By.id("firstDraftStart")));
  }

  async getDraftPreview() {
    return this._driver.findElement(By.id("firstDraftPreview")).getText();
  }

  async editDraft(text) {
    await this.assertPage();
    const field = await this._driver.findElement(By.id("firstDraftMarkdown"));
    await field.sendKeys(await this.getCtrlA());
    await field.sendKeys(text);
  }

  async clickSaveWithDraft() {
    await this.assertPage();
    const button = await this._driver.findElement(By.id("OKWithDraft"));
    await this.tap(button);
    await this._driver.wait(until.stalenessOf(button), 5000, "not saved");
  }

  async clickSaveLinkOnly() {
    await this.assertPage();
    const button = await this._driver.findElement(By.id("OK"));
    await this.tap(button);
    await this._driver.wait(until.stalenessOf(button), 5000, "not saved");
  }

  async getOkButton() {
    await this.assertPage();
    return await this._driver.findElement(By.css("button#OK"));
  }
}
