"use strict";
var checker = require('license-checker');
var should = require('should');
var path = require('path');
var moment = require('moment');

let licenses= {
  "string-hash@1.1.0": "CC0",
  "cycle@1.0.3": "Public Domain",
  "pkginfo@0.2.3": "MIT",
  "uglify-js@2.2.5": "BSD-2-Clause",
  "vow-fs@0.3.1": "MIT",
  "vow@0.4.3": "MIT",
  "tweetnacl@0.14.3" : "Unlicense"
};



describe("license-check", function() {
  let usedLicenses = {};
  before(function(bddone) {
    this.timeout(4000);
    checker.init({
      start: path.join(__dirname, "..")
    }, function (err, json) {
      should.not.exist(err);
      for (let k in json) {
        if (k==="mdfigcaption@0.1.1" && moment().isBefore(moment("2017-06-01"))) continue;
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
      bddone();
    });
  });
  it('should not use GPL',function(bddone){
    should.not.exist(usedLicenses.GPL);
    should.not.exist(usedLicenses.GNUP);
    //EUPL is a GNU compatible license, so will not be used
    should.not.exist(usedLicenses["EUPL-1.1"]);
    bddone();
  });
  it('should have checked all licenses',function(bddone){
    ["MIT",
      "MIT*",
      "(MIT AND CC-BY-3.0)",
      "MIT (http://mootools.net/license.txt)",
      "WTFPL",
      "Artistic-2.0",
      "(MIT AND JSON)",
      "(WTFPL OR MIT)",
      "Apache License, Version 2.0",
      "Public Domain",
      "Public domain",
      "CC0",
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
      "MIT/X11",
      "Apache-2.0",
      "Apache*"].forEach(function(l){
      delete usedLicenses[l];
    });
    should(usedLicenses).eql({});
    bddone();
  });
});




