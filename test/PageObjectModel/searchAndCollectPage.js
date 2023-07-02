"use strict;";

const { osmbcLink } = require("../../util/util.js");

const { By } = require("selenium-webdriver");


const StandardPage = require("./standardPage.js");

class SearchAndCollectPage extends StandardPage {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async assertPage() {
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
    await (await this._driver.findElement(By.css("input#OK"))).click();
  }

  async getOkButton() {
    await this.assertPage();
    return await this._driver.findElement(By.css("input#OK"));
  }
}
module.exports = SearchAndCollectPage;
