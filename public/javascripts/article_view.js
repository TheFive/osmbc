"use strict";



// Init This Window with jQuery ready Callback
$(document).ready(init);




// unlaodWindow Handler, to generate messages that form is left unsaved
function unloadWindowWarning(event) {
  let dialogText = "Oops, it looks like you have forgotten to save your work.";
  event.returnValue = dialogText;
  return dialogText;
}

var mdRender;
// initialise all callbacks with jQuery
function init() {
  mdRender = window.markdownit();
  mdRender.use(window.markdownitSup);
  mdRender.use(window["markdown-it-imsize.js"]);
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
  $('[data-toggle="tooltip"]').tooltip();
  window.submitAndRedraw = submitAndRedraw;
  window.saveButton = saveButton;
}

function saveButton() {
  function save() {
    disableUnchanged(); document.getElementById("input").submit();
  }
  if (document.getElementById("comment").value.trim() === "") return save();

  var jqForm = $("form#AddComment");
  var url = jqForm.attr("action");
  var toPost = jqForm.serialize();

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
  var object = $(this);
  var md = object.val();
  if (md && md.trim() === "-") {
    object.val("no translation");
    object.trigger("change");
  }
}




// Function to convert markdown into html
// Add the Blog typic list element to preview, but only
// for specific types, (Missing: configuring this by user.)
function convert(text) {
  // The cut at the beginning is a little bit "historic" from the
  // OSMBC startup, so only used for emotional motivation of the developer :-)
  if (text.substring(0, 2) === "* ") text = text.substring(2, 999999);


  // convert md to html
  text = mdRender.render(text);


  // Display as list, this should depend on type

  var cat = $("#categoryEN").val();
  if (cat !== "Picture" && cat !== "Events" && cat !== "Releases") {
    text = "<ul><li>" + text + "</li></ul>";
  }
  return text;
}

