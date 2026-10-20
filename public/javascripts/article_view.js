

/* global highlightWrongLinks, urlWoErrorWhileEdit */

/* exported myclick, ondragstartflag */
/* exported callAndRedraw, setNoTranslation, translate */


// Init This Window with jQuery ready Callback
$(document).ready(init);

const regexUrlFromCollection = /\b(https?:\/\/[^\[\]() \n\r]*)\b/g;




// unlaodWindow Handler, to generate messages that form is left unsaved
function unloadWindowWarning(event) {
  const dialogText = "Oops, it looks like you have forgotten to save your work.";
  event.returnValue = dialogText;
  return dialogText;
}


// initialise all callbacks with jQuery
function init() {
  window.mdRender = window.markdownit();

  window.mdRender.use(window.markdownitEmoji, { defs: window.emojiList, shortcuts: window.emojiShortcut });
  window.mdRender.use(window["markdown-it-imsize.js"]);
  window.mdRender.use(window.markdownitSup);
  window.mdRender.use(window.markdownitLinkAttributes, { attrs: window.linkAttributes });


  const oldEmoji = window.mdRender.renderer.rules.emoji;
  function addLanguageFlags(token, idx) {
    const link = $("img.flag#" + token[idx].markup);
    if (link.length === 1) return `<img src="${link[0].src}"></img>`;
    return oldEmoji(token, idx);
  }
  window.mdRender.renderer.rules.emoji = addLanguageFlags;



  $("#linkArea")
    .change(highlightWrongLinks);
  // save bar below lg (article_mixin.pug); mousedown keeps the focus in the
  // text field, on touch screens the tap was lost otherwise
  $(".osmbc-save-bar button")
    .on("mousedown", function(event) { event.preventDefault(); });
  $("#saveButtonBar")
    .on("click", function() { saveButton(); });
  $("#cancelButtonBar")
    .on("click", function() {
      disableUnchanged();
      location.href = $(this).data("href");
    });
  $(".preview")
    .change(highlightWrongLinks);
  $("#collection")
    .change(onchangeCollection)
    .change(FitToContent)
    .keyup(onchangeCollection)
    .keyup(FitToContent)
    .keyup(showModified)
    .trigger("change");
  $(".markdownEdit")
    .change(convertMinusNoTranslation)
    .change(previewMarkdown)
    .change(showModified)
    .change(FitToContent)
    .change(checkMarkdownError)
    .focusout(convertMinusNoTranslation)
    .keyup(previewMarkdown)
    .keyup(checkForTable)
    .keyup(FitToContent)
    .keyup(checkMarkdownError)
    .keyup(showModified)
    .on("paste", pasteEvent)
    .on("drop", pasteEvent)
    .on("focus", function() { lastMarkdownField = this; })
    .trigger("change");
  $("#title")
    .keyup(showModified);
  $("#predecessorId")
    .change(showModified);
  $("#blog")
    .change(showHideUnpublishReason)
    .change(showModified)
    .trigger("change");
  $("#unpublishReason")
    .change(showModified)
    .trigger("change");
  $("#unpublishReference")
    .keyup(showModified)
    .trigger("change");
  $("#categoryEN")
    .change(showModified)
    .change(syncPlaceholder)
    .change(showHideUnpublishReason)

    .trigger("change");
  $("#AddComment")
    .change(FitToContent)
    .keyup(FitToContent)
    .trigger("change");
  $("#editComment")
    .change(FitToContent)
    .keyup(FitToContent)
    .trigger("change");
  initSecondLanguage();
  // $('[data-bs-toggle="tooltip"]').tooltip();
  window.submitAndRedraw = submitAndRedraw;
  window.saveButton = saveButton;
  window.getEventTable = getEventTable;
}

