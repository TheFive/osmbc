// Browser for the UI tests: starts Chrome via selenium with the settings the
// tests depend on and logs the user in. The page objects in
// test/PageObjectModel operate the pages; nothing here knows about them
// except the login.

import _debug from "debug";
import { execFileSync } from "child_process";

import { Builder, Browser, Condition, WebElementCondition, error as webdriverError } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import portprober from "selenium-webdriver/net/portprober.js";

import LoginPage from "./PageObjectModel/loginPage.js";
import LoginChooserPage from "./PageObjectModel/loginChooserPage.js";
import util from "../util/util.js";

const osmbcLink = util.osmbcLink;
const debug = _debug("OSMBC:test:browser");

function readVersionCommand(command, args = []) {
  try {
    return execFileSync(command, args, { encoding: "utf8" }).trim();
  } catch (_err) {
    return "not found";
  }
}

function readChromeVersion() {
  if (process.platform === "darwin") {
    return readVersionCommand("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--version"]);
  }
  return readVersionCommand("google-chrome", ["--version"]);
}


// where the browser is when a wait times out - is the page still loading,
// an error page, or the page the test expected?
async function describePage(driver) {
  try {
    const url = await driver.getCurrentUrl();
    const state = await driver.executeScript("return document.readyState + ' | ' + document.title + ' | ' + (document.body ? document.body.innerText.slice(0, 200) : '(no body)');");
    return `Page: ${url} | ${String(state).replace(/\s+/g, " ")}`;
  } catch (err) {
    return `Page: not readable (${err.message})`;
  }
}

function useRealTimeWaits(driver) {
  const seleniumWait = driver.wait.bind(driver);
  driver.wait = function(condition, timeout = 0, message = undefined, pollTimeout = 200) {
    if (!timeout || !(condition instanceof Condition || typeof condition === "function")) {
      return seleniumWait(condition, timeout, message, pollTimeout);
    }
    const description = (condition instanceof Condition) ? condition.description() : "condition";
    const fn = (condition instanceof Condition) ? condition.fn : condition;
    let expired = false;
    const timer = setTimeout(function() { expired = true; }, timeout);
    const checkExpired = async function(d) {
      if (expired) {
        const text = (typeof message === "function") ? message() : (message || description);
        throw new webdriverError.TimeoutError(`${text}\nWait timed out after ${timeout}ms\n${await describePage(d)}`);
      }
      return fn(d);
    };
    let wrapped = checkExpired;
    if (condition instanceof WebElementCondition) wrapped = new WebElementCondition(description, checkExpired);
    else if (condition instanceof Condition) wrapped = new Condition(description, checkExpired);
    const result = seleniumWait(wrapped, 0, message, pollTimeout);
    result.then(() => clearTimeout(timer), () => clearTimeout(timer));
    return result;
  };
}

// Devices for getNewDriver(username, { device }). "phone" emulates a
// typical Android phone (most editors use Firefox on Android, the layout
// is the same in Chrome's emulation).
const testDevices = {
  phone: {
    deviceMetrics: { width: 390, height: 844, pixelRatio: 3, touch: true },
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36"
  },
  // the "desktop view" of a phone browser: desktop user agent, ~980px wide,
  // just below Bootstrap's lg breakpoint, on a phone screen (412px)
  desktopView: {
    deviceMetrics: { width: 980, height: 2120, pixelRatio: 1, touch: true },
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
    screen: { width: 412, height: 915 },
    view: "desktop"
  }
};

