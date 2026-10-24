/* global markdownit, fitToContent, addSpinnerAndSubmit */

// First Draft while collecting (collect.pug): the collector gets a draft of
// the markdown in their language (and a compact title, which replaces the
// page title unless the user changed it) and saves the link only, or the
// link with the (edited) draft. The draft is made for a new link right away, for a link
// that was found in other articles only on request.

(function () {
  const area = document.getElementById("firstDraftArea");
  if (!area) return;
  const lang = area.dataset.lang;
  const url = area.dataset.url;
  const startButton = document.getElementById("firstDraftStart");
  const wait = document.getElementById("firstDraftWait");
  const error = document.getElementById("firstDraftError");
  const field = document.getElementById("firstDraftMarkdown");
  const preview = document.getElementById("firstDraftPreview");
  const saveLinkButton = document.getElementById("OK");
  const saveDraftButton = document.getElementById("OKWithDraft");
  const md = markdownit();
  const title = document.getElementById("title");
  // the page's own title, replaced by Claude's unless the user changed it
  const pageTitle = title ? title.value : "";

  function showPreview() {
    preview.innerHTML = md.render(field.value);
    preview.classList.toggle("d-none", field.value.trim() === "");
  }

  window.updateDraftSaveButton = function () {
    const titleOk = title && title.value.trim().length > 5;
    saveDraftButton.disabled = !titleOk || field.disabled || field.value.trim() === "";
  };

  function makeDraft() {
    startButton.classList.add("d-none");
    error.classList.add("d-none");
    wait.classList.remove("d-none");
    jQuery.post(window.htmlroot + "/article/firstdraft/" + encodeURIComponent(lang), { url: url, withTitle: "true" }, function (draft) {
      wait.classList.add("d-none");
      if (title && draft.title && title.value === pageTitle) {
        title.value = draft.title;
        title.dispatchEvent(new Event("change"));
      }
      field.value = draft.markdown;
      field.disabled = false;
      field.classList.remove("d-none");
      fitToContent(field);
      showPreview();
      window.updateDraftSaveButton();
    }, "json").fail(function (jqXHR) {
      wait.classList.add("d-none");
      error.textContent = "First Draft failed: " + (jqXHR.responseText || jqXHR.statusText);
      error.classList.remove("d-none");
      startButton.classList.remove("d-none");
    });
  }

  startButton.addEventListener("click", makeDraft);
  field.addEventListener("input", function () {
    showPreview();
    window.updateDraftSaveButton();
  });
  // "Save link only": a disabled field is not sent with the form
  saveLinkButton.addEventListener("click", function () { field.disabled = true; }, true);
  saveDraftButton.addEventListener("click", function () { addSpinnerAndSubmit("#OKWithDraft"); });

  if (area.dataset.auto === "true") makeDraft();
  else startButton.classList.remove("d-none");
})();
