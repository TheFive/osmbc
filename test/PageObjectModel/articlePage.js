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
    const ctrlA = await this.getCtrlA();
    await (ele).sendKeys(ctrlA);
    await (ele).sendKeys(text);
  }

  async fillCommentInput(text) {
    await this.assertPage();
    const ele = await this._driver.findElement(By.css("textarea#comment"));
    await (ele).sendKeys(await this.getCtrlA());
    await (ele).sendKeys(text);
  }

  // opens the edit form of an own comment (the comment area is redrawn)
  async openEditComment(number) {
    await this.assertPage();
    const button = await this._driver.findElement(By.css("#EditComment" + number));
    await this.tap(button);
    await this._driver.wait(until.stalenessOf(button), 3000, "comment area not redrawn");
  }

  async typeCommentText(text) {
    await this.assertPage();
    const field = await this._driver.findElement(By.id("comment"));
    await this.tap(field);
    await field.sendKeys(text);
  }

  async editComment(number, text) {
    await this.assertPage();
    let ele = await this._driver.findElement(By.css("#EditComment" + number));
    await ele.click();
    ele = await this._driver.findElement(By.css("#editComment"));
    await (ele).sendKeys(await this.getCtrlA());
    await (ele).sendKeys(text);
    const button = await this._driver.findElement(By.xpath("//button[text()='Update']"));
    await this.scrollIntoView(button);

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

  async getMarkdownInputHeight(lang) {
    const ele = await this._driver.findElement(By.id("markdown" + lang));
    const rect = await ele.getRect();
    return rect.height;
  }

  // Navbar "Translate" menu, entry "Translate <from>-><to>" of the given
  // service (only listed for the services in the user's translationServices).
  async translateWithMenu(fromLang, toLang, service) {
    await this.assertPage();
    await (await this._driver.findElement(By.id("articleTranslateMenu"))).click();
    const entry = await this._driver.findElement(By.xpath(
      `//ul[@id='articleTranslationDropdown']//li[normalize-space(text())='Use ${service}:']` +
      `//a[contains(concat(' ', normalize-space(@class), ' '), ' translate${fromLang}${toLang} ')]`
    ));
    await this._driver.wait(until.elementIsVisible(entry), 2000);
    await entry.click();
  }

  async waitMarkdownInputToBe(lang, text) {
    const ele =  await this._driver.findElement(By.id("markdown" + lang));
    // Sample for a fluent wait with selenium
    await this._driver.wait(async function() {
      const textFromField = await ele.getAttribute("value").catch(() => null);
      return textFromField === text;
    }, 10000, 500);
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
    // Scroll the comment section into view to ensure the button is clickable
    await this.scrollIntoView(addCommentButton);
    await this._waitForBootstrapOverlaysToDisappear();
    await (addCommentButton).click();
    await this._driver.wait(until.stalenessOf(addCommentButton), 2000);
  }

  async selectAndPasteTextInMarkdown(lang, from, to, text) {
    this.assertPage();
    const ele = await this._driver.findElement(By.css(`#markdown${lang}`));
    await this.selectTextInField(ele, from, to);
    await (ele).sendKeys(text);
    await (ele).sendKeys(Key.TAB);
    await (this._driver.wait(until.elementIsEnabled(ele)));
  }

  async getValueFromLinkArea(link) {
    this.assertPage();
    const ele = await this._driver.findElement(By.css(`div#linkArea a.badge[href='${link}']`));
    const value = await ele.getText();
    const cssClass = await ele.getAttribute("class");
    const hasWarningClass = /(?:^|\s)(?:badge-danger|text-bg-danger)(?:\s|$)/.test(cssClass || "");
    return { text: value, warning: hasWarningClass };
  }

  // Small screens (mobile mode): one language, the second one on demand,
  // Save in the bar at the bottom, insert buttons at the collection links.

  // type at the end of the text, keeping what is there
  async appendMarkdownInput(lang, text) {
    await this.assertPage();
    await this._driver.findElement(By.id("markdown" + lang)).sendKeys(text);
  }

  async isMarkdownShown(lang) {
    return this._driver.findElement(By.id("markdown" + lang)).isDisplayed();
  }

  async getToggleSecondLanguageText() {
    return this._driver.findElement(By.id("toggleSecondLang")).getText();
  }

  async clickToggleSecondLanguage() {
    await this.assertPage();
    await this.tap(await this._driver.findElement(By.id("toggleSecondLang")));
  }

  async isTranslateToSecondLanguageShown() {
    return this._driver.findElement(By.id("translateToSecondLang")).isDisplayed();
  }

  async clickTranslateToSecondLanguage() {
    await this.assertPage();
    await this.tap(await this._driver.findElement(By.id("translateToSecondLang")));
  }

  async clickSaveBar() {
    await this.assertPage();
    await this.tap(await this._driver.findElement(By.id("saveButtonBar")));
  }

  async isSaveBarShown() {
    return this._driver.findElement(By.id("saveButtonBar")).isDisplayed();
  }

  // the first collection link's "+ Link" / "+ translated" button
  async clickInsertLink() {
    await this.assertPage();
    await this.tap(await this._driver.findElement(By.css("#linkArea button.insertLink")));
  }

  async clickInsertTranslatedLink() {
    await this.assertPage();
    await this.tap(await this._driver.findElement(By.css("#linkArea button.insertTranslatedLink")));
  }

  async isInsertLinkShown() {
    return this._driver.findElement(By.css("#linkArea button.insertLink")).isDisplayed();
  }

  async isLanguageFlagsShown() {
    return this._driver.findElement(By.id("languageFlags")).isDisplayed();
  }

  // comment area: number of comments marked unread (envelope)
  async countUnreadComments() {
    return (await this._driver.findElements(By.css("#commentArea button[aria-label='Mark as read']"))).length;
  }

  async clickMarkFirstUnreadCommentRead() {
    await this.assertPage();
    const envelope = await this._driver.findElement(By.css("#commentArea button[aria-label='Mark as read']"));
    await this.tap(envelope);
    await this._driver.wait(until.stalenessOf(envelope), 3000, "comment area not redrawn");
  }

  async tapAddComment(text) {
    await this.assertPage();
    const field = await this._driver.findElement(By.id("comment"));
    await this.tap(field);
    await field.sendKeys(text);
    const button = await this._driver.findElement(By.css("button[name='AddComment']"));
    await this.tap(button);
    await this._driver.wait(until.stalenessOf(button), 3000, "comment area not redrawn");
  }

  // the n-th vote button next to the article's form (0 = first)
  async clickTopVote(n) {
    await this.assertPage();
    const buttons = await this._driver.findElements(By.css("#voteButtons button"));
    await this.tap(buttons[n]);
  }

  // the "⋯" menu of the first collection link (mobile mode): its entries
  async openLinkMenu() {
    await this.assertPage();
    await this.tap(await this._driver.findElement(By.css("#linkArea [data-bs-toggle='dropdown']")));
    const entries = await this._driver.findElements(By.css("#linkArea .dropdown-menu.show .dropdown-item"));
    return Promise.all(entries.map(e => e.getText()));
  }

  // select text in a markdown field, or place the cursor (no "to");
  // from = "end" puts the cursor after the text
  async setMarkdownSelection(lang, from, to) {
    await this._driver.executeScript(`
      const f = document.getElementById("markdown" + arguments[0]);
      const from = (arguments[1] === "end") ? f.value.length : arguments[1];
      f.focus();
      f.setSelectionRange(from, arguments[2] ?? from);`, lang, from, to);
  }

  async getWarningMessage(lang) {
    const ele =  await this._driver.findElement(By.id("text" + lang));
    const text = await ele.getAttribute("innerHTML");
    return text;
  }
}

export default ArticlePage;
