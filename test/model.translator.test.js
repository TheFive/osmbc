"use strict";

const should = require("should");

const nock   = require("nock");
const initialize = require("../util/initialise.js");

const translator = require("../model/translator.js");






describe("model/translator", function() {
  before(function(bddone) {
    initialize.initialiseModules(bddone);
  });
  it("should translate a simple text with bing", function (bddone) {
    const originTextMd = "Originaler Text";
    const originTextHtml = "<p>Originaler Text</p>\n";
    const translatedTextHtml = "<p>This is the translated Text<p>\n";
    const translatedTextMd = "This is the translated Text";

    nock("https://api.cognitive.microsofttranslator.com")
      .post("/translate?api-version=3.0&from=EN&to=DE&textType=html", [{ text: originTextHtml }])
      .reply(200, [{ translations: [{ text: translatedTextHtml }] }]);

    const options = {
      fromLang: "en",
      toLang: "de",
      text: originTextMd
    };
    translator.bingPro.translate(options, function(err, result) {
      if (err) return bddone(err);
      should(result).eql(translatedTextMd);
      bddone();
    });
  });
  it("should translate a text with Link with bing", function (bddone) {
    const originTextMd = "Originaler Text mit [Markdown](https://markdown.link/demo) Link";
    const originTextHtml = '<p>Originaler Text mit <a href="https://markdown.link/demo">Markdown</a> Link</p>\n';
    const translatedTextHtml = '<p>Translated Text with <a href="https://markdown.link/demo">Markdown</a> Link</p>\n';
    const translatedTextMd = "Translated Text with [Markdown](https://markdown.link/demo) Link";

    nock("https://api.cognitive.microsofttranslator.com")
      .post("/translate?api-version=3.0&from=EN&to=DE&textType=html", [{ text: originTextHtml }])
      .reply(200, [{ translations: [{ text: translatedTextHtml }] }]);

    const options = {
      fromLang: "en",
      toLang: "de",
      text: originTextMd
    };
    translator.bingPro.translate(options, function(err, result) {
      if (err) return bddone(err);
      should(result).eql(translatedTextMd);
      bddone();
    });
  });
  it("should translate a text with two automatic Links with bing", function (bddone) {
    const originTextMd = "Link (automatische [Übersetzung](https://translate.google.com/translate?sl=auto&tl=DE&u=https://forum.openstreetmap.org/viewtopic.php?pid=786827#p786827)) und zweiter LInk (automatische [Übersetzung](https://translate.google.com/translate?sl=auto&tl=DE&u=https://hide.webhop.me/mapsme/daily/))";
    const originTextHtml = '<p>Link (automatische <a href="https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=https://forum.openstreetmap.org/viewtopic.php?pid=786827#p786827">Übersetzung</a>) und zweiter LInk (automatische <a href="https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=https://hide.webhop.me/mapsme/daily/">Übersetzung</a>)</p>\n';
    const translatedTextHtml = '<p>Lien <a href="https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=https://forum.openstreetmap.org/viewtopic.php?pid=786827#p786827">(traduction automatique)</a>et deuxième LInk <a href="https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=https://hide.webhop.me/mapsme/daily/">(traduction automatique)</a></p>\n';
    const translatedTextMd = "Lien [(traduction automatique)](https://translate.google.com/translate?sl=auto&tl=FR&u=https://forum.openstreetmap.org/viewtopic.php?pid=786827#p786827)et deuxième LInk [(traduction automatique)](https://translate.google.com/translate?sl=auto&tl=FR&u=https://hide.webhop.me/mapsme/daily/)";

    nock("https://api.cognitive.microsofttranslator.com")
      .post("/translate?api-version=3.0&from=DE&to=FR&textType=html", [{ text: originTextHtml }])
      .reply(200, [{ translations: [{ text: translatedTextHtml }] }]);

    const options = {
      fromLang: "de",
      toLang: "fr",
      text: originTextMd
    };
    translator.bingPro.translate(options, function(err, result) {
      if (err) return bddone(err);
      should(result).eql(translatedTextMd);
      bddone();
    });
  });


  it("should translate a simple text with deepl", function (bddone) {
    const originTextMd = "Originaler Text";
    // const originTextHtml = "<p>Originaler Text</p>\n";
    const translatedTextHtml = "<p>This is the translated Text (less formal translated)<p>\n";
    const translatedTextMd = "This is the translated Text (less formal translated)";

    nock("https://api.deepl.com")
      .post("/v2/translate", "auth_key=Test%20Key%20Fake&formality=less&source_lang=EN&tag_handling=xml&target_lang=DE&text=%3Cp%3EOriginaler%20Text%3C%2Fp%3E%0A")
      .reply(200, { translations: [{ detected_source_language: "EN", text: translatedTextHtml }] });

    const options = {
      fromLang: "en",
      toLang: "de",
      text: originTextMd
    };
    translator.deeplPro.translate(options, function(err, result) {
      if (err) return bddone(err);
      should(result).eql(translatedTextMd);
      bddone();
    });
  });

  it("should copy a simple text with copy Function", function (bddone) {
    const originTextMd = "Originaler Text";
    const translatedTextMd = "Originaler Text";


    const options = {
      fromLang: "en",
      toLang: "de",
      text: originTextMd
    };
    translator.copy.translate(options, function(err, result) {
      if (err) return bddone(err);
      should(result).eql(translatedTextMd);
      bddone();
    });
  });


  it("should translate a text with link with deepl", function (bddone) {
    const originTextMd = "Originaler Text mit [Markdown](https://markdown.link/demo) Link";
    // const originTextHtml = '<p>Originaler Text mit <a href="https://markdown.link/demo">Markdown</a> Link</p>\n';
    const translatedTextHtml = '<p>Translated Text with <a href="https://markdown.link/demo">Markdown</a> Link</p>\n';
    const translatedTextMd = "Translated Text with [Markdown](https://markdown.link/demo) Link";

    nock("https://api.deepl.com")


      .post("/v2/translate", "auth_key=Test%20Key%20Fake&formality=less&source_lang=EN&tag_handling=xml&target_lang=DE&text=%3Cp%3EOriginaler%20Text%20mit%20%3Ca%20href%3D%22https%3A%2F%2Fmarkdown.link%2Fdemo%22%3EMarkdown%3C%2Fa%3E%20Link%3C%2Fp%3E%0A")
      .reply(200, { translations: [{ detected_source_language: "EN", text: translatedTextHtml }] });

    const options = {
      fromLang: "en",
      toLang: "de",
      text: originTextMd
    };
    translator.deeplPro.translate(options, function(err, result) {
      if (err) return bddone(err);
      should(result).eql(translatedTextMd);
      bddone();
    });
  });

  it("should translate a text with two automatic Links with deepl", function (bddone) {
    const originTextMd = "Link :RU-s: >>> [:DE-t:](https://forum-openstreetmap-org.translate.goog/viewtopic.php?pid=786827&_x_tr_sl=auto&_x_tr_tl=de&_x_tr_hl=DE) und zweiter LInk :EN-t: >>> [:DE-t:](https://hide-webhop-me.translate.goog/mapsme/daily/?_x_tr_sl=auto&_x_tr_tl=de&_x_tr_hl=DE)";
    // const originTextHtml = '<p>Link <img src="/wp-content/uploads/2020/09/RU-green.svg"> &gt;&gt;&gt; <a href="https://forum-openstreetmap-org.translate.goog/viewtopic.php?pid=786827&amp;_x_tr_sl=auto&amp;_x_tr_tl=de&amp;_x_tr_hl=de"><img src="/wp-content/uploads/2020/09/de-green.svg"></a> und zweiter LInk <img src="/wp-content/uploads/2020/09/en-green.svg"> &gt;&gt;&gt; <a href="https://hide-webhop-me.translate.goog/mapsme/daily/?_x_tr_sl=auto&amp;_x_tr_tl=de&amp;_x_tr_hl=de"><img src="/wp-content/uploads/2020/09/de-green.svg"></a></p>';
    const translatedTextHtml = '<p>Lien <emoji src="RU-s">Picture</emoji> &gt;&gt;&gt; <a href="https://forum-openstreetmap-org.translate.goog/viewtopic.php?pid=786827&amp;_x_tr_sl=auto&amp;_x_tr_tl=de"><emoji src="DE-t">Picture</emoji></a> et deuxième LInk <emoji src="EN-s">Picture</emoji> &gt;&gt;&gt; <a href="https://hide-webhop-me.translate.goog/mapsme/daily/?_x_tr_sl=auto&amp;_x_tr_tl=de"><emoji src="DE-t">Picture</emoji></a></p>';
    const translatedTextMd = "Lien :RU-s: >>> [:FR-t:](https://forum-openstreetmap-org.translate.goog/viewtopic.php?pid=786827&_x_tr_sl=auto&_x_tr_tl=fr) et deuxième LInk :EN-s: >>> [:FR-t:](https://hide-webhop-me.translate.goog/mapsme/daily/?_x_tr_sl=auto&_x_tr_tl=fr)";





    nock("https://api.deepl.com")
      .post("/v2/translate", {
        text: '<p>Link :RU-s: &gt;&gt;&gt; <a href="https://forum-openstreetmap-org.translate.goog/viewtopic.php?pid=786827&amp;_x_tr_sl=auto&amp;_x_tr_tl=de&amp;_x_tr_hl=DE">:DE-t:</a> und zweiter LInk :EN-t: &gt;&gt;&gt; <a href="https://hide-webhop-me.translate.goog/mapsme/daily/?_x_tr_sl=auto&amp;_x_tr_tl=de&amp;_x_tr_hl=DE">:DE-t:</a></p>\n',
        source_lang: "DE",
        target_lang: "FR",
        auth_key: "Test Key Fake",
        tag_handling: "xml"
      }
      )
      .reply(200, { translations: [{ detected_source_language: "EN", text: translatedTextHtml }] });

    const options = {
      fromLang: "de",
      toLang: "fr",
      text: originTextMd
    };
    translator.deeplPro.translate(options, function(err, result) {
      if (err) return bddone(err);
      should(result).eql(translatedTextMd);
      bddone();
    });
  });


  // html translation wiht link deeplPro
  // html translation with automatic translation bing (two links)
  // html translation wiuht automatic tzranslation deeplPro + (two Links)
  // html translation with subscription and picture (bing + deepL)
});