// Picture articles: the server rejects a save with a broken feature image,
// so check it before submitting, to keep the typed text in the editor.
function checkFeatureImageBeforeSave(callback) {
  if ($("#categoryEN").val() !== "Picture") return callback(true);
  const categoryChanged = $("#categoryEN").val() !== $("#old_categoryEN").val();
  const toCheck = window.activeLanguages.filter(function(lang) {
    return categoryChanged || $("#markdown" + lang).val() !== $("#old_markdown" + lang).val();
  });
  let allOk = true;
  function next() {
    if (toCheck.length === 0) return callback(allOk);
    const lang = toCheck.shift();
    $.post(window.htmlroot + "/article/checkfeatureimage", { markdown: $("#markdown" + lang).val() }, function(data) {
      if (data.result !== "OK") {
        allOk = false;
        const text = $(".markdownMessage[lang=" + lang + "]");
        text.show(400);
        text.text(data.result);
      }
      next();
    }, "json").fail(function(err) {
      console.error(err);
      callback(false);
    });
  }
  next();
}

function saveButton() {
  checkFeatureImageBeforeSave(function(ok) {
    if (ok) saveWithComment();
  });
}

function saveWithComment() {
  function save() {
    disableUnchanged(); document.getElementById("input").submit();
  }
  if (document.getElementById("comment").value.trim() === "") return save();

  // only save comment, if it is not empty
  const jqForm = $("form#AddComment");
  const url = jqForm.attr("action");
  const toPost = jqForm.serialize();

  $.post(url, toPost, function (data) {
    if (data === "OK") {
      save();
    }
  },
  "text" // I expect a JSON response
  ).fail(function (err) {
    console.error(err);
  });
}




// Check, wether value of field is "-" and set it to "no translation"
// Install as onleave event handler
function convertMinusNoTranslation() {
  const object = $(this);
  const md = object.val();
  if (md && md.trim() === "-") {
    object.val("no translation");
    object.trigger("change");
  }
}

function getEventTable(lang, edit, pressedButton) {
  const url = window.htmlroot + "/tool/getEventTable?lang=" + lang;
  $(pressedButton).hide("slow");
  $(edit).val("Data will be recieved ...");

  $.ajax({
    url: url,
    data: { blogStartDate: window.blogStartDate },
    method: "POST",
    success: function(data) {
      if (data) $(edit).val(data).trigger("change");


      return false;
    },
    dataType: "text",
    error: function(err, text1, text2) {
      console.info(err);
      console.info(text1);
      console.info(text2);
    },
    timeout: 80000 // in milliseconds
  });
}




// Function to convert markdown into html
// Add the Blog typic list element to preview, but only
// for specific types, (Missing: configuring this by user.)
function convert(text) {
  // The cut at the beginning is a little bit "historic" from the
  // OSMBC startup, so only used for emotional motivation of the developer :-)
  // Feature excluded in Migration to Hugo
  // if (text.substring(0, 2) === "* ") text = text.substring(2, 999999);


  // convert md to html
  text = window.mdRender.render(text);


  // Display as list, this should depend on type

  const cat = $("#categoryEN").val();
  if (cat !== "Picture" && cat !== "Events" && cat !== "Releases") {
    text = "<ul><li>" + text + "</li></ul>";
  }
  return text;
}