async function getNewDriver(username, options = {}) {
  const chromeOptions = new chrome.Options();
  const isHeadless = process.env.TEST_HEADLESS === "TRUE";
  const isLinux = process.platform === "linux";

  if (isHeadless) chromeOptions.addArguments("headless=new");
  if (options.device) {
    if (!testDevices[options.device]) throw new Error("Unknown test device " + options.device);
    const { deviceMetrics, userAgent, screen } = testDevices[options.device];
    // mobile emulation always makes the screen as wide as the viewport, a
    // device with its own screen size is set up by DevTools below
    if (screen) chromeOptions.addArguments("user-agent=" + userAgent);
    else chromeOptions.setMobileEmulation({ deviceMetrics, userAgent });
  } else {
    chromeOptions.addArguments("window-size=1920,1080");
  }
  chromeOptions.addArguments("disable-search-engine-choice-screen");
  chromeOptions.addArguments("disable-infobars");

  // try to disable passwort Manager Popup
  // https://stackoverflow.com/questions/69799196/chrome-arguments-to-disable-save-password-prompt
  chromeOptions.addArguments("guest");
  // End try disable passwort Manager Popup

  // Linux CI often needs these flags; on macOS headed mode they can crash renderer startup.
  if (isLinux) {
    chromeOptions.addArguments("no-sandbox");
    chromeOptions.addArguments("disable-dev-shm-usage");
  }
  if (isHeadless && isLinux) {
    chromeOptions.addArguments("disable-gpu");
  }

  // Disable popup dialogs
  chromeOptions.addArguments("disable-blink-features=AutomationControlled");

  // Keep the browser off the internet. Article texts embed images from
  // blog.openstreetmap.de etc.; every click that loads a page waits for
  // them, so a slow external host stalled tests into the mocha timeout.
  // Server-side requests are mocked with nock and not affected.
  chromeOptions.addArguments("host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1");



  // Pick the chromedriver port ourselves on 127.0.0.1. selenium probes a
  // free port on "::" only, which on macOS can hand out a port a Chrome
  // DevTools server already listens on at 127.0.0.1 - the session request
  // then gets an empty 404 ("newSession: ") from Chrome instead of
  // chromedriver.
  const service = new chrome.ServiceBuilder().setPort(await portprober.findFreePort("127.0.0.1"));

  let driver;
  try {
    driver = await new Builder().forBrowser(Browser.CHROME).setChromeOptions(chromeOptions).setChromeService(service).build();
  } catch (err) {
    const diagnostics = [
      `platform=${process.platform}`,
      `arch=${process.arch}`,
      `TEST_HEADLESS=${process.env.TEST_HEADLESS || "unset"}`,
      `chrome=${readChromeVersion()}`,
      `chromedriver=${readVersionCommand("chromedriver", ["--version"])}`
    ].join(", ");

    const webdriverMessage = (err && err.message) ? err.message : String(err);
    const improvedError = new Error(`Failed to create WebDriver (${webdriverMessage}). Diagnostics: ${diagnostics}`);
    console.error(improvedError.message);
    throw improvedError;
  }
  // const driver = await new Builder().forBrowser(Browser.SAFARI).setChromeOptions(chromeOptions).build();
  useRealTimeWaits(driver);
  const device = options.device && testDevices[options.device];
  if (device && device.screen) {
    // a viewport wider than the screen, like a phone browser's desktop view
    await driver.sendDevToolsCommand("Emulation.setDeviceMetricsOverride", {
      width: device.deviceMetrics.width,
      height: device.deviceMetrics.height,
      deviceScaleFactor: device.deviceMetrics.pixelRatio,
      mobile: false,
      screenWidth: device.screen.width,
      screenHeight: device.screen.height
    });
    if (device.deviceMetrics.touch) await driver.sendDevToolsCommand("Emulation.setTouchEmulationEnabled", { enabled: true });
  }
  const loginPage = new LoginPage(driver);
  const loginChooserPage = new LoginChooserPage(driver);
  // pageLoad below the mocha timeout, so a hanging load fails with a stack
  // trace of the step instead of a bare "Timeout of 20000ms exceeded"
  await driver.manage().setTimeouts({ implicit: 700, script: 700, pageLoad: 10000 });
  try {
    await driver.get(osmbcLink("/osmbc"));
    await loginChooserPage.clickHtAccessLogin();



    await loginPage.assertPage();
    await loginPage.typeUsername(username);
    await loginPage.typePassword(username);
    await loginPage.clickOK();
    // set the cookie the layout script would set (small test devices work in
    // mobile mode, one language), so no test waits for its reload
    if (device) await driver.manage().addCookie({ name: "osmbc_view", value: device.view || "mobile", path: "/" });
  } catch (err) {
    console.error(err);
    // Ensure driver is properly closed on error
    if (driver) {
      try {
        await driver.quit();
      } catch (quitErr) {
        console.error("Error quitting driver:", quitErr.message);
      }
    }
    throw err;
  }
  return driver;
}

async function safeQuit(driver) {
  if (!driver) return;
  try {
    await driver.quit();
  } catch (err) {
    const quitMessage = (err && err.message) ? err.message : String(err);
    debug(`safeQuit ignored quit error: ${quitMessage}`);
  }
}

export { getNewDriver, safeQuit };
