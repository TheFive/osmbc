"use strict";

const should = require("should");

const nock   = require("nock");

const translator = require("../model/translator.js");






describe("model/translator", function() {
  it("should translate a simple text with bing", function (bddone) {
    const originTextMd = "Originaler Text";
    const originTextHtml = "<p>Originaler Text</p>\n";
    const translatedTextHtml = "<p>This is the translated Text<p>\n";
    const translatedTextMd = "This is the translated Text";

    nock("https://api.cognitive.microsofttranslator.com")
      .post("/translate?api-version=3.0&from=en&to=de&textType=html", [{ text: originTextHtml }])
      .reply(200, [{ translations: [{ text: translatedTextHtml }] }]);

    var options = {
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
      .post("/translate?api-version=3.0&from=en&to=de&textType=html", [{ text: originTextHtml }])
      .reply(200, [{ translations: [{ text: translatedTextHtml }] }]);

    var options = {
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
      .post("/translate?api-version=3.0&from=de&to=fr&textType=html", [{ text: originTextHtml }])
      .reply(200, [{ translations: [{ text: translatedTextHtml }] }]);

    var options = {
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
    const originTextHtml = "<p>Originaler Text</p>\n";
    const translatedTextHtml = "<p>This is the translated Text<p>\n";
    const translatedTextMd = "This is the translated Text";

    nock("https://api.deepl.com/v2/usage")
      .get(uri => uri.includes('/v2/translate?auth_key=Test%20Key%20Fake&source_lang=EN&tag_handling=xml&target_lang=DE&text=%3Cp%3EOriginaler%20Text%3C%2Fp%3E%0A'))
      .reply(200, {translations: [{ detected_source_language: "EN",text: translatedTextHtml}]
    });

    var options = {
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

  it("should translate a text with link with deepl", function (bddone) {
    const originTextMd = "Originaler Text mit [Markdown](https://markdown.link/demo) Link";
    const originTextHtml = '<p>Originaler Text mit <a href="https://markdown.link/demo">Markdown</a> Link</p>\n';
    const translatedTextHtml = '<p>Translated Text with <a href="https://markdown.link/demo">Markdown</a> Link</p>\n';
    const translatedTextMd = "Translated Text with [Markdown](https://markdown.link/demo) Link";

    nock("https://api.deepl.com/v2/usage")
      .get(uri => uri.includes("/v2/translate?auth_key=Test%20Key%20Fake&source_lang=EN&tag_handling=xml&target_lang=DE&text=%3Cp%3EOriginaler%20Text%20mit%20%3Ca%20href%3D%22https%3A%2F%2Fmarkdown.link%2Fdemo%22%3EMarkdown%3C%2Fa%3E%20Link%3C%2Fp%3E%0A"))
      .reply(200, {translations: [{ detected_source_language: "EN",text: translatedTextHtml}]
    });

    var options = {
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
    const originTextMd = "Link (automatische [Übersetzung](https://translate.google.com/translate?sl=auto&tl=DE&u=https://forum.openstreetmap.org/viewtopic.php?pid=786827#p786827)) und zweiter LInk (automatische [Übersetzung](https://translate.google.com/translate?sl=auto&tl=DE&u=https://hide.webhop.me/mapsme/daily/))";
    const originTextHtml = '<p>Link (automatische <a href="https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=https://forum.openstreetmap.org/viewtopic.php?pid=786827#p786827">Übersetzung</a>) und zweiter LInk (automatische <a href="https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=https://hide.webhop.me/mapsme/daily/">Übersetzung</a>)</p>\n';
    const translatedTextHtml = '<p>Lien <a href="https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=https://forum.openstreetmap.org/viewtopic.php?pid=786827#p786827">(traduction automatique)</a>et deuxième LInk <a href="https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=https://hide.webhop.me/mapsme/daily/">(traduction automatique)</a></p>\n';
    const translatedTextMd = "Lien [(traduction automatique)](https://translate.google.com/translate?sl=auto&tl=FR&u=https://forum.openstreetmap.org/viewtopic.php?pid=786827#p786827)et deuxième LInk [(traduction automatique)](https://translate.google.com/translate?sl=auto&tl=FR&u=https://hide.webhop.me/mapsme/daily/)";

    nock("https://api.deepl.com/v2/usage")
      .get(uri => uri.includes("/v2/translate?auth_key=Test%20Key%20Fake&source_lang=DE&tag_handling=xml&target_lang=FR&text=%3Cp%3ELink%20%28automatische%20%3Ca%20href%3D%22https%3A%2F%2Ftranslate.google.com%2Ftranslate%3Fsl%3Dauto%26amp%3Btl%3DDE%26amp%3Bu%3Dhttps%3A%2F%2Fforum.openstreetmap.org%2Fviewtopic.php%3Fpid%3D786827%23p786827%22%3E%C3%9Cbersetzung%3C%2Fa%3E%29%20und%20zweiter%20LInk%20%28automatische%20%3Ca%20href%3D%22https%3A%2F%2Ftranslate.google.com%2Ftranslate%3Fsl%3Dauto%26amp%3Btl%3DDE%26amp%3Bu%3Dhttps%3A%2F%2Fhide.webhop.me%2Fmapsme%2Fdaily%2F%22%3E%C3%9Cbersetzung%3C%2Fa%3E%29%3C%2Fp%3E%0A"))
      .reply(200, {translations: [{ detected_source_language: "EN",text: translatedTextHtml}]
    });

    var options = {
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
