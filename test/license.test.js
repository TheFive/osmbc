
import {init} from "license-checker-rseidelsohn";
import should from "should";
import path from "path";
import config from "../config.js";

const licenses = {
  "string-hash@1.1.0": "CC0",
  "cycle@1.0.3": "Public Domain",
  "pkginfo@0.2.3": "MIT",
  "uglify-js@2.2.5": "BSD-2-Clause",
  "vow-fs@0.3.1": "MIT",
  "vow@0.4.3": "MIT",
  "tweetnacl@0.14.3": "Unlicense",
  "colors@0.6.2": "MIT"

};


function buildLicenseObject(object, cb) {
  const usedLicenses = object;
  const callback = cb;
  return function buildLicenseObject(err, json) {
    should.not.exist(err);
    for (const k in json) {
      if (k === "osmbc@0.0.0") continue;
      if ((k === "caniuse-lite@1.0.30001507") || (k === "caniuse-lite@1.0.30001676")) {
        // currently (jul 23) caniuse is only used in DEV for ladjs, which should be allowed to use
        json[k] = "only-used-in-dev-branch-ladjs";
        continue;
      }
      // License not give, so please overwrite with manual capturet licenses
      if (json[k].licenses === "UNKNOWN" && licenses[k]) {
        json[k].licenses = licenses[k];
      }

      // Check, wether there is a manual overwrite for the license
      if (licenses[k]) {
        json[k].licenses = licenses[k];
      }
      const l = json[k].licenses;
      const pl = k + " License(" + json[k].licenses + ")";
      if (Array.isArray(l)) {
        l.forEach(function (license) {
          usedLicenses[license] = pl;
        });
      } else {
        usedLicenses[l] = pl;
      }
    }
    callback();
  };
}

const allowedLicensesProd = [
  "only-used-in-dev-branch-ladjs",
  "MIT",
  "MIT*",
  "MIT-0",
  "(MIT AND CC-BY-3.0)",
  "MIT (http://mootools.net/license.txt)",
  "WTFPL",
  "Artistic-2.0",
  "(MIT AND JSON)",
  "(MIT OR CC0-1.0)",
  "(WTFPL OR MIT)",
  "Apache License, Version 2.0",
  "Public Domain",
  "Public domain",
  "CC0",
  "CC0-1.0",
  "Unlicense",
  "ISC",
  "(BSD-2-Clause OR MIT)",
  "BSD-3-Clause AND MIT",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BSD-3-Clause OR MIT",
  "BSD-4-Clause",
  "AFLv2.1",
  "BSD",
  "BSD-like",
  "BSD",
  "BSD*",
  "0BSD",
  "MIT/X11",
  "Apache-2.0",
  "Apache 2.0",
  "Apache*",
  "LAGPL",
  "(LGPL-2.0 OR MIT)",
  "Python-2.0",
  "(Unlicense OR Apache-2.0)",
  "(OFL-1.1 AND MIT)",
  "(MIT OR EUPL-1.1+)",
  "(AFL-2.1 OR BSD-3-Clause)",
  "Unicode-DFS-2016",
  "WTFPL OR ISC", "(BSD-2-Clause OR MIT OR Apache-2.0)",
  "BlueOak-1.0.0"];

const allowedLicensesDev = allowedLicensesProd.concat([
  "LGPL-2.1+", "CC-BY-3.0", "LGPL", "CC-BY-4.0", "(MIT OR GPL-3.0-or-later)", "(MIT AND Zlib)"
]);

function shouldNotUseGPL(usedLicenses) {
  should.not.exist(usedLicenses.GPL);
  should.not.exist(usedLicenses.GNUP);
  // EUPL is a GNU compatible license, so will not be used
  should.not.exist(usedLicenses["EUPL-1.1"]);
  should.not.exist(usedLicenses["LGPL-2.1+"]);
}

describe("license-check", function() {
  this.timeout(10000);
  describe("license-check-Production", function() {
    const usedLicenses = {};
    before(function(bddone) {
      init({
        production: true,
        start: path.join(config.getDirName())
      }, buildLicenseObject(usedLicenses, bddone));
    });
    it("should not use GPL", function(bddone) {
      shouldNotUseGPL(usedLicenses);
      bddone();
    });
    it("should have checked all licenses", function(bddone) {
      allowedLicensesProd.forEach(function(l) {
        delete usedLicenses[l];
      });
      should(usedLicenses).eql({});
      bddone();
    });
  });

  describe("license-check-development", function() {
    const usedLicenses = {};
    before(function(bddone) {
      init({
        development: true,
        start: path.join(config.getDirName())
      }, buildLicenseObject(usedLicenses, bddone));
    });
    it("should have checked all licenses", function(bddone) {
      allowedLicensesDev.forEach(function(l) {
        delete usedLicenses[l];
      });
      should(usedLicenses).eql({});
      bddone();
    });
  });
});
