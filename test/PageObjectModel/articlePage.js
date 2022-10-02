"use strict;";

const { osmbcLink } = require("../../util/util.js");

const { By, Key } = require("selenium-webdriver");


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

  async editComment(number, text) {
    await this.assertPage();
    let ele = await this._driver.findElement(By.css("#EditComment" + number));
    await ele.click();
    ele = await this._driver.findElement(By.css("#editComment"));
    await (ele).sendKeys(await this.getCtrlA());
    await (ele).sendKeys(text);
    ele = await this._driver.findElement(By.xpath("//button[text()='Update']"));
    await ele.click();
  }


  async fillMarkdownInput(lang, text) {
    await this.assertPage();
    const ele =  await this._driver.findElement(By.id("markdown" + lang));
    await (ele).sendKeys(await this.getCtrlA());
    await (ele).sendKeys(text);
  }

  async fillCollectionInput(text) {
    await this.assertPage();
    const ele =  await this._driver.findElement(By.id("collection"));
    await (ele).sendKeys(await this.getCtrlA());
    await (ele).sendKeys(text);
    await (ele).sendKeys(Key.TAB);
  }

  async getMarkdownInput(lang) {
    const ele =  await this._driver.findElement(By.id("markdown" + lang));
    const text = await ele.getAttribute("value");
    return text;
  }




  async clickSave() {
    await this.assertPage();
    await (await this._driver.findElement(By.css("button#saveButton"))).click();
  }

  async clickNoTranslationButton() {
    await this.assertPage();
    await (await this._driver.findElement(By.css("button#noTranslationButton"))).click();
  }

  async clickAddComment() {
    await this.assertPage();
    await (await this._driver.findElement(By.css("button[name='AddComment']"))).click();
  }

  async selectAndPasteTextInMarkdown(lang, from, to, text) {
    this.assertPage();
    const ele = await this._driver.findElement(By.css(`#markdown${lang}`));
    await this.selectTextInField(ele, from, to);
    await (ele).sendKeys(text);
    await (ele).sendKeys(Key.TAB);
  }

  async getValueFromLinkArea(link) {
    this.assertPage();
    const ele = await this._driver.findElement(By.css(`div#linkArea>p>a[href='${link}']`));
    const value = await ele.getAttribute("text");
    const danger = await ele.getAttribute("class");
    return { text: value, warning: danger.search("badge-danger") > 0 };
  }

  async getWarningMessage(lang) {
    const ele =  await this._driver.findElement(By.id("text" + lang));
    const text = await ele.getAttribute("innerHTML");
    return text;
  }
}
module.exports = ArticlePage;
