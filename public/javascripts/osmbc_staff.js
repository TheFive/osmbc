

/* exported highlightWrongLinks */
/* exported chooseLanguage */
/* exported chooseLanguageSet */
/* exported setUserConfig */
/* exported addSpinnerAndSubmit */
/* exported fitToContentIn, fitToContent */


// Link check for #linkArea and the .preview elements.
// The page brings the results the server already knows (window.cacheLink,
// mixin knownLinkResults); they are shown at once. The previews fire
// "change" on every keyup, so the check waits until changes pause, then
// sends all unknown links of the page in one request. Links already
// requested are not requested again while waiting for the answer, so
// several previews firing at once share one request.
const LINK_CHECK_DELAY_MS = 500;
const pendingLinks = new Set();
let linkCheckTimer = null;
let knownLinksShown = false;

function highlightWrongLinks() {
  if (!knownLinksShown && window.cacheLink) {
    knownLinksShown = true;
    markWrongLinks(collectAllLinks());
  }
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

// A link check answer (routes/article.js urlExist) is "OK" or an error
// text (footnote anchors, guests) or, for http(s) links, an object from
// model/link.js: { state, status, exists, by, timestamp, validUntil } with
// state ok / broken / blocked / unreachable, exists true / false / null
// (open) and by "auto" or the editor who answered.
// linkState gives "ok", "broken", "missing", "blocked" or "unreachable".
function linkState(answer) {
  if (!answer || answer === "OK") return "ok";
  if (typeof answer !== "object") return "broken";
  if (answer.exists === true) return "ok";
  if (answer.exists === false) return (answer.by === "auto") ? "broken" : "missing";
  return answer.state;
}

// same date format as the admin list "Checked Links"
function shortDate(iso) {
  return String(iso).substring(0, 10);
}

function isMobileMode() {
  return document.documentElement.classList.contains("osmbc-mobile");
}

const CHECK_TEXTS = {
  ok: () => "ok",
  broken: (a) => "not found (" + a.status + ")",
  blocked: (a) => "can't be checked automatically (" + a.status + ")",
  unreachable: (a) => "temporarily unreachable (" + a.status + ")"
};

// What is known about a link, as text for the card (as in the admin list).
function linkStateText(answer) {
  const check = "link check: " + (CHECK_TEXTS[answer.state] || (() => "not checked yet"))(answer);
  if (answer.by === "auto" || answer.exists === null) return check;
  return check + " · " + (answer.exists ? "exists" : "missing") + ", said " + answer.by + " on " + shortDate(answer.timestamp) +
    " · valid until " + shortDate(answer.validUntil);
}

// badge in front of a row: exists / missing / open (as in the admin list)
function linkBadge(answer) {
  if (answer.exists === true) return $("<span>", { class: "badge text-bg-success" }).text("exists");
  if (answer.exists === false) return $("<span>", { class: "badge text-bg-danger" }).text("missing");
  return $("<span>", { class: "badge text-bg-secondary" }).text("open");
}

// Undo for an editor's answer; otherwise Exists / Missing, each only when
// it changes something. Phones: normal button height (docs/ui-guidelines.md).
function linkAnswerButtons(url, answer) {
  const size = isMobileMode() ? "" : " btn-sm";
  if (answer.by !== "auto" && answer.exists !== null) {
    return [$("<button>", { type: "button", class: "btn btn-outline-secondary" + size, "data-link-revoke": url }).text("Undo")];
  }
  const buttons = [];
  if (answer.exists !== true) buttons.push($("<button>", { type: "button", class: "btn btn-outline-success" + size, "data-link-answer": "true", "data-link-url": url }).text("Exists"));
  if (answer.exists !== false) buttons.push($("<button>", { type: "button", class: "btn btn-outline-danger" + size, "data-link-answer": "false", "data-link-url": url }).text("Missing"));
  return buttons;
}

// Marks one link; earlier marks are removed first, so a changed answer
// (answered, undone) is shown without re-rendering the page.
function markLink(k, answer) {
  k.removeClass("osmbc-nonexist osmbc-link-uncheckable");
  k.find(".osmbc-linkmark").remove();
  const state = linkState(answer);
  if (state === "broken" || state === "missing") {
    k.addClass("osmbc-nonexist");
    const status = (typeof answer === "object") ? answer.status : answer;
    k.append($("<span>", { class: "osmbc-linkmark" }).text(" #" + ((state === "missing") ? "missing" : status)));
  } else if (state === "blocked" || state === "unreachable") {
    // the meaning is written out in the card #linkCheckCard, no tooltip needed
    k.addClass("osmbc-link-uncheckable");
    k.append($("<i>", { class: "fa fa-question-circle osmbc-linkmark", "aria-label": linkStateText(answer) }));
  }
}

// the text of a link without the link check's mark
function linkText(k) {
  const copy = k.clone();
  copy.find(".osmbc-linkmark").remove();
  return copy.text().trim();
}

function linkCardRow(url, answer, texts) {
  return $("<li>", { class: "list-group-item d-flex flex-wrap align-items-center gap-2", "data-link-check-row": url }).append(
    linkBadge(answer),
    $("<div>", { class: "flex-grow-1 text-break" }).append(
      $("<a>", { href: url, target: "_blank", rel: "noopener noreferrer" }).text(url),
      $("<div>", { class: "small text-body-secondary" }).text(linkStateText(answer) + (texts.length ? " · in: " + texts.join(", ") : ""))
    ),
    $("<div>", { class: "d-flex flex-wrap gap-2" }).append(linkAnswerButtons(url, answer))
  );
}

// the collapsed list of links that are ok stays open while the page is shown
let showOkLinks = false;

// Blog and article page (mixin linkCheckCard): links not known to exist,
// with buttons; below, collapsed, the links that are ok.
function showLinkCheckCard(mapping) {
  const card = $("#linkCheckCard");
  if (card.length === 0) return;
  const rows = { check: [], ok: [] };
  for (const url in mapping) {
    const answer = window.cacheLink[url];
    if (!answer || typeof answer !== "object") continue;
    const texts = [...new Set(mapping[url].filter(k => k.closest(".preview").length > 0).map(linkText).filter(t => t !== ""))];
    rows[(answer.exists === true) ? "ok" : "check"].push(linkCardRow(url, answer, texts));
  }
  const count = rows.check.length + rows.ok.length;
  card.toggleClass("d-none", count === 0);
  card.find("[data-link-card-title]").text(rows.check.length > 0 ? "Links to check" : "Links: all ok");
  card.find("[data-link-card-count]").text(rows.check.length + " to check, " + rows.ok.length + " ok");
  card.find("[data-link-card-hint]").toggleClass("d-none", rows.check.length === 0);
  card.find("[data-link-list='check']").empty().append(rows.check);
  card.find("[data-link-list='ok']").empty().append(rows.ok).toggleClass("d-none", !showOkLinks);
  const okText = (rows.ok.length === 1) ? "the link that is ok" : "the " + rows.ok.length + " links that are ok";
  card.find("[data-link-toggle-ok]").text((showOkLinks ? "Hide " : "Show ") + okText)
    .closest(".card-footer").toggleClass("d-none", rows.ok.length === 0);
}

jQuery(document).on("click", "[data-link-toggle-ok]", function(event) {
  event.preventDefault();
  showOkLinks = !showOkLinks;
  showLinkCheckCard(collectAllLinks());
});

function markWrongLinks(mapping) {
  for (const l in mapping) {
    const answer = window.cacheLink[l];
    if (!answer) continue;
    mapping[l].forEach(function(k) { markLink(k, answer); });
  }
  showLinkCheckCard(mapping);
}

// after a change: the admin list reloads, the other pages show the new result
function showLinkResult(button, url, answer) {
  if (button.closest("[data-link-row]").length > 0) return window.location.reload();
  window.cacheLink[url] = answer;
  markWrongLinks(collectAllLinks());
}

jQuery(document).on("click", "[data-link-answer]", function(event) {
  event.preventDefault();
  const button = $(this);
  const url = button.attr("data-link-url");
  button.prop("disabled", true);
  jQuery.post(window.htmlroot + "/link/answer", { url: url, exists: button.attr("data-link-answer") }, function(answer) {
    showLinkResult(button, url, answer);
  }, "json").fail(function() {
    button.prop("disabled", false);
  });
});

jQuery(document).on("click", "[data-link-revoke]", function(event) {
  event.preventDefault();
  const button = $(this);
  const url = button.attr("data-link-revoke");
  button.prop("disabled", true);
  jQuery.post(window.htmlroot + "/link/revoke", { url: url }, function(answer) {
    showLinkResult(button, url, answer);
  }, "json").fail(function() {
    button.prop("disabled", false);
  });
});

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


// Keeps the content below the fixed navbar (#fixedNavbar in layout.pug and
// adminlayout.pug), whatever its height (avatar, beta marker, wrapped
// entries). An adopted style sheet does not change the DOM; style.css has
// a fixed fallback for older browsers.
function fitContentBelowNavbar() {
  const navbar = document.getElementById("fixedNavbar");
  if (!navbar || !window.CSSStyleSheet || !document.adoptedStyleSheets || !window.ResizeObserver) return;
  const sheet = new CSSStyleSheet();
  document.adoptedStyleSheets = document.adoptedStyleSheets.concat([sheet]);
  const fit = function () { sheet.replaceSync("body { padding-top: " + navbar.offsetHeight + "px; } :root { --osmbc-navbar-height: " + navbar.offsetHeight + "px; }"); };
  fit();
  new ResizeObserver(fit).observe(navbar);
}
fitContentBelowNavbar();
