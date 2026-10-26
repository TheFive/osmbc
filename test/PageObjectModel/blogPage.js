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

  // Close and Did Export ask first
  async #acceptConfirmation() {
    await this._driver.wait(until.alertIsPresent(), 2000, "no confirmation asked");
    await (await this._driver.switchTo().alert()).accept();
  }

  async clickClose(blog, lang) {
    await this.assertPage();
    const closeLang = await this._driver.findElement(By.xpath(`//button[text()="Close ${blog}(${lang})"]`));
    await (closeLang).click();
    await this.#acceptConfirmation();
    await (this._driver.wait(until.stalenessOf(closeLang)));
  }

  // Close, but answer the confirmation with Cancel
  async clickCloseAndCancel(blog, lang) {
    await this.assertPage();
    await (await this._driver.findElement(By.xpath(`//button[text()="Close ${blog}(${lang})"]`))).click();
    await this._driver.wait(until.alertIsPresent(), 2000, "no confirmation asked");
    await (await this._driver.switchTo().alert()).dismiss();
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
    const buttonSelector = `button[id^='reviewButton${lang}']`;

    // reviewButton<lang> is type="submit" inside a plain <form method="post">
    // (see views/blog/blogheader.pug) - this is a real full-page navigation,
    // not an AJAX update. Polling the live DOM for a post-submit content
    // change (as this used to) races the navigation itself: the old DOM can
    // report "gone" while the browser is still mid-navigation, well before
    // the new page has actually loaded - exactly the kind of gap that made
    // the immediately-following page-source comparison in uc.blog.test.js
    // flaky. Wait for staleness of the button instead, the same pattern
    // already used for every other form-submit action in this file.
    const submitButton = await this.#findVisibleElement(buttonSelector);
    await submitButton.click();
    await this._driver.wait(until.stalenessOf(submitButton));
    await this.assertPage();
  }

  async clickDidExport(lang) {
    await this.assertPage();
    await (await this._driver.findElement(By.xpath(`//button[text()="Did Export (${lang})"]`))).click();
    await this.#acceptConfirmation();
  }

  // Small screens (mobile mode)

  // tap the article text: opens its inline editor
  async openInlineEditor(articleId) {
    await this.assertPage();
    await this.tap(await this._driver.findElement(By.css(`[data-inline-editor='div${articleId}']`)));
  }

  async typeInlineText(articleId, ...keys) {
    await (await this._driver.findElement(By.id("markdown" + articleId))).sendKeys(...keys);
  }

  async tapInlineCancel(articleId) {
    await this.tap(await this._driver.findElement(By.id("inlineCancel" + articleId)));
  }

  async tapInlineSave(articleId) {
    await this.tap(await this._driver.findElement(By.id("inlineSave" + articleId)));
  }

  // distance of the article text from the navbar's lower edge, and its flash
  // ("saved", "cancelled" or null)
  // (measured after the navbar has slid in or out, 0.2 s)
  async getArticlePosition(articleId) {
    return this._driver.executeAsyncScript(`
      const done = arguments[arguments.length - 1];
      const text = document.querySelector("[data-inline-editor='div${articleId}']");
      const flash = ["saved", "cancelled"].find(h => text.classList.contains("osmbc-flash-" + h)) || null;
      setTimeout(() => {
        const navbar = document.getElementById("fixedNavbar").getBoundingClientRect();
        done({ belowNavbar: Math.round(text.getBoundingClientRect().top - Math.max(0, navbar.bottom)), flash: flash });
      }, 400);`);
  }

  async scrollToEnd() {
    await this._driver.executeScript("window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });");
  }

  async isBackToTopShown() {
    const buttons = await this._driver.findElements(By.id("toTop"));
    return buttons.length > 0 && buttons[0].isDisplayed();
  }

  // returns the scroll position afterwards
  async tapBackToTop() {
    await this.tap(await this._driver.findElement(By.id("toTop")));
    return this._driver.executeScript("return window.scrollY;");
  }

  // "Save", or "Open Editor" while the article has no text
  async getInlineSaveLabel(articleId) {
    return (await this._driver.findElement(By.id("inlineSave" + articleId))).getText();
  }

  // the Save button labelled "Open Editor": opens the article page
  async clickInlineOpenEditor(articleId) {
    const button = await this._driver.findElement(By.id("inlineSave" + articleId));
    await this.tap(button);
    await this._driver.wait(until.stalenessOf(button), 5000, "article page not opened");
  }

  // the article text as shown in the review view (tap target of the editor)
  async getArticleText(articleId) {
    return (await this._driver.findElement(By.id("preview" + articleId))).getText();
  }

  // vertical centres of the comment icons, the votes and the open button
  // above an article (mobile mode), to check they sit in one line
  async getArticleBarCentres(articleId) {
    return this._driver.executeScript(`
      const open = document.querySelector("a.osmbc-article-open[href$='/article/${articleId}']");
      const bar = open.closest(".osmbc-article-bar");
      return [bar.querySelector(".osmbc-article-comments"), document.getElementById("voteLabels${articleId}"), open]
        .map(e => { const r = e.getBoundingClientRect(); return Math.round(r.top + r.height / 2); });`);
  }

  async getCommentLink(articleId) {
    const open = await this._driver.findElement(By.css(`a.osmbc-article-open[href$='/article/${articleId}']`));
    const bar = await open.findElement(By.xpath("ancestor::*[contains(@class,'osmbc-article-bar')]"));
    return (await bar.findElement(By.css("a.osmbc-article-comments"))).getAttribute("href");
  }

  // "Display Votes" option of the view; the page reloads with the votes
  async clickShowVoteCheckbox(vote) {
    const selector = `div[name="choose_showVote_${vote}"]`;
    const before = await this._driver.findElement(By.css(selector));
    await this.#clickACheckbox(selector);
    await this._driver.wait(until.stalenessOf(before), 5000, "page not reloaded");
  }

  // vote label of an article (chosen under "Display Votes"); waits for the redraw
  async tapVoteLabel(articleId, vote) {
    await this.assertPage();
    const label = await this._driver.findElement(By.id(`vote_${vote}_${articleId}`));
    await this.tap(label);
    await this._driver.wait(until.stalenessOf(label), 3000, "vote label not redrawn");
  }

  // the button at the end of the article's row
  async clickOpenArticle(articleId) {
    await this.assertPage();
    await this.tap(await this._driver.findElement(By.css(`a.osmbc-article-open[href$='/article/${articleId}']`)));
  }

  // edit button of an own review comment (n-th comment of the language)
  async clickEditReviewComment(lang, n) {
    await this.assertPage();
    await this.tap(await this._driver.findElement(By.css(`[data-edit-review='${lang}${n}']`)));
    await this._driver.wait(until.elementIsVisible(await this._driver.findElement(By.id(`reviewComment${lang}${n}`))), 2000, "edit form not shown");
  }

  async clickStopReview(lang) {
    await this.assertPage();
    const button = await this._driver.findElement(By.id("reviewButtonCancel" + lang));
    await this.tap(button);
    await this._driver.wait(until.stalenessOf(button), 3000, "page not reloaded");
  }

  async isExportMenuShown() {
    return (await this._driver.findElements(By.id("dropdownExportLanguages"))).length > 0;
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

  // inline editors save in the background and show "saved" when done
  async waitForInlineSaved() {
    await this._driver.wait(until.elementLocated(By.xpath("//span[contains(@id,'saveStatus') and normalize-space(.)='saved']")), 5000);
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
