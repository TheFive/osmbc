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
function untilStale(element) {
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

  // Waits for the reload of the current page, e.g. after a script that
  // calls location.reload(). The page must have been asserted before the
  // action (every action method starts with assertPage), that is the marker
  // whose disappearance shows the reload.
  async waitForPageReload() {
    assert(this._navbarBrand);
    await this._waitUntilStale(this._navbarBrand, "Page did not reload within 10s");
    await this._waitForNewPage();
  }

  // Click an element that leads to another page. Returns when the new page
  // is loaded, so the next step neither acts on the page being unloaded nor
  // has to wait itself.
  async _clickAndWaitForNavigation(element, useScript = false) {
    if (useScript) {
      await this._driver.executeScript("arguments[0].click();", element);
    } else {
      await element.click();
    }
    await this._waitUntilStale(element, "Click did not lead to a new page within 10s");
    await this._waitForNewPage();
  }

  async _waitUntilStale(element, message = "Element did not disappear within 10s") {
    await this._driver.wait(untilStale(element), 10000, message);
  }

  // The old document is gone - wait until the new one is parsed. Not the
  // navbar: error pages have none. Whether it is the expected page is the
  // next action's assertPage.
  async _waitForNewPage() {
    const driver = this._driver;
    await driver.wait(async function() {
      try {
        return (await driver.executeScript("return document.readyState")) !== "loading";
      } catch (e) {
        // the document is just being replaced
        return false;
      }
    }, 10000, "New page did not load within 10s");
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