// Test, wether a text is an url or not
// based on regex.
function isURL(t) {
  const isUrlRegex = /^(http|ftp|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/;
  if (t) return isUrlRegex.test(t);
  return isUrlRegex;
}

// Try to copy text to the clipboard
// if it fails, alert an error and offer the possibility to copy manual
function clip(text) {
  let copyElement = document.createElement("input");
  copyElement.setAttribute("type", "text");
  copyElement.setAttribute("value", text);
  copyElement = document.body.appendChild(copyElement);
  copyElement.select();
  try {
    if (!document.execCommand("copy")) throw new Error("Not allowed.");
  } catch (e) {
    copyElement.remove();
    alert("Copy not supported, use your mobile to copy and press enter", text);
  } finally {
    if (typeof e === "undefined") {
      copyElement.remove();
    }
  }
}

// Function that generates a markdown link in the case a
// url is pasted or drag'n dropped to a markdown textfield
//
function generateMarkdownLink2(par1, par2) {
  // tb == Text Before Selection
  // ta == Text Afer Selection
  const tb = par1.text.substring(0, par1.startselection);
  const ta = par1.text.substring(par1.endselection, 99999);

  // beforeSnip == selected Text before paste
  // afterSnip == selected Text after Insert
  const beforeSnip = par1.text.substring(par1.startselection, par1.endselection);
  let afterSnip = par2.text.substring(par1.startselection, par2.endselection);

  // only in the case, the "afterSnip" variable contains an URL, something
  // has to be done
  if (isURL(afterSnip.trim())) {
    afterSnip = afterSnip.trim();

    // Check, wether, the url is pasted into brackets ()
    // then nothing has to be done
    let alreadyMarkdowned = false;
    if (tb.length > 2 && tb.charAt(tb.length - 1) === "(" && tb.charAt(tb.length - 2) === "]") alreadyMarkdowned = true;
    if (ta !== "" && tb.charAt(0) === ")") alreadyMarkdowned = true;
    if (!alreadyMarkdowned) {
      // combine the new text
      const r = tb + "[" + beforeSnip + "](" + afterSnip + ")" + ta;

      // calculate the position to point to
      // for the new text
      // Between [] in the case, that only a link was added
      // after the [link](http://somewhere) in case the link has already a "display" word
      let c;
      if (beforeSnip === "") {
        c = (tb + "[").length;
      } else {
        c = (tb + "[" + beforeSnip + "](" + afterSnip + ")").length;
      }
      return { text: r, pos: c };
    }
  }
  return null;
}

// Position of the text a drop inserted: the part between the common start
// and the common end of the text before and after. null if the drop also
// removed text (text moved inside the field).
function droppedRange(beforeText, afterText) {
  let start = 0;
  while (start < beforeText.length && beforeText[start] === afterText[start]) start++;
  let end = 0;
  while (end < beforeText.length - start && end < afterText.length - start &&
    beforeText[beforeText.length - 1 - end] === afterText[afterText.length - 1 - end]) end++;
  if (start + end !== beforeText.length) return null;
  return { start: start, end: afterText.length - end };
}

// Event Handler for pasting text to markdown field
function pasteEvent(event) {
  const mf = this;
  const isDrop = event && event.type === "drop";

  // Generate a triple of text, start selection and end selection BEFORE Pasting new text
  const before = { text: mf.value, startselection: mf.selectionStart, endselection: mf.selectionEnd };

  setTimeout(function () {
    // Generate a triple of text, start selection and end selection AFTER Pasting new text
    const after = { text: mf.value, startselection: mf.selectionStart, endselection: mf.selectionEnd };
    // A drop inserts where it is dropped, not at the cursor: the selection
    // before the drop says nothing about where the new text is.
    if (isDrop) {
      const range = droppedRange(before.text, after.text);
      if (!range) return $(mf).trigger("change");
      before.startselection = before.endselection = range.start;
      after.startselection = after.endselection = range.end;
    }
    // And use the result, to generate the markdown link
    const r = generateMarkdownLink2(before, after);

    if (r) {
      mf.value = r.text;
      mf.selectionStart = mf.selectionEnd = r.pos;
    }
    // just for the case, that a " " war added by some browsers between [] and ()
    // of the markdown link throw it away
    mf.value = (mf.value).replace(/] \(/g, "](");
    $(mf).trigger("change");
  }, 1); // End of setTimeout function call
}


// Check, wether a markdown field contains a table
// and set the texttype to monospace
function checkForTable() {
  const md = this.value;
  if (md.indexOf("|----") >= 0) {
    $(this).wrap = "off";
    $(this).css("fontFamily", "monospace");
  } else {
    $(this).wrap = "soft";
    $(this).css("fontFamily", "");
  }
}

// Event handler to calculate the fresh markdown preview
function previewMarkdown() {
  const md = this.value;
  const preview = $(".preview[lang=" + this.lang + "]");
  preview.html(convert(md));
  preview.trigger("change");
}


// Event Handler to check markdown for every error
// For Now
// * long markdown links
//
// Can be extended: Valid Urls, ...
function checkMarkdownError() {
  const md = this.value;
  if (!window.linklist) window.linklist = [];
  const text = $(".markdownMessage[lang=" + this.lang + "]");
  let errorOccured = false;

  // Check for long links
  const longLink = md.search(/\[[^\]]{40,}\]/g);
  if (longLink >= 0) {
    text.show(400);
    text.html("Please shorten [" + md.substring(longLink + 1, longLink + 40) + "...]");
    errorOccured = true;
  }

  let linkList;
  let allLinksFound = true;
  let linkFromCollectionFound = false;
  let linksInCollection = false;
  const allLinks = [];
  let errorLinkTwice = null;
  let errorLinkNotInCollection = null;

  const regexToken = regexUrlFromCollection;
  while ((linkList = regexToken.exec(md)) !== null) {
    linksInCollection = true;
    const link = linkList[0];

    let linkAllowed = false;

    for (const allowedUrl in urlWoErrorWhileEdit) {
      if (link.substring(0, allowedUrl.length) === allowedUrl) {
        linkAllowed = true;
      }
    }
    if (linkAllowed) continue;


    if (allLinks.indexOf(link) >= 0) {
      if ($("img.flag[src='" + link + "']").length === 0) {
        errorLinkTwice = link;
      }
    }
    allLinks.push(link);

    let linkFound = false;
    for (let i = 0; i < window.linklist.length; i++) {
      if (window.linklist[i] === link) linkFound = true;
    }
    // check Language Flags
    if ($("img.flag[src='" + link + "']").length > 0) linkFound = true;
    if (window.googleTranslateText) {
      for (const l in window.googleTranslateText) {
        if (window.googleTranslateText[l].indexOf(link) > 0) linkFound = true;
      }
    }
    if (linkFound) linkFromCollectionFound = true;
    if (!linkFound) {
      allLinksFound = false;
      errorLinkNotInCollection = link;
    }
  }
  if (allLinksFound === false && md.indexOf("----------") < 0) {
    text.show(400);
    text.html("Please check links (e.g." + errorLinkNotInCollection + "), some looks not to be in collection, nor be a translation link");
    errorOccured = true;
  }
  if (linksInCollection && linkFromCollectionFound === false && md !== "" && md !== "no translation" && md.indexOf("----------") < 0) {
    text.show(400);
    text.html("Please use a link from collection in article.");
    errorOccured = true;
  }
  if (errorLinkTwice) {
    text.show(400);
    text.html("Link " + errorLinkTwice + " is used twice in markdown");
    errorOccured = true;
  }

  // Picture article: the feature image has to be a relative path,
  // its existence is checked by the server on save.
  if ($("#categoryEN").val() === "Picture") {
    const image = /!\[[^\]]*\]\(([^)\s]+)/.exec(md);
    if (image && (image[1].charAt(0) !== "/" || image[1].charAt(1) === "/")) {
      text.show(400);
      text.text("Feature image \"" + image[1] + "\" must be a relative path starting with /");
      errorOccured = true;
    }
  }

  if (!errorOccured) {
    // preview.style.backgroundColor="";
    text.hide(400);
  }
}





