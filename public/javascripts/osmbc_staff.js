

/* exported highlightWrongLinks */
/* exported chooseLanguage */
/* exported chooseLanguageSet */
/* exported setUserConfig */
/* exported addSpinnerAndSubmit */
/* exported fitToContentIn */


// Link check for #linkArea and the .preview elements.
// The previews fire "change" on every keyup, so the check waits until
// changes pause, then sends all unknown links of the page in one request.
// Links already requested are not requested again while waiting for the
// answer, so several previews firing at once share one request.
const LINK_CHECK_DELAY_MS = 500;
const pendingLinks = new Set();
let linkCheckTimer = null;

function highlightWrongLinks() {
  clearTimeout(linkCheckTimer);
  linkCheckTimer = setTimeout(checkAllLinks, LINK_CHECK_DELAY_MS);
}

function collectAllLinks() {
  const mapping = {};
  $("#linkArea a, .preview a").each(function() {
    const o = $(this);
    const url = o.attr("href");
    if (!url) return;
    // Anchor hrefs are usually just in-page UI (collapse toggles etc.),
    // not worth checking - except our own footnote-anchor convention
    // ("#wn<issue>_<articleId>", e.g. in a Picture caption's "[1]" link),
    // which the server can validate against the database (osmbc's own
    // preview never renders a matching element - only the separate Hugo
    // renderer does - so this can't be checked against the page's DOM).
    if (url.charAt(0) === "#" && !/^#wn\d+_\d+$/i.test(url)) return;
    if (!mapping[url]) mapping[url] = [];
    mapping[url].push(o);
  });
  return mapping;
}

function markWrongLinks(mapping) {
  for (const l in mapping) {
    const status = window.cacheLink[l];
    if (!status || status === "OK") continue;
    mapping[l].forEach(function(k) {
      // #linkArea and the blog previews are not re-rendered between checks
      if (k.hasClass("osmbc-nonexist")) return;
      k.addClass("osmbc-nonexist");
      k.text(k.text() + " #" + status);
    });
  }
}

function checkAllLinks() {
  if (!window.cacheLink) window.cacheLink = {};
  const mapping = collectAllLinks();
  const list = Object.keys(mapping).filter(function(url) {
    return !window.cacheLink[url] && !pendingLinks.has(url);
  });

  if (list.length === 0) {
    markWrongLinks(mapping);
    return;
  }
  list.forEach(function(url) { pendingLinks.add(url); });
  $.ajax({
    url: window.htmlroot + "/article/urlexist",
    data: { urls: list },
    dataType: "json",
    traditional: true,
    type: "post"
  }).done(function(data) {
    if (data) Object.assign(window.cacheLink, data);
  }).always(function() {
    list.forEach(function(url) { pendingLinks.delete(url); });
    // the page may have changed while waiting, so collect the links again
    markWrongLinks(collectAllLinks());
  });
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
// small screens work in one language, stored separately from the desktop ones
function chooseMobileLanguage(lang) {
  jQuery.post(window.htmlroot + "/mobilelanguage", { lang: lang }, function () {
    location.reload();
  }).fail(function (err) {
    console.error("Problem changing mobile language " + lang);
    console.error(err);
  });
}

// language menu in the mobile header (layout.pug)
jQuery(document).on("click", "[data-mobile-lang]", function (event) {
  event.preventDefault();
  chooseMobileLanguage(jQuery(this).data("mobile-lang"));
});

// an avatar that does not load (changed on OSM, blocked by the browser)
// shows the placeholder; error does not bubble, so listen while capturing
document.addEventListener("error", function (event) {
  const img = event.target;
  if (!(img instanceof HTMLImageElement) || !img.classList.contains("osmbc-avatar")) return;
  const placeholder = window.htmlroot + "/images/avatar.svg";
  if (img.src.endsWith(placeholder)) return;
  img.src = placeholder;
}, true);

// text fields with data-fit-content grow with their text, so the whole
// text is visible without scrolling inside the field (rows is the minimum).
// Fitted while typing, on focus, on page load, and by fitToContentIn() when
// a hidden or redrawn part of the page appears
function fitToContent(field) {
  field.style.height = "";
  if (field.scrollHeight > field.clientHeight) {
    field.style.height = (field.scrollHeight + field.offsetHeight - field.clientHeight) + "px";
  }
}
function fitToContentIn(container) {
  jQuery(container).find("textarea[data-fit-content]").filter(":visible").each(function () { fitToContent(this); });
}
jQuery(document).on("input focusin", "textarea[data-fit-content]", function () { fitToContent(this); });
jQuery(function () { fitToContentIn(document); });

// history.pug: open the full text of a change, but not when a link was hit
jQuery(document).on("click", "[data-history-toggle]", function (event) {
  if (jQuery(event.target).closest("a").length) return;
  jQuery(".class_" + jQuery(this).data("history-toggle")).toggleClass("d-none");
});

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
  // no need to store this anywhere, the reference is enough; back to the
  // style sheet's display (block would stretch it in a flex row)
  el.style.display = "";
  // end of redraw fix

  setTimeout(() => { el.form.submit(); }, 1);
}


