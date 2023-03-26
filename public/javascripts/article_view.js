"use strict";

/* eslint-env browser:true, node:false, jquery:true, commonjs:false */
/* global highlightWrongLinks, urlWoErrorWhileEdit */

/* exported dragstart, myclick, ondragstartflag, ondragstartLangLabel, showRL */
/* exported callAndRedraw, setNoTranslation, translate */

/* jshint esversion: 6 */

// Init This Window with jQuery ready Callback
$(document).ready(init);




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
  window.mdRender.use(window.markdownitSup);
  window.mdRender.use(window["markdown-it-imsize.js"]);
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
  // $('[data-toggle="tooltip"]').tooltip();
  window.submitAndRedraw = submitAndRedraw;
  window.saveButton = saveButton;
  window.getEventTable = getEventTable;
}

function saveButton() {
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
  /* jshint validthis: true */
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
  if (text.substring(0, 2) === "* ") text = text.substring(2, 999999);


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

// Event Handler for pasting text to markdown field
function pasteEvent() {
  /* jshint validthis: true */

  const mf = this;

  // Generate a triple of text, start selection and end selection BEFORE Pasting new text
  const before = { text: mf.value, startselection: mf.selectionStart, endselection: mf.selectionEnd };

  setTimeout(function () {
    // Generate a triple of text, start selection and end selection AFTER Pasting new text
    const after = { text: mf.value, startselection: mf.selectionStart, endselection: mf.selectionEnd };

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
  /* jshint validthis: true */
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
  /* jshint validthis: true */
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
  /* jshint validthis: true */
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

  const regexToken = /(https?:\/\/[^\[\] \n\r()]*)/g;
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

  if (!errorOccured) {
    // preview.style.backgroundColor="";
    text.hide(400);
  }
}





// Generate the automatic google translate link for an url
// and a given language, used to show it in edit mode
function generateGoogleTranslateLink(link, lang) {
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

  window.linklist.push(gtl);

  let gtlMarkdown = ":??-s: >   [:#LANG#-t:](#ORIGIN#.translate.goog#PATHNAME#_x_tr_sl=auto&_x_tr_tl=#GTTL#)";



  gtlMarkdown = gtlMarkdown.replace("#LANG#", lang);
  gtlMarkdown = gtlMarkdown.replace("#GTTL#", gttl);
  gtlMarkdown = gtlMarkdown.replace("#ORIGIN#", origin);
  gtlMarkdown = gtlMarkdown.replace("#PATHNAME#", pathnameWithSearch);

  const dragstartFunction = "dragstart(event,'" + gtlMarkdown + "');";

  return '<a href="' + gtl + '" target="_blank" ondragstart="' + dragstartFunction + '" >' + lang + "</a>";
}


// Eventhandler to start drag & drop
function dragstart(event, text) {
  event.dataTransfer.setData("TEXT", text);
}

// Collection is changed, so create a linkList
// for the linkArea

function onchangeCollection() {
  const cl = $("#collection").val();
  const linkArea = $("#linkArea");
  const regexToken = /(https?:\/\/[^\[\] \n\r()]*)/g;
  let linkList;
  window.linklist = [];
  let result = "";
  function linkShortener(link) {
    if (link.length < 50) return link;
    return link.substr(0, 40) + " . . . " + link.substr(link.length - 5, 5);
  }


  while ((linkList = regexToken.exec(cl)) !== null) {
    const link = linkList[0];
    let found = false;


    window.linklist.forEach(function (l) { // jshint ignore:line
      if (l === link) found = true;
    });
    if (found) continue;
    window.linklist.push(link);
    if (window.articleReferences[link] && (window.articleReferences[link]).length > 0) {
      result += '<a class="badge badge-danger" href="' + link + '" target="_blank" >' + linkShortener(link) + " #(Check for Doublette)</a>\n";
    } else result += '<a class="badge badge-secondary" href="' + link + '" target="_blank" >' + linkShortener(link) + "</a>\n";
    result += " " + generateGoogleTranslateLink(link, window.leftLang);
    if (window.rightLang !== "--" && window.rightLang !== "") {
      result += " " + generateGoogleTranslateLink(link, window.rightLang);
    }
    if (window.lang3 !== "--" && window.lang3 !== "") {
      result += " " + generateGoogleTranslateLink(link, window.lang3);
    }
    if (window.lang4 !== "--" && window.lang4 !== "") {
      result += " " + generateGoogleTranslateLink(link, window.lang4);
    }

    result += "<br>\n";
  }
  result = "<p>" + result + "</p>";

  if (linkArea) {
    linkArea.html(result);
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

// dragStart Event
function ondragstartflag (event, id) {
  const image = document.getElementById(id);
  let src = image.src;
  src = "![(" + id + ")](" + src + ")";
  event.dataTransfer.setData("TEXT", src);
}

function ondragstartLangLabel(event, lang) {
  const v = $("#markdown" + lang).val();
  event.dataTransfer.setData("TEXT", v);
}


// Fit to content event
// justify the size of the textfield to the shown content
function FitToContent() {
  /* jshint validthis: true */
  if (!this) return;
  const textfield = this;
  textfield.style.height = textfield.style.minHeight;
  const adjustedHeight = Math.max(textfield.scrollHeight, textfield.clientHeight);
  if (adjustedHeight > textfield.clientHeight) {
    textfield.style.height = adjustedHeight + "px";
  }
}

// Enable & Disable the different languages
function showRL(what) {
  $(".RL").addClass("hidden");
  $(".RLOFF").removeClass("hidden");
  if (what === window.leftLang) what = window.rightLang;
  $(".RL-" + what).removeClass("hidden");
  $(".RLOFF-" + what).addClass("hidden");
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
  /* jshint validthis: true */

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
    $(".translate" + langFrom + langTo).addClass("hidden");
    $(".translateWait" + langFrom + langTo).removeClass("hidden");
    const from =  langFrom.toLowerCase();
    const to = langTo.toLowerCase();
    let originalText = document.getElementById("preview" + langFrom).innerText;
    if (service === "deeplPro" || service === "bingPro" || service === "copy") {
      originalText = document.getElementById("markdown" + langFrom).value;
    }
    if (service !== "deepl") {
      jQuery.post(window.htmlroot + "/article/translate/" + service + "/" + from + "/" + to, { text: originalText }, function (data) {
        // data = data.replace(/] \(/g, "](");
        $(".translateWait" + langFrom + langTo).addClass("hidden");
        $(".translateDone" + langFrom + langTo + "." + service).removeClass("hidden");
        $("#markdown" + langTo).val(data).trigger("change");
      }).fail(function () {
        $(".translateWait" + langFrom + langTo).addClass("hidden");
        $(".translateError" + langFrom + langTo).removeClass("hidden");
      });
    } else {
      // service is deepl unpaid, just open the window
      window.open("https://www.deepl.com/translator#" + langFrom + "/" + langTo + "/" + originalText, "_blank");
      $(".translateWait" + langFrom + langTo).addClass("hidden");
      $(".translateDone" + langFrom + langTo + "." + service).removeClass("hidden");
    }
  });
}
