"use strict;";

const { By, Key } = require("selenium-webdriver");
const { osmbcLink } = require("../../util/util.js");

const StandardPage = require("./standardPage.js");

class BlogPage extends StandardPage {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async assertPage() {
    await this._assertUrlStartsWith(osmbcLink("/blog"));
  }

  async clickEditBlogDetail() {
    await (await this._driver.findElement(By.id("editBlogDetail"))).click();
  }

  async clickReadyReview(blog, lang) {
    await (await this._driver.findElement(By.xpath(`//button[text()="Set ${blog}(${lang}) ready for review"]`))).click();
  }

  async clickClose(blog, lang) {
    await (await this._driver.findElement(By.xpath(`//button[text()="Close ${blog}(${lang})"]`))).click();
  }

  async clickStartPersonalReview(lang) {
    await (await this._driver.findElement(By.css("button#reviewButton" + lang))).click();
  }

  async typeReviewText(lang, text) {
    await (await this._driver.findElement(By.css("textarea#reviewComment" + lang))).sendKeys(text);
  }

  async clickStoreReviewText(lang) {
    await (await this._driver.findElement(By.css("button#reviewButton" + lang))).click();
  }

  async clickDidExport(lang) {
    await (await this._driver.findElement(By.xpath(`//button[text()="Did Export (${lang})"]`))).click();
  }

  async clickShowNumbersCheckbox() {
    await (await this._driver.findElement(By.css('div[name="choose_showNumbers"]'))).click();
  }

  async clickShowMailCheckbox() {
    await (await this._driver.findElement(By.css('div[name="choose_showMail"]'))).click();
  }

  async clickShowCollectorCheckbox() {
    await (await this._driver.findElement(By.css('div[name="choose_showCollector"]'))).click();
  }

  async clickShowEditorCheckbox() {
    await (await this._driver.findElement(By.css('div[name="choose_showEditor"]'))).click();
  }

  async clickShowColoredUserCheckbox() {
    await (await this._driver.findElement(By.css('div[name="choose_showColoredUser"]'))).click();
  }

  async clickShowVisibleLanguagesCheckbox() {
    await (await this._driver.findElement(By.css('div[name="choose_showVisibleLanguages"]'))).click();
  }

  async clickShowLanguagesCheckbox() {
    await (await this._driver.findElement(By.css('div[name="choose_showLanguages"]'))).click();
  }

  async clickOnArticle(articleText) {
    const articleElement = await this._driver.findElement(By.xpath(`//li[text()[contains(.,'${articleText}')]]`));
    await this._driver.actions().scroll(0, 0, 0, 200, articleElement).perform();

    await (articleElement).click();
  }

  async isMode(mode) {
    const modeTab = await this._driver.findElement(By.xpath(`//a[(text()="${mode}") and contains(@class, 'nav-link')]`));
    const classAttrib = await modeTab.getAttribute("class");
    return classAttrib.includes("active");
  }

  async typeEditForm(articleShown, newArticleText) {
    let editForm;
    if (await this.isMode("Overview")) {
      editForm = await this._driver.findElement(By.xpath(`//li[text()[contains(.,'${articleShown}')]]/../../../../../following-sibling::tr[1]//textarea`));
    } else if (await this.isMode("Full")) {
      editForm = await this._driver.findElement(By.xpath(`//li[text()[contains(.,'${articleShown}')]]/../../../..//textarea[1]`));
    } else if (await this.isMode("Review")) {
      editForm = await this._driver.findElement(By.xpath(`//li[text()[contains(.,'${articleShown}')]]/../../../../..//textarea[1]`));
    }

    // console.dir(await this._driver.getCapabilities().getPlatform().toString());
    // const cmdCtrl = await this._driver.getCapabilities().platformName.contains('mac') ? Key.COMMAND : Key.CONTROL;

    // Use Command for Mac, get decision based on platform with a similar solution than in the above comment.
    const cmdCtrl = Key.COMMAND;


    await (editForm).sendKeys(Key.chord(cmdCtrl, "a"));

    await (editForm).sendKeys(newArticleText);
  }

  async getEditForm(articleShown) {
    let editForm;
    if (await this.isMode("Overview")) {
      editForm = await this._driver.findElement(By.xpath(`//li[text()[contains(.,'${articleShown}')]]/../../../../../following-sibling::tr[1]//textarea`));
    } else if (await this.isMode("Full")) {
      editForm = await this._driver.findElement(By.xpath(`//li[text()[contains(.,'${articleShown}')]]/../../../..//textarea[1]`));
    } else if (await this.isMode("Review")) {
      editForm = await this._driver.findElement(By.xpath(`//li[text()[contains(.,'${articleShown}')]]/../../../../..//textarea[1]`));
    }

    return await editForm.getAttribute('innerHTML');
  }

  async cickMode(mode) {
    const fullTab = await this._driver.findElement(By.xpath(`//a[(text()="${mode}") and contains(@class, 'nav-link')]`));
    await this._driver.actions().scroll(0, 0, 0, 200, fullTab).perform();
    await (fullTab).click();
  }

  async clickStatisticView() {
    const statisticView = await this._driver.findElement(By.xpath(`//a[text()="[Statistic]"]`));
    await this._driver.actions().scroll(0, 0, 0, 200, statisticView).perform();
    await statisticView.click();
  }

  async clickEditView() {
    const editView = await this._driver.findElement(By.xpath(`//a[text()="[Edit Blog Detail]"]`));
    await this._driver.actions().scroll(0, 0, 0, 200, editView).perform();
    await editView.click();
  }
}
module.exports = BlogPage;
