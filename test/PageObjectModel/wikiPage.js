import { By, Key, until } from "selenium-webdriver";

import StandardPage from "./standardPage.js";
import { cmdCtrl } from "./page.js";

// All wiki pages (index, page, editor, history, diff, search). The actions
// tap (instant scroll, then click), so they work on desktop and phones.
export default class WikiPage extends StandardPage {
  async assertPage() {
    await super.assertPage();
    await this._driver.wait(until.elementLocated(By.css(".osmbc-wiki")), 10000, "not a wiki page");
  }

  async _find(css) {
    return this._driver.findElement(By.css(css));
  }

  async _exists(css) {
    return (await this._driver.findElements(By.css(css))).length > 0;
  }

  async _tapNavigate(css) {
    await this.assertPage();
    await this._tapAndWaitForNavigation(await this._find(css));
  }

  // ---- index and search ---------------------------------------------------

  async getIndexPageIds() {
    await this.assertPage();
    return this._driver.executeScript("return [...document.querySelectorAll('.osmbc-wiki section li span.text-muted')].map(e => e.textContent.trim());");
  }

  async search(query) {
    await this.assertPage();
    const field = await this._find("form.osmbc-wiki-search input[name=q]");
    await this.tap(field);
    await field.sendKeys(Key.chord(cmdCtrl, "a"), query);
    await this._tapAndWaitForNavigation(await this._find("form.osmbc-wiki-search button[type=submit]"));
  }

  // page ids found in the text and in the page names
  async getSearchResultIds() {
    await this.assertPage();
    return this._driver.executeScript("return [...document.querySelectorAll('#wikiSearchResults > li > span.text-muted, #wikiSearchNames > li > span.text-muted')].map(e => e.textContent.trim());");
  }

  async clickNewPage(id) {
    await this.assertPage();
    const field = await this._find("#wikiNewPage input[name=id]");
    await this.tap(field);
    await field.sendKeys(id);
    await this._tapAndWaitForNavigation(await this._find("#wikiNewPage button[type=submit]"));
  }

  // ---- page view ------------------------------------------------------------

  async getContentText() {
    await this.assertPage();
    return (await this._find("#wikiContent")).getText();
  }

  // { text, href, missing } of the links in the page content
  async getContentLinks() {
    await this.assertPage();
    return this._driver.executeScript("return [...document.querySelectorAll('#wikiContent a')].map(a => ({ text: a.textContent, href: a.getAttribute('href'), missing: a.classList.contains('osmbc-wiki-missing') }));");
  }

  // the images in the page content have loaded
  async getLoadedImages() {
    await this.assertPage();
    const driver = this._driver;
    await driver.wait(() => driver.executeScript("return [...document.querySelectorAll('#wikiContent img')].every(i => i.complete);"), 5000, "images did not load");
    return driver.executeScript("return [...document.querySelectorAll('#wikiContent img')].filter(i => i.naturalWidth > 0).map(i => i.getAttribute('src'));");
  }

  async isSavedShown() {
    await this.assertPage();
    return this._exists("#wikiSaved");
  }

  async getSidebarText() {
    await this.assertPage();
    return (await this._find(".osmbc-wiki-sidebar")).getText();
  }

  async clickContentLink(text) {
    await this.assertPage();
    await this._tapAndWaitForNavigation(await this._driver.findElement(By.xpath("//*[@id='wikiContent']//a[normalize-space()=" + JSON.stringify(text) + "]")));
  }

  async clickEdit() { await this._tapNavigate("#wikiEdit"); }
  async clickHistory() { await this._tapNavigate("#wikiHistory"); }
  async clickCreate() { await this._tapNavigate("#wikiCreate"); }

  // the page's action buttons (for tap target checks)
  static get actionButtons() { return "#wikiHistory, #wikiMore, #wikiEdit"; }

  // ---- editor ------------------------------------------------------------------

  async setMarkdown(text) {
    await this.assertPage();
    const field = await this._find("#wikiMarkdown");
    await this.tap(field);
    // select all and type: clear() would fire change (see ui-guidelines)
    await field.sendKeys(Key.chord(cmdCtrl, "a"), Key.DELETE, text);
  }

  async getMarkdown() {
    await this.assertPage();
    return (await this._find("#wikiMarkdown")).getAttribute("value");
  }

  async getSaveState() {
    return (await this._find("#wikiSaveState")).getText();
  }

  // waits until the preview shows `text`, returns the preview's HTML
  async waitForPreview(text) {
    const preview = await this._find("#wikiPreview");
    await this._driver.wait(async () => (await preview.getText()).includes(text), 5000, "preview does not show " + text);
    return preview.getAttribute("innerHTML");
  }

  async uploadImage(filePath) {
    await this.assertPage();
    await (await this._find("#wikiUpload")).sendKeys(filePath);
    const state = await this._find("#wikiUploadState");
    await this._driver.wait(async () => /^Uploaded |failed|not|Too large|Invalid/.test(await state.getText()), 10000, "upload did not finish");
    return state.getText();
  }

  async clickSave() { await this._tapNavigate("#wikiSave"); }
  async clickCancel() { await this._tapNavigate("#wikiCancel"); }

  static get editorButtons() { return "#wikiCancel, #wikiSave, label[for=wikiUpload]"; }

  // the save bar is on the screen without scrolling to the end of the form
  async isSaveButtonOnScreen() {
    return this._driver.executeScript("const r = document.getElementById('wikiSave').getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight;");
  }

  async isConflictShown() {
    await this.assertPage();
    return this._exists("#wikiConflict");
  }

  // ---- history and diff -----------------------------------------------------------

  // [{ author, message }] newest first
  async getHistory() {
    await this.assertPage();
    return this._driver.executeScript("return [...document.querySelectorAll('#wikiHistoryTable tbody tr')].map(tr => ({ author: tr.cells[1].textContent.trim(), message: tr.cells[2].textContent.trim() }));");
  }

  async clickChangesOfVersion(index) {
    await this.assertPage();
    const rows = await this._driver.findElements(By.css("#wikiHistoryTable tbody tr"));
    await this._tapAndWaitForNavigation(await rows[index].findElement(By.xpath(".//a[normalize-space()='Changes']")));
  }

  async clickViewVersion(index) {
    await this.assertPage();
    const rows = await this._driver.findElements(By.css("#wikiHistoryTable tbody tr"));
    await this._tapAndWaitForNavigation(await rows[index].findElement(By.xpath(".//a[normalize-space()='View']")));
  }

  // { added: [lines], removed: [lines] }
  async getDiff() {
    await this.assertPage();
    return this._driver.executeScript(`
      const lines = (cls) => [...document.querySelectorAll('#wikiDiff .' + cls)].map(e => e.textContent.substring(2));
      return { added: lines('osmbc-wiki-diff-added'), removed: lines('osmbc-wiki-diff-removed') };`);
  }

  async clickRestore() { await this._tapNavigate("#wikiRestore"); }
}