// Test, wether a text is an url or not
// based on regex.
function isURL(t) {
  var isUrlRegex = /^(http|ftp|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/;
  if (t) return isUrlRegex.test(t);
  return isUrlRegex;
}

// Try to copy text to the clipboard
// if it fails, alert an error and offer the possibility to copy manual
function clip(text) {
  var copyElement = document.createElement("input");
  copyElement.setAttribute("type", "text");
  copyElement.setAttribute("value", text);
  copyElement = document.body.appendChild(copyElement);
  copyElement.select();
  try {
    if (!document.execCommand("copy")) throw new Error("Not allowed.");
  } catch (e) {
    copyElement.remove();
    prompt("Copy not supported, use your mobile to copy and press enter", text);
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
  var tb = par1.text.substring(0, par1.startselection);
  var ta = par1.text.substring(par1.endselection, 99999);

  // beforeSnip == selected Text before paste
  // afterSnip == selected Text after Insert
  var beforeSnip = par1.text.substring(par1.startselection, par1.endselection);
  var afterSnip = par2.text.substring(par1.startselection, par2.endselection);

  // only in the case, the "afterSnip" variable contains an URL, something
  // has to be done
  if (isURL(afterSnip.trim())) {
    afterSnip = afterSnip.trim();

    // Check, wether, the url is pasted into brackets ()
    // then nothing has to be done
    var alreadyMarkdowned = false;
    if (tb.length > 2 && tb.charAt(tb.length - 1) === "(" && tb.charAt(tb.length - 2) === "]") alreadyMarkdowned = true;
    if (ta !== "" && tb.charAt(0) === ")") alreadyMarkdowned = true;
    if (!alreadyMarkdowned) {
      // combine the new text
      var r = tb + "[" + beforeSnip + "](" + afterSnip + ")" + ta;

      // calculate the position to point to
      // for the new text
      // Between [] in the case, that only a link was added
      // after the [link](http://somewhere) in case the link has already a "display" word
      var c;
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

  var mf = this;

  // Generate a triple of text, start selection and end selection BEFORE Pasting new text
  var before = { text: mf.value, startselection: mf.selectionStart, endselection: mf.selectionEnd };

  setTimeout(function () {
    // Generate a triple of text, start selection and end selection AFTER Pasting new text
    var after = { text: mf.value, startselection: mf.selectionStart, endselection: mf.selectionEnd };

    // And use the result, to generate the markdown link
    var r = generateMarkdownLink2(before, after);

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
  var md = this.value;
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
  var md = this.value;
  var preview = $(".preview[lang=" + this.lang + "]");
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
  var md = this.value;
  if (!window.linklist) window.linklist = [];
  var text = $(".markdownMessage[lang=" + this.lang + "]");
  var errorOccured = false;

  // Check for long links
  var longLink = md.search(/\[[^\]]{40,}\]/g);
  if (longLink >= 0) {
    text.show(400);
    text.html("Please shorten [" + md.substring(longLink + 1, longLink + 40) + "...]");
    errorOccured = true;
  }

  var linkList;
  var allLinksFound = true;
  var linkFromCollectionFound = false;
  var allLinks = [];
  var errorLinkTwice = null;

  var regexToken = /(https?:\/\/[^\[\] \n\r()]*)/g;
  while ((linkList = regexToken.exec(md)) !== null) {
    var link = linkList[0];
    if (allLinks.indexOf(link) >= 0) {
      errorLinkTwice = link;
    }
    allLinks.push(link);

    var linkFound = false;
    for (var i = 0; i < window.linklist.length; i++) {
      if (window.linklist[i] === link) linkFound = true;
    }
    // check Language Flags
    if ($("img.flag[src='" + link + "']").length > 0) linkFound = true;
    if (linkFound) linkFromCollectionFound = true;
    if (!linkFound) allLinksFound = false;
  }
  if (allLinksFound === false) {
    text.show(400);
    text.html("Please check links, some looks not to be in collection, nor be a translation link");
    errorOccured = true;
  }
  if (linkFromCollectionFound === false && md !== "" && md !== "no translation") {
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
  var googlelang = lang;
  if (lang === "JP") googlelang = "JA";
  if (lang === "CZ") googlelang = "CS";
  var gtl = "https://translate.google.com/translate?sl=auto&tl=" + googlelang + "&u=" + link;
  window.linklist.push(gtl);

  var gtlMarkdown = "(automatic [translation](##link##))";
  if (window.googleTranslateText[lang]) gtlMarkdown = window.googleTranslateText[lang];


  gtlMarkdown = gtlMarkdown.replace("##link##", gtl);

  var dragstartFunction = "dragstart(event,'" + gtlMarkdown + "');";

  return '<a href="' + gtl + '" target="_blank" ondragstart="' + dragstartFunction + '" >' + lang + "</a>";
}


// Eventhandler to start drag & drop
function dragstart(event, text) {
  event.dataTransfer.setData("TEXT", text);
}

// Collection is changed, so create a linkList
// for the linkArea

function onchangeCollection() {
  var cl = $("#collection").val();
  var linkArea = $("#linkArea");
  var regexToken = /(https?:\/\/[^\[\] \n\r()]*)/g;
  var linkList;
  window.linklist = [];
  var result = "";
  function linkShortener(link) {
    if (link.length < 50) return link;
    return link.substr(0, 40) + " . . . " + link.substr(link.length - 5, 5);
  }


  while ((linkList = regexToken.exec(cl)) !== null) {
    var link = linkList[0];
    var found = false;
    window.linklist.forEach(function(l) {
      if (l === link) found = true;
    });
    if (found) continue;
    window.linklist.push(link);
    if (window.articleReferences[link] && (window.articleReferences[link]).length > 0) {
      result += '<a class="label label-danger" href="' + link + '" target="_blank" >' + linkShortener(link) + "</a>\n";
    } else result += '<a class="label label-default" href="' + link + '" target="_blank" >' + linkShortener(link) + "</a>\n";
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
  var src = $("#" + id).attr("src");


  src = "![(" + id + ")](" + src + ")";
  clip(src);
  alert(id + " flag is copied to clipboard");
}

// dragStart Event
function ondragstartflag (event, id) {
  let image = document.getElementById(id);
  let src = image.src;
  src = "![(" + id + ")](" + src + ")";
  event.dataTransfer.setData("TEXT", src);
}

function ondragstartLangLabel(event, lang) {
  var v = $("#markdown" + lang).val();
  event.dataTransfer.setData("TEXT", v);
}


// Fit to content event
// justify the size of the textfield to the shown content
function FitToContent() {
  /* jshint validthis: true */
  if (!this) return;
  var textfield = this;
  textfield.style.height = textfield.style.minHeight;
  var adjustedHeight = Math.max(textfield.scrollHeight, textfield.clientHeight);
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
  var c = $("#categoryEN").val();
  if (window.placeholder[c]) {
    $("#categoryDisplay").html(window.placeholder[c]);
  } else {
    $("#categoryDisplay").html("Missing Category Description");
  }
}

function showModified() {
  /* jshint validthis: true */

  var modified = false;

  var newVal = $(this).val();
  var oldVal = $("#old_" + this.name + ":hidden").val();

  var modifiedColor = "#ffffcc";
  var normalColor = "";
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

  $(".af").each(function(index, object) {
    var newVal = $(this).val();
    var oldVal = $("#old_" + this.name + ":hidden").val();

    if (oldVal !== newVal) {
      modified = true;
    }
  });
  $("#saveButton").prop("disabled", !modified);
  if (modified) {
    $(window).on("beforeunload", unloadWindowWarning);
  } else {
    $(window).off("beforeunload", unloadWindowWarning);
  }
}

function showHideUnpublishReason() {
  var c = $("#categoryEN").val();
  var b = $("#blog").val();

  var hidden = true;
  if (c === "--unpublished--") hidden = false;
  if (b === "Trash") hidden = false;

  if (hidden) $("#unpublishReasonRow").addClass("hidden");
  else $("#unpublishReasonRow").removeClass("hidden");
}


function redrawFunc(redraw) {
  var k;
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
  var jqForm = $(form);
  var url = jqForm.attr("action");

  var toPost = jqForm.serialize();


  // clean unchanged values, to reduce post overhead.
  for (var k in toPost) {
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
  /* jshint validthis: true */

  $(".markdownEdit").each(function(item) {
    if (this.value === "" && !this.readOnly) this.value = "no translation";
  });
}

function translate(langFrom, langTo, service) {
  $(".translate" + langFrom + langTo).addClass("hidden");
  $(".translateWait" + langFrom + langTo).removeClass("hidden");
  var from =  langFrom.toLowerCase();
  var to = langTo.toLowerCase();
  var originalText = document.getElementById("markdown" + langFrom).value;
  if (service !== "deepl") {
    jQuery.post(window.htmlroot + "/article/translate/" + service + "/" + from + "/" + to, { text: originalText }, function (data) {
      console.info("Translation received");
      data = data.replace(/] \(/g, "](");
      $(".translateWait" + langFrom + langTo).addClass("hidden");
      $(".translateDone" + langFrom + langTo + "." + service).removeClass("hidden");
      $("#markdown" + langTo).val(data).trigger("change");
    }).fail(function (err) {
      console.error("Translation failed");
      console.error(err);
      $(".translateWait" + langFrom + langTo).addClass("hidden");
      $(".translateError" + langFrom + langTo).removeClass("hidden");
    });
  } else {
    window.open("https://www.deepl.com/translator#" + langFrom + "/" + langTo + "/" + originalText, "_blank");
    $(".translateWait" + langFrom + langTo).addClass("hidden");
    $(".translateDone" + langFrom + langTo + "." + service).removeClass("hidden");
  }
}


