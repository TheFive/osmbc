"use strict;";

const { osmbcLink } = require("../../util/util.js");

const { By } = require("selenium-webdriver");


const StandardPage = require("./standardPage.js");

class ArticlePage extends StandardPage {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async assertPage() {
    await this._assertUrlStartsWith(osmbcLink("/article"));
  }

  async selectCategory(category) {
    await this.assertPage();
    await (await this._driver.findElement(By.id("categoryEN"))).click();
    await (await this._driver.findElement(By.css(`option[value='${category}']`))).click();
  }

  async fillTitleInput(text) {
    await this.assertPage();
    const ele =  await this._driver.findElement(By.id("title"));
    await (ele).sendKeys(await this.getCtrlA());
    await (ele).sendKeys(text);
  }

  async fillCommentInput(text) {
    await this.assertPage();
    const ele = await this._driver.findElement(By.css("textarea#comment"));
    await (ele).sendKeys(await this.getCtrlA());
    await (ele).sendKeys(text);
  }

  async fillMarkdownInput(lang, text) {
    await this.assertPage();
    const ele =  await this._driver.findElement(By.id("markdown" + lang));
    await (ele).sendKeys(await this.getCtrlA());
    await (ele).sendKeys(text);
  }

  async clickSave() {
    await this.assertPage();
    await (await this._driver.findElement(By.css("button#saveButton"))).click();
  }

  async clickAddComment() {
    await this.assertPage();
    await (await this._driver.findElement(By.css("button[name='AddComment']"))).click();
  }
}
module.exports = ArticlePage;