// The google translate link of an url for a given language,
// as url and as markdown (with the "translated" emoji)
function googleTranslateLink(link, lang) {
  let gttl = lang;

  if (lang === "JP") gttl = "JA";
  if (lang === "CZ") gttl = "CS";

  const url = new URL(link);
  let origin = url.origin;
  let pathnameWithSearch = url.pathname + url.search;
  if (url.search === "") pathnameWithSearch = pathnameWithSearch + "?";

  origin = origin.replaceAll("--", "---");
  origin = origin.replaceAll("-", "--");
  origin = origin.replaceAll(".", "-");



  let gtl = "#ORIGIN#.translate.goog#PATHNAME#_x_tr_sl=auto&_x_tr_tl=#GTTL#";
  gtl = gtl.replace("#LANG#", lang);
  gtl = gtl.replace("#GTTL#", gttl);
  gtl = gtl.replace("#ORIGIN#", origin);
  gtl = gtl.replace("#PATHNAME#", pathnameWithSearch);

  let gtlMarkdown = ":??-s: >   [:#LANG#-t:](#ORIGIN#.translate.goog#PATHNAME#_x_tr_sl=auto&_x_tr_tl=#GTTL#)";



  gtlMarkdown = gtlMarkdown.replace("#LANG#", lang);
  gtlMarkdown = gtlMarkdown.replace("#GTTL#", gttl);
  gtlMarkdown = gtlMarkdown.replace("#ORIGIN#", origin);
  gtlMarkdown = gtlMarkdown.replace("#PATHNAME#", pathnameWithSearch);
  return { url: gtl, markdown: gtlMarkdown };
}

