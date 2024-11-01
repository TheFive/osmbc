import util from "../../util/util.js";

import { By, Key, until } from "selenium-webdriver";


import StandardPage from "./standardPage.js";

class ArticlePage extends StandardPage {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async assertPage() {
    await super.assertPage();
    await this._assertUrlStartsWith(util.osmbcLink("/article"));
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
    const button = await this._driver.findElement(By.xpath("//button[text()='Update']"));
    await button.click();
    await this._driver.wait(until.stalenessOf(ele));
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
    const saveButton = await this._driver.findElement(By.css("button#saveButton"));
    await (saveButton).click();
    await this._driver.wait(until.stalenessOf(saveButton), 2000);
  }

  async clickNoTranslationButton() {
    await this.assertPage();
    const noTranslationButton = await this._driver.findElement(By.css("button#noTranslationButton"));
    await (noTranslationButton).click();
    await this._driver.wait(until.stalenessOf(noTranslationButton), 2000);
  }

  async clickAddComment() {
    await this.assertPage();
    const addCommentButton = await this._driver.findElement(By.css("button[name='AddComment']"));
    await (addCommentButton).click();
    await this._driver.wait(until.stalenessOf(addCommentButton), 2000);
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

export default ArticlePage;
