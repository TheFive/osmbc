import should from "should";
import assert from "node:assert/strict";

import { Key, By, until, Condition, error as webdriverError } from "selenium-webdriver";

// Modifier for clipboard/select-all shortcuts: Command on macOS, Control
// elsewhere (e.g. Linux on GitHub Actions). The browser runs on the same
// machine as the tests, so the Node platform decides.
export const cmdCtrl = process.platform === "darwin" ? Key.COMMAND : Key.CONTROL;

// until.stalenessOf, but also counts chromedriver's "Node with given id does
// not belong to the document" as stale: while the old document is being
// replaced, chromedriver sometimes answers that (500) instead of a stale
// element error (404), and until.stalenessOf throws it.
export function untilStale(element) {
  return new Condition("element to become stale", async function() {
    try {
      await element.getTagName();
      return false;
    } catch (e) {
      if (e instanceof webdriverError.StaleElementReferenceError) return true;
      if (e instanceof webdriverError.WebDriverError && /does not belong to the document/.test(e.message)) return true;
      throw e;
    }
  });
}

export default class Page {
  constructor(driver) {
    this._driver = driver;
    this._navbarBrand = null;
  }

  async assertPage() {
    // A preceding action may still be mid-navigation (old DOM gone, new one
    // not rendered yet) - poll instead of a single findElement, or a slow
    // page load races this into a spurious NoSuchElementError.
    this._navbarBrand = await this._driver.wait(until.elementLocated(By.css("a.navbar-brand")), 10000);
  }

  async waitForPageReload() {
    // check that old marker is set
    assert(this._navbarBrand);
    // wait for Old Marker to be obsolete. Own timeout, so a lost click fails
    // here with a clear message instead of running into the mocha timeout.
    await this._driver.wait(untilStale(this._navbarBrand), 10000, "Page did not reload within 10s");
    // the old DOM is gone, wait for the new page and remember its marker, so
    // a second waitForPageReload does not return on the already stale one.
    // Not this.assertPage(): the reload may lead to another page type
    // (e.g. admin -> create user). 10 s: saving and rendering the big blog
    // pages took longer than 5 s under load.
    this._navbarBrand = await this._driver.wait(until.elementLocated(By.css("a.navbar-brand")), 10000);
  }



  // Click an element that leads to another page and wait until the old page
  // is gone, so the next step does not act on the page being unloaded.
  // Leaves the reload marker alone: a following waitForPageReload() still
  // returns as soon as the new page is there.
  async _clickAndWaitForNavigation(element, useScript = false) {
    if (useScript) {
      await this._driver.executeScript("arguments[0].click();", element);
    } else {
      await element.click();
    }
    await this._driver.wait(untilStale(element), 10000, "Click did not lead to a new page within 10s");
  }

  async _checkUrl(url) {
    return (await this._driver.getCurrentUrl() === url);
  }

  async _assertUrl(url) {
    if (typeof url === "string") {
      should(await this._driver.getCurrentUrl()).eql(url);
    } else {
      should(url).containEql(await this._driver.getCurrentUrl());
    }
  }

  async _assertUrlStartsWith(url) {
    const myUrl = await this._driver.getCurrentUrl();
    if (typeof url === "string") url = [url];
    assert(url.some(u => myUrl.startsWith(u)), `URL ${myUrl} does not start with ${url.join(" or ")}`);
  }

  // to go to a URL
  async open (path) {
    return await this._driver.get(path);
  }

  async getCtrlA() {
    return Key.chord(cmdCtrl, "a");
  }

  async selectTextInField(field, from, to) {
    await field.sendKeys(this.getCtrlA());
    await field.sendKeys(Key.ARROW_LEFT);
    for (let i = 0; i < from; i++) {
      await field.sendKeys(Key.ARROW_RIGHT);
    }
    for (let i = from; i < to; i++) {
      await field.sendKeys(Key.chord(Key.SHIFT, Key.ARROW_RIGHT));
    }
  }

  async scrollIntoView(object) {
    await this._driver.actions().move({ origin: object }).perform();
  }

  async _waitForBootstrapOverlaysToDisappear() {
    // Prüfe auf mögliche Overlays (z. B. Bootstrap-Modal oder Dropdown) und warte, bis sie verschwinden
    try {
      // querySelectorAll instead of findElements: findElements waits the
      // full implicit timeout when (as usual) there is no overlay at all
      const overlays = await this._driver.executeScript("return Array.from(document.querySelectorAll('.modal-backdrop, .dropdown-menu.show, .offcanvas.show'));");
      for (const overlay of overlays) {
        await this._driver.wait(untilStale(overlay), 2000); // Warte bis zu 2s pro Overlay
      }
    } catch (e) {
      // Keine Overlays gefunden, weiter
    }
  }
};