// Generate the automatic google translate link for an url
// and a given language, used to show it in edit mode
function generateGoogleTranslateLink(link, lang) {
  const gt = googleTranslateLink(link, lang);
  const gtl = gt.url;
  const gtlMarkdown = gt.markdown;
  window.linklist.push(gtl);

  // build DOM elements instead of an HTML string, the link comes from
  // the collection field and must not be interpreted as HTML or JavaScript
  return $("<a>", { href: gtl, target: "_blank" })
    .text(lang)
    .on("dragstart", function(event) { dragstart(event.originalEvent, gtlMarkdown); });
}


// Eventhandler to start drag & drop
function dragstart(event, text) {
  event.dataTransfer.setData("TEXT", text);
}


// The markdown field the link buttons insert into: the one edited last,
// or the first one that can be edited.
let lastMarkdownField = null;
function insertTargetField() {
  if (lastMarkdownField && !lastMarkdownField.readOnly && $(lastMarkdownField).is(":visible")) return lastMarkdownField;
  return $(".markdownEdit:visible").not("[readonly]")[0];
}

// Insert text at the cursor of a markdown field, the tap alternative to
// dragging a link (touch screens cannot drag). A link wraps the selected
// text like pasting an url into a selection: [selection](link).
function insertIntoMarkdown(mf, text, asLink) {
  const start = asLink ? mf.selectionStart : mf.selectionEnd;
  const end = mf.selectionEnd;
  const before = { text: mf.value, startselection: start, endselection: end };
  const newText = mf.value.substring(0, start) + text + mf.value.substring(end);
  const pos = start + text.length;
  let r = null;
  if (asLink) r = generateMarkdownLink2(before, { text: newText, startselection: pos, endselection: pos });
  if (!r) r = { text: newText, pos: pos };
  mf.value = r.text;
  mf.focus();
  mf.selectionStart = mf.selectionEnd = r.pos;
  $(mf).trigger("change");
}

// Small screens: show the second language on demand (X11). Whether it is
// shown is remembered in the browser, it is a per viewer convenience.
function initSecondLanguage() {
  const toggle = $("#toggleSecondLang");
  if (toggle.length === 0) return;
  const second = toggle.data("lang");
  const area = $("#secondLanguage");
  const translateButton = $("#translateToSecondLang");
  function show(shown) {
    area.toggleClass("d-none", !shown);
    toggle.text((shown ? "Hide " : "Show ") + second);
    try { window.localStorage.setItem("osmbcShowSecondLang", shown ? "yes" : "no"); } catch (e) {}
  }
  function updateTranslateButton() {
    const from = ($("#markdown" + translateButton.data("from")).val() || "").trim();
    const to = ($("#markdown" + second).val() || "").trim();
    // toggleClass needs a real boolean: anything else (e.g. "") toggles
    translateButton.toggleClass("d-none", from === "" || to !== "");
  }
  let shown = false;
  try { shown = window.localStorage.getItem("osmbcShowSecondLang") === "yes"; } catch (e) {}
  show(shown);
  toggle.on("click", function() { show(area.hasClass("d-none")); });
  if (translateButton.length === 0) return;
  // input, not keyup: it fires for every change of the text, also for
  // pasting, dropping, autocorrect and the keyboard's word suggestions
  $("#markdown" + translateButton.data("from") + ", #markdown" + second).on("input change", updateTranslateButton);
  updateTranslateButton();
  translateButton.on("click", function() {
    show(true);
    window.translate(translateButton.data("from"), second, translateButton.data("service"));
  });
}

