"use strict;";

import { By, until } from "selenium-webdriver";
import util from "../../util/util.js";
import StandardPage from "./standardPage.js";

const osmbcLink = util.osmbcLink;



class BlogPage extends StandardPage {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async assertPage() {
    this._page = await this._driver.findElement(By.css("a.navbar-brand"));
    await this._assertUrlStartsWith(osmbcLink("/blog"));
  }

  async clickEditBlogDetail() {
    await this.assertPage();
    await (await this._driver.findElement(By.id("editBlogDetail"))).click();
  }

  async clickReadyReview(blog, lang) {
    await this.assertPage();
    await (await this._driver.findElement(By.xpath(`//button[text()="Set ${blog}(${lang}) ready for review"]`))).click();
  }

  async clickClose(blog, lang) {
    await this.assertPage();
    await (await this._driver.findElement(By.xpath(`//button[text()="Close ${blog}(${lang})"]`))).click();
  }

  async clickStartPersonalReview(lang) {
    await this.assertPage();
    await (await this._driver.findElement(By.css("button#reviewButton" + lang))).click();
  }

  async typeReviewText(lang, text) {
    await this.assertPage();
    await (await this._driver.findElement(By.css("textarea#reviewComment" + lang))).sendKeys(text);
  }

  async #clickACheckbox(checkboxName) {
    await this.assertPage();
    const checkbox = (await this._driver.findElement(By.css(checkboxName)));
    await this._driver.actions().scroll(0, 0, 0, 50, checkbox).perform();
    await checkbox.click();
  }

  async clickStoreReviewText(lang) {
    await this.assertPage();
    await (await this._driver.findElement(By.css("button#reviewButton" + lang))).click();
  }

  async clickDidExport(lang) {
    await this.assertPage();
    await (await this._driver.findElement(By.xpath(`//button[text()="Did Export (${lang})"]`))).click();
  }

  async clickShowNumbersCheckbox() {
    await this.#clickACheckbox('div[name="choose_showNumbers"]');
  }

  async clickShowMailCheckbox() {
    await this.#clickACheckbox('div[name="choose_showMail"]');
  }

  async clickShowCollectorCheckbox() {
    await this.#clickACheckbox('div[name="choose_showCollector"]');
  }

  async clickShowEditorCheckbox() {
    await this.#clickACheckbox('div[name="choose_showEditor"]');
  }

  async clickShowColoredUserCheckbox() {
    await this.#clickACheckbox('div[name="choose_showColoredUser"]');
  }

  async clickShowVisibleLanguagesCheckbox() {
    await this.#clickACheckbox('div[name="choose_showVisibleLanguages"]');
  }

  async clickShowLanguagesCheckbox() {
    await this.#clickACheckbox('div[name="choose_showLanguages"]');
  }

  async clickOnArticle(articleText) {
    await this.assertPage();
    const articleElement = await this._driver.findElement(By.xpath(`//li[text()[contains(.,'${articleText}')]]`));
    await this._driver.actions().scroll(0, 0, 0, 200, articleElement).perform();
    await (articleElement).click();
  }

  async isMode(mode) {
    await this.assertPage();
    const modeTab = await this._driver.findElement(By.xpath(`//a[(text()="${mode}") and contains(@class, 'nav-link')]`));
    const classAttrib = await modeTab.getAttribute("class");
    return classAttrib.includes("active");
  }

  async typeEditForm(articleShown, newArticleText) {
    await this.assertPage();
    let editForm;
    if (await this.isMode("Overview")) {
      editForm = await this._driver.findElement(By.xpath(`//li[text()[contains(.,'${articleShown}')]]/../../../../../following-sibling::tr[1]//textarea`));
    } else if (await this.isMode("Full")) {
      editForm = await this._driver.findElement(By.xpath(`//li[text()[contains(.,'${articleShown}')]]/../../../..//textarea[1]`));
    } else if (await this.isMode("Review")) {
      editForm = await this._driver.findElement(By.xpath(`//li[text()[contains(.,'${articleShown}')]]/../../../../..//textarea[1]`));
    }

    await this._driver.wait(until.elementIsVisible(editForm), 2000);
    const ctrlA = await this.getCtrlA();

    await (editForm).sendKeys(ctrlA);

    await (editForm).sendKeys(newArticleText);
  }

  async getEditForm(articleShown) {
    await this.assertPage();
    let editForm;
    if (await this.isMode("Overview")) {
      editForm = await this._driver.findElement(By.xpath(`//li[text()[contains(.,'${articleShown}')]]/../../../../../following-sibling::tr[1]//textarea`));
    } else if (await this.isMode("Full")) {
      editForm = await this._driver.findElement(By.xpath(`//li[text()[contains(.,'${articleShown}')]]/../../../..//textarea[1]`));
    } else if (await this.isMode("Review")) {
      editForm = await this._driver.findElement(By.xpath(`//li[text()[contains(.,'${articleShown}')]]/../../../../..//textarea[1]`));
    }

    return await editForm.getAttribute("innerHTML");
  }

  async cickMode(mode) {
    await this.assertPage();
    const fullTab = await this._driver.findElement(By.xpath(`//a[(text()="${mode}") and contains(@class, 'nav-link')]`));
    await this._driver.actions().scroll(0, 0, 0, 200, fullTab).perform();
    await (fullTab).click();
  }

  async clickStatisticView() {
    await this.assertPage();
    const statisticView = await this._driver.findElement(By.xpath(`//a[text()="[Statistic]"]`));
    await this._driver.actions().scroll(0, 0, 0, 200, statisticView).perform();
    await statisticView.click();
  }

  async clickEditView() {
    await this.assertPage();
    const editView = await this._driver.findElement(By.xpath(`//a[text()="[Edit Blog Detail]"]`));
    await this._driver.actions().scroll(0, 0, 0, 200, editView).perform();
    await editView.click();
  }
}

export default BlogPage;
