

/* exported highlightWrongLinks */
/* exported chooseLanguage */
/* exported chooseLanguageSet */
/* exported setUserConfig */
/* exported addSpinnerAndSubmit */


function highlightWrongLinks() {
  const object = $(this);
  const list = [];
  const mapping = {};
  if (!window.cacheLink) window.cacheLink = {};

  function collectLinks() {
    const o = $(this);
    const url = o.attr("href");
    // Anchor hrefs are usually just in-page UI (collapse toggles etc.),
    // not worth checking - except our own footnote-anchor convention
    // ("#wn<issue>_<articleId>", e.g. in a Picture caption's "[1]" link),
    // which the server can validate against the database (osmbc's own
    // preview never renders a matching element - only the separate Hugo
    // renderer does - so this can't be checked against the page's DOM).
    if (url.charAt(0) === "#" && !/^#wn\d+_\d+$/i.test(url)) return;
    if (!mapping[url]) mapping[url] = [];
    mapping[url].push(o);
  }
  function collectLinksForPreview() {
    const object = $(this);
    object.find("a").each(collectLinks);
  }

  if (object.attr("id")) object.find("a").each(collectLinks);
  else $(".preview").each(collectLinksForPreview);

  for (const k in mapping) {
    if (!window.cacheLink[k]) list.push(k);
  }

  function setAllLinks() {
    for (const l in mapping) {
      if (window.cacheLink[l] !== "OK") {
        mapping[l].forEach(function(k) {
          k.addClass("osmbc-nonexist");
          k.text(k.text() + " #" + window.cacheLink[l]);
        });
      } else if (l.indexOf("http://") === 0) {
        // A reachable plain-http link is a different thing from a broken
        // one - "insecure" vs. "dead" - and shouldn't compete for the same
        // urgent red as a genuinely broken link (real case: plain http://
        // links show up even in the most recent issues, not just old ones,
        // so this can't be limited by issue age either - it's simply about
        // the link's own protocol, checked live like everything else).
        mapping[l].forEach(function(k) {
          k.addClass("osmbc-insecure");
        });
      }
    }
  }
  if (list.length > 0) {
    $.ajax({
      url: window.htmlroot + "/article/urlexist",
      data: { urls: list },
      dataType: "json",
      traditional: true,
      type: "post",
      success: function(data) {
        if (data) {
          for (const l in data) {
            window.cacheLink[l] = data[l];
          }
          setAllLinks();
        }
      }
    });
  } else {
    setAllLinks();
  }
}


function chooseLanguage(number, lang) {
  const data = {};
  data[number] = lang;
  jQuery.post(window.htmlroot + "/language", data, function () {
    location.reload();
  }).fail(function (err) {
    console.error("Problem changing language " + number + " " + lang);
    console.error(err);
  });
}
function chooseLanguageSet(set, action) {
  const data = {};

  if (action && action === "save") {
    data.action = action;
    data.set = $("input#newSetToBeSaved").val();
  }
  if (action && action === "delete") {
    data.action = action;
    data.set = set;
  }
  if (action && action === "set") {
    data.action = action;
    data.set = set;
  }

  jQuery.post(window.htmlroot + "/languageset", data, function () {
    location.reload();
  }).fail(function (err) {
    console.error("Problem changing language set" + set + " Action " + action);
    console.error(err);
  });
}

function setUserConfig(options) {
  jQuery.post(window.htmlroot + "/setuserconfig/", options, function () {
    location.reload();
  }).fail(function (err) {
    console.error("Trouble saveing User Config");
    console.error(err);
  });
}

function addSpinnerAndSubmit(element) {
  const el = document.querySelector(element);

  el.innerHTML = el.innerHTML + "<i class='fa fa-spinner fa-pulse'></i>";
  el.disabled = true;

  // try to force repaint (safari)
  // https://martinwolf.org/before-2018/blog/2014/06/force-repaint-of-an-element-with-javascript/
  el.style.display = "none";
  el.offsetHeight; // eslint-disable-line no-unused-expressions
  // no need to store this anywhere, the reference is enough
  el.style.display = "block";
  // end of redraw fix

  setTimeout(() => { el.form.submit(); }, 1);
}