// Buttons below lg: insert the link, or its google translate link in the
// language of the field. In mobile mode full size (tap targets), otherwise
// small next to the link.
function linkInsertButtons(link, mobile) {
  function button(label, cls, onInsert) {
    return $("<button>", { type: "button", class: "btn btn-outline-primary " + (mobile ? "" : "btn-sm py-0 me-1 ") + cls })
      .text(label)
      // keep the focus (and the cursor) in the markdown field
      .on("mousedown", function(event) { event.preventDefault(); })
      .on("click", function() {
        const mf = insertTargetField();
        if (mf) onInsert(mf);
      });
  }
  const buttons = [
    button("+ Link", "insertLink", function(mf) { insertIntoMarkdown(mf, link, true); }),
    button("+ translated", "insertTranslatedLink", function(mf) { insertIntoMarkdown(mf, googleTranslateLink(link, mf.lang).markdown, false); })
  ];
  if (mobile) return buttons;
  return $("<span>", { class: "d-lg-none" }).append(buttons);
}

// Collection is changed, so create a linkList
// for the linkArea

function onchangeCollection() {
  const cl = $("#collection").val();
  const linkArea = $("#linkArea");
  const regexToken = regexUrlFromCollection;
  const mobile = document.documentElement.classList.contains("osmbc-mobile");
  let linkList;
  window.linklist = [];
  const result = $(mobile ? "<div>" : "<p>");
  function linkShortener(link) {
    if (link.length < 50) return link;
    return link.substr(0, 40) + " . . . " + link.substr(link.length - 5, 5);
  }
  function text(t) {
    return document.createTextNode(t);
  }
  function linkTextLoader(link, field, icon) {
    return $("<a>", { href: "#" })
      .append($("<i>", { class: icon }), text("  "))
      .on("click", function() { clickAndLoadLinktext(this, field, link); });
  }
  // Mobile mode: one block per link, the link on its own line, below it the
  // insert buttons and a menu with the other actions (tap targets, X10)
  function mobileLinkBlock(link, badge) {
    const menu = $("<ul>", { class: "dropdown-menu dropdown-menu-end" }).append(
      $("<li>").append(linkTextLoader(link, "textContent", "fa fa-file-text").addClass("dropdown-item").append(text("Readable text"))),
      $("<li>").append(linkTextLoader(link, "content", "fa fa-file-text-o").addClass("dropdown-item").append(text("Page content")))
    );
    window.userLanguages.forEach(function(lang) {
      const translated = generateGoogleTranslateLink(link, lang).addClass("dropdown-item");
      translated.text("Translated page (" + lang + ")");
      menu.append($("<li>").append(translated));
    });
    const more = $("<div>", { class: "dropdown" }).append(
      $("<button>", { type: "button", class: "btn btn-outline-secondary osmbc-tap-square", "data-bs-toggle": "dropdown", "aria-expanded": "false", "aria-label": "More for this link" }).text("⋯"),
      menu
    );
    return $("<div>", { class: "mb-2" }).append(
      $("<div>").append(badge),
      $("<div>", { class: "d-flex flex-wrap gap-2 mt-1" }).append(linkInsertButtons(link, true), more)
    );
  }


  while ((linkList = regexToken.exec(cl)) !== null) {
    const link = linkList[0];
    let found = false;


    window.linklist.forEach(function (l) {
      if (l === link) found = true;
    });
    if (found) continue;
    window.linklist.push(link);

    const isDoublette = window.articleReferences[link] && (window.articleReferences[link]).length > 0;
    const badge = $("<a>", { class: "badge " + (isDoublette ? "text-bg-danger" : "text-bg-secondary"), href: link, target: "_blank" })
      .text(linkShortener(link) + (isDoublette ? " #(Check for Doublette)" : ""));
    if (mobile) {
      result.append(mobileLinkBlock(link, badge));
      continue;
    }
    result.append(text(" "), linkTextLoader(link, "textContent", "fa fa-file-text"));
    result.append(text(" "), linkTextLoader(link, "content", "fa fa-file-text-o"));
    result.append(badge, text("\n"));

    window.userLanguages.forEach(function(lang) {
      result.append(text(" "), generateGoogleTranslateLink(link, lang));
    });
    result.append(text(" "), linkInsertButtons(link));

    result.append($("<br>"), text("\n"));
  }

  if (linkArea) {
    linkArea.empty().append(result);
    linkArea.trigger("change");
  }
}


