"use strict;";

import { By, until, error as webdriverError } from "selenium-webdriver";
import util from "../../util/util.js";
import StandardPage from "./standardPage.js";
import should from "should";


const osmbcLink = util.osmbcLink;



class BlogPage extends StandardPage {
  // eslint-disable-next-line no-useless-constructor
  constructor(driver) {
    super(driver);
  }

  async #findVisibleElement(selector) {
    const elements = await this._driver.findElements(By.css(selector));
    for (const element of elements) {
      try {
        if (await element.isDisplayed()) return element;
      } catch (e) {
        // ignore stale/non-interactable candidates while searching
      }
    }
    if (elements.length > 0) return elements[0];
    throw new Error(`No element found for selector: ${selector}`);
  }

  async assertPage() {
    await super.assertPage();
    await this._assertUrlStartsWith(osmbcLink("/blog"));
  }

  async clickEditBlogDetail() {
    await this.assertPage();
    const clickEditBlogDetail = await this._driver.findElement(By.id("editBlogDetail"));
    await this.scrollIntoView(clickEditBlogDetail);
    await this._waitForBootstrapOverlaysToDisappear();
    // await this._driver.wait(until.elementIsVisible(clickEditBlogDetail)); // Warte auf Sichtbarkeit
    // await this._driver.wait(until.elementIsEnabled(clickEditBlogDetail)); // Zusätzlich: Warte auf Aktivierung
    await clickEditBlogDetail.click();
    // await this._driver.executeScript("arguments[0].click();", clickEditBlogDetail); // JavaScript-Klick als Fallback
    await this._driver.wait(until.stalenessOf(clickEditBlogDetail)); // Warte, bis das Element nicht mehr im DOM ist
  }

  async clickReadyReview(blog, lang) {
    await this.assertPage();
    await (await this._driver.findElement(By.xpath(`//button[text()="Set ${blog}(${lang}) ready for review"]`))).click();
  }

  async clickClose(blog, lang) {
    await this.assertPage();
    const closeLang = await this._driver.findElement(By.xpath(`//button[text()="Close ${blog}(${lang})"]`));
    await (closeLang).click();
    await (this._driver.wait(until.stalenessOf(closeLang)));
  }

  async clickStartPersonalReview(lang) {
    await this.assertPage();
    const button = await this.#findVisibleElement(`button[id^='reviewButton${lang}']`);
    await this.scrollIntoView(button);
    await this._waitForBootstrapOverlaysToDisappear();
    await button.click();
    await this._driver.wait(async () => {
      const field = await this.#findVisibleElement(`textarea[id^='reviewComment${lang}']`).catch(() => null);
      return !!field;
    }, 1500, `Review textarea not visible for ${lang}`);
  }

  async typeReviewText(lang, text) {
    await this.assertPage();
    const textarea = await this.#findVisibleElement(`textarea[id^='reviewComment${lang}']`);
    await this._driver.wait(until.elementIsVisible(textarea), 1500);
    await this.scrollIntoView(textarea);
    await textarea.sendKeys(text);
  }

  async #clickACheckbox(checkboxName) {
    await this.assertPage();

    await this._driver.wait(until.elementLocated(By.css(checkboxName)), 5000);

    for (let attempt = 0; attempt < 2; attempt++) {
      const checkbox = await this._driver.findElement(By.css(checkboxName));
      await this.scrollIntoView(checkbox);
      await this._waitForBootstrapOverlaysToDisappear();

      try {
        await checkbox.click();
        return;
      } catch (e) {
        if (!(e instanceof webdriverError.ElementClickInterceptedError) || attempt === 1) {
          throw e;
        }
        await this._driver.sleep(150);
      }
    }
  }

  async clickStoreReviewText(lang) {
    await this.assertPage();
    const commentSelector = `textarea[id^='reviewComment${lang}']`;
    const buttonSelector = `button[id^='reviewButton${lang}']`;

    const submitButton = await this.#findVisibleElement(buttonSelector);
    await submitButton.click();

    // After submit we either return to "Start Personal Review" or the comment textarea disappears.
    await this._driver.wait(async () => {
      const commentFields = await this._driver.findElements(By.css(commentSelector));
      if (commentFields.length === 0) return true;

      const isDisplayed = await commentFields[0].isDisplayed().catch(() => false);
      if (!isDisplayed) return true;

      const buttons = await this._driver.findElements(By.css(buttonSelector));
      if (buttons.length === 0) return false;

      const buttonText = ((await buttons[0].getText()) || "").toLowerCase();
      return buttonText.includes("start personal review");
    }, 2000, `Review submit not completed for language ${lang}`);
  }

  async clickDidExport(lang) {
    await this.assertPage();
    await (await this._driver.findElement(By.xpath(`//button[text()="Did Export (${lang})"]`))).click();
  }

  async clickShowNumbersCheckbox() {
    await this.assertPage();
    await this.#clickACheckbox('div[name="choose_showNumbers"]');
  }

  async clickShowMailCheckbox() {
    await this.assertPage();
    await this.#clickACheckbox('div[name="choose_showMail"]');
  }

  async clickShowCollectorCheckbox() {
    await this.assertPage();
    await this.#clickACheckbox('div[name="choose_showCollector"]');
  }

  async clickShowEditorCheckbox() {
    await this.assertPage();
    await this.#clickACheckbox('div[name="choose_showEditor"]');
  }

  async clickShowColoredUserCheckbox() {
    await this.assertPage();
    await this.#clickACheckbox('div[name="choose_showColoredUser"]');
  }

  async clickShowVisibleLanguagesCheckbox() {
    await this.assertPage();
    await this.#clickACheckbox('div[name="choose_showVisibleLanguages"]');
  }

  async clickShowLanguagesCheckbox() {
    await this.assertPage();
    await this.#clickACheckbox('div[name="choose_showLanguages"]');
  }

  async clickOnArticle(articleText) {
    await this.assertPage();
    const articleXpath = `//li[text()[contains(.,'${articleText}')]]`;

    for (let attempt = 0; attempt < 2; attempt++) {
      const articleElement = await this._driver.findElement(By.xpath(articleXpath));
      await this.scrollIntoView(articleElement);
      await this._waitForBootstrapOverlaysToDisappear();

      try {
        await articleElement.click();
        return;
      } catch (e) {
        if (!(e instanceof webdriverError.ElementClickInterceptedError) || attempt === 1) {
          throw e;
        }
        // Manche Reflows nach Bootstrap-Updates überlagern den ersten Klick kurzzeitig.
        await this._driver.sleep(150);
      }
    }
  }

  async isMode(mode) {
    await this.assertPage();
    const modeTab = await this._driver.findElement(By.xpath(`//a[contains(@class,'nav-link') and normalize-space(.)='${mode}']`));
    const classAttrib = await modeTab.getAttribute("class");
    return classAttrib.includes("active");
  }

  async typeEditForm(articleShown, newArticleText) {
    await this.assertPage();
    const editForm = await this.getEditForm(articleShown);
    await this._driver.wait(until.elementIsEnabled(editForm), 1000);
    await this.scrollIntoView(editForm);
    await this._driver.wait(until.elementIsVisible(editForm), 1000);

    should(await editForm.isDisplayed()).be.true();
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
    return editForm;
  }

  async getEditFormContent(articleShown) {
    await this.assertPage();
    const editForm = await this.getEditForm(articleShown);
    return await editForm.getAttribute("innerHTML");
  }

  async cickMode(mode) {
    await this.assertPage();
    const fullTab = await this._driver.findElement(By.xpath(`//a[contains(@class,'nav-link') and normalize-space(.)='${mode}']`));
    await this.scrollIntoView(fullTab);
    await (fullTab).click();
  }

  async clickStatisticView() {
    await this.assertPage();
    const statisticView = await this._driver.findElement(By.xpath(`//a[text()="[Statistic]"]`));
    await this._waitForBootstrapOverlaysToDisappear();
    await this._driver.executeScript("arguments[0].click();", statisticView);
  }

  async clickEditView() {
    await this.assertPage();
    const editView = await this._driver.findElement(By.xpath(`//a[text()="[Edit Blog Detail]"]`));
    await this._waitForBootstrapOverlaysToDisappear();
    await this._driver.executeScript("arguments[0].click();", editView);
  }

  async triggerOnChange(articleShown) {
    const input = await this.getEditForm(articleShown);
    await this._driver.executeScript("const changeEvent = new Event('change');arguments[0].dispatchEvent(changeEvent);", input);
  }
}

export default BlogPage;
