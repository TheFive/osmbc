"use strict";
var checker = require('license-checker');
var should = require('should');
var path = require('path');

let licenses= {
  "string-hash@1.1.0": "CC0",
  "cycle@1.0.3": "Public Domain",
  "pkginfo@0.2.3": "MIT",
  "uglify-js@2.2.5": "BSD-2-Clause",
  "vow-fs@0.3.1": "MIT",
  "vow@0.4.3": "MIT",
  "tweetnacl@0.14.3" : "Unlicense",
  "colors@0.6.2":"MIT",
  "domcompare@0.2.3":"MIT",
  "xmldom@0.1.16":"MIT",
  "xmldom@0.1.27":"MIT"
};


function buildLicenseObject(object,cb) {
  let usedLicenses = object;
  let callback = cb;
  return function buildLicenseObject(err,json) {
    should.not.exist(err);
    for (let k in json) {
      if (k==="osmbc@0.0.0") continue;
      // License not give, so please overwrite with manual capturet licenses
      if (json[k].licenses === "UNKNOWN" && licenses[k]) {
        json[k].licenses = licenses[k];
      }
      // Check, wether there is a manual overwrite for the license
      if (licenses[k]) {
        json[k].licenses = licenses[k];
      }
      let l = json[k].licenses;
      let pl = k + " License(" + json[k].licenses + ")";
      if (Array.isArray(l)) {
        l.forEach(function (license) { // jshint ignore:line
          usedLicenses[license] = pl;
        });
      } else {
        usedLicenses[l] = pl;
      }
    }
    callback();
  };
}

let allowedLicensesProd = ["MIT",
  "MIT*",
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
  'AFLv2.1',
  'BSD' ,
  "BSD-like",
  "BSD",
  "BSD*",
  "0BSD",
  "MIT/X11",
  "Apache-2.0",
  "Apache*",
  "LAGPL",
  "(Unlicense OR Apache-2.0)",
  "(OFL-1.1 AND MIT)",
  "(MIT OR EUPL-1.1+)"];

let allowedLicensesDev = allowedLicensesProd.concat([
  "LGPL-2.1+","CC-BY-3.0","LGPL"
]);

function shouldNotUseGPL(usedLicenses){
  should.not.exist(usedLicenses.GPL);
  should.not.exist(usedLicenses.GNUP);
  //EUPL is a GNU compatible license, so will not be used
  should.not.exist(usedLicenses["EUPL-1.1"]);
  should.not.exist(usedLicenses["LGPL-2.1+"]);
}

describe("license-check",function(){
  this.timeout(10000);
  describe("license-check-Production", function() {
    let usedLicenses = {};
    before(function(bddone) {
      checker.init({
        production:true,
        start: path.join(__dirname, "..")
      }, buildLicenseObject(usedLicenses,bddone));
    });
    it('should not use GPL',function(bddone){
      shouldNotUseGPL(usedLicenses);
      bddone();
    });
    it('should have checked all licenses',function(bddone){
      allowedLicensesProd.forEach(function(l){
        delete usedLicenses[l];
      });
      should(usedLicenses).eql({});
      bddone();
    });
  });

  describe("license-check-development", function() {
    let usedLicenses = {};
    before(function(bddone) {
      checker.init({
        development:true,
        start: path.join(__dirname, "..")
      }, buildLicenseObject(usedLicenses,bddone));
    });
    it('should have checked all licenses',function(bddone){
      allowedLicensesDev.forEach(function(l){
        delete usedLicenses[l];
      });
      should(usedLicenses).eql({});
      bddone();
    });
  });
});