// click on a flag Event
// Copy the flag related information to the clipboard as markdown link
function myclick(id) {
  let src = $("#" + id).attr("src");


  src = "![(" + id + ")](" + src + ")";
  clip(src);
  alert(id + " flag is copied to clipboard");
}

function clickAndLoadLinktext(object, field, link) {
  const LinkTextPlainRow = $("#linkTextPlainRow");
  if (!LinkTextPlainRow.hasClass("invisible")) {
    LinkTextPlainRow.addClass("invisible");
    return;
  }

  $.get(window.htmlroot + "/article/readability", { link: link }, function(json) {
    const linkTextPlain = $("#linkTextPlain");
    LinkTextPlainRow.removeClass("invisible");
    if (typeof json === "string") {
      // error message from server, show as plain text
      linkTextPlain.text(json);
    } else if (field === "textContent") {
      linkTextPlain.empty().append($("<pre>").text(json[field]));
    } else {
      linkTextPlain.html(json[field]);
    }
  });
}

// dragStart Event
function ondragstartflag (event, id) {
  const image = document.getElementById(id);
  let src = image.src;
  src = "![(" + id + ")](" + src + ")";
  event.dataTransfer.setData("TEXT", src);
}



// Fit to content event
// justify the size of the textfield to the shown content
function FitToContent() {
  if (!this) return;
  const textfield = this;
  textfield.style.height = textfield.style.minHeight;
  const adjustedHeight = Math.max(textfield.scrollHeight, textfield.clientHeight);
  if (adjustedHeight > textfield.clientHeight) {
    textfield.style.height = adjustedHeight + "px";
  }
}

function syncPlaceholder() {
  const c = $("#categoryEN").val();
  if (window.placeholder[c]) {
    $("#categoryDisplay").html(window.placeholder[c]);
  } else {
    $("#categoryDisplay").html("Missing Category Description");
  }
}

function showModified() {
  let modified = false;

  const newVal = $(this).val();
  const oldVal = $("#old_" + this.name + ":hidden").val();

  let modifiedColor = "#ffffcc";
  let normalColor = "";
  if (this.name === "categoryEN" && newVal === window.noCategorie) {
    normalColor = "#FDC6CD";
    modifiedColor = "#FDC6AB";
  }

  if (oldVal !== newVal) {
    $(this).css("backgroundColor", modifiedColor);
    $("#" + this.name + "_unsaved").show();
  } else {
    $(this).css("backgroundColor", normalColor);
    $("#" + this.name + "_unsaved").hide();
  }

  $(".af").each(function() {
    const newVal = $(this).val();
    const oldVal = $("#old_" + this.name + ":hidden").val();

    if (oldVal !== newVal) {
      modified = true;
    }
  });
  $("#saveButton").prop("disabled", !modified);
  $("#cancelButton").prop("disabled", !modified);
  // the save bar on small screens is only shown when there is something to save
  $(".osmbc-save-bar, .osmbc-save-bar-spacer").toggleClass("d-none", !modified);

  if (modified) {
    $("#noTranslationButton").removeClass("visible");
    $("#noTranslationButton").addClass("invisible");
    $(window).on("beforeunload", unloadWindowWarning);
  } else {
    $("#noTranslationButton").removeClass("invisible");
    $("#noTranslationButton").addClass("visible");
    $(window).off("beforeunload", unloadWindowWarning);
  }
}

function showHideUnpublishReason() {
  const c = $("#categoryEN").val();
  const b = $("#blog").val();

  let hidden = true;
  if (c === "--unpublished--") hidden = false;
  if (b === "Trash") hidden = false;

  if (hidden) {
    $("#unpublishReasonRow").addClass("d-none");
  } else {
    $("#unpublishReasonRow").removeClass("d-none");
  }
}


function redrawFunc(redraw) {
  let k;
  $.getJSON(window.htmlroot + redraw, function (json) {
    for (k in json) {
      $(k).html(json[k]);
    }
  });
}
// This Function calls "call" url, if given
// after that it callse the "redraw" url, parses
// the json and redraws it content in the html
function callAndRedraw(call, redraw) {
  if (call) {
    $.get(window.htmlroot + call, function() { redrawFunc(redraw); });
  } else {
    redrawFunc(redraw);
  }
}

function disableUnchanged() {
  window.activeLanguages.forEach(function(lang) {
    if ($("#markdown" + lang).val() === $("#old_markdown" + lang).val()) {
      $("#markdown" + lang).prop("disabled", true);
      $("#old_markdown" + lang).prop("disabled", true);
    }
  });
  $(window).off("beforeunload", unloadWindowWarning);
}

function submitAndRedraw(form, redraw) {
  const jqForm = $(form);
  const url = jqForm.attr("action");

  const toPost = jqForm.serialize();


  // clean unchanged values, to reduce post overhead.
  for (const k in toPost) {
    if (toPost[k] === toPost["old_" + k]) {
      delete toPost[k];
      delete toPost["old_" + k];
    }
  }

  $.post(url, toPost, function (data) {
    if (data === "OK") {
      if (redraw) redrawFunc(redraw);
    }
  },
  "text" // I expect a JSON response
  ).fail(function(err) { console.error(err); });
}


function setNoTranslation() {
  const f = $("#noTranslationForm");
  if (f.length > 0) {
    f.submit();
  }
}



function translate(langFrom, langToParam, service) {
  if (!Array.isArray(langToParam)) langToParam = [langToParam];
  langToParam.forEach(function(langTo) {
    $(".translate" + langFrom + langTo).addClass("d-none");
    $(".translateWait" + langFrom + langTo).removeClass("d-none");
    const from =  langFrom.toLowerCase();
    const to = langTo.toLowerCase();
    let originalText = document.getElementById("preview" + langFrom).innerText;
    if (service === "deeplPro" || service === "copy") {
      originalText = document.getElementById("markdown" + langFrom).value;
    }
    if (service !== "deepl") {
      jQuery.post(window.htmlroot + "/article/translate/" + service + "/" + from + "/" + to, { text: originalText }, function (data) {
        // data = data.replace(/] \(/g, "](");
        $(".translateWait" + langFrom + langTo).addClass("d-none");
        $(".translateDone" + langFrom + langTo + "." + service).removeClass("d-none");
        $("#markdown" + langTo).val(data).trigger("change");
      }).fail(function () {
        $(".translateWait" + langFrom + langTo).addClass("d-none");
        $(".translateError" + langFrom + langTo).removeClass("d-none");
      });
    } else {
      // service is deepl unpaid, just open the window
      window.open("https://www.deepl.com/translator#" + langFrom + "/" + langTo + "/" + originalText, "_blank");
      $(".translateWait" + langFrom + langTo).addClass("d-none");
      $(".translateDone" + langFrom + langTo + "." + service).removeClass("d-none");
    }
  });
}
