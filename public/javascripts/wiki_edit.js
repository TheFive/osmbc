// Wiki editor: live preview (rendered by the server, so missing-page links
// and image paths look exactly like on the page), save feedback and a
// warning before leaving with unsaved changes. No inline handlers.
(function () {
  "use strict";

  function init() {
    const form = document.getElementById("wikiEditForm");
    if (!form) return;
    const textarea = document.getElementById("wikiMarkdown");
    const preview = document.getElementById("wikiPreview");
    const state = document.getElementById("wikiSaveState");
    const saveButton = document.getElementById("wikiSave");
    const previewUrl = form.dataset.previewUrl;
    const pageId = form.dataset.pageId;
    const initialText = textarea.value;
    let timer = null;
    let requestNumber = 0;
    let submitting = false;

    function updatePreview() {
      const current = ++requestNumber;
      fetch(previewUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ id: pageId, markdown: textarea.value })
      })
        .then(function (response) {
          if (!response.ok) throw new Error("Preview failed (" + response.status + ")");
          return response.json();
        })
        .then(function (data) {
          if (current !== requestNumber) return; // a newer request is on its way
          preview.innerHTML = data.html;
          preview.classList.remove("text-danger");
        })
        .catch(function (err) {
          if (current !== requestNumber) return;
          preview.textContent = err.message;
          preview.classList.add("text-danger");
        });
    }

    function modified() {
      return textarea.value !== initialText;
    }

    textarea.addEventListener("input", function () {
      state.textContent = modified() ? "Not saved" : "";
      clearTimeout(timer);
      timer = setTimeout(updatePreview, 400);
    });

    form.addEventListener("submit", function () {
      submitting = true;
      saveButton.disabled = true;
      state.textContent = "Saving …";
    });

    window.addEventListener("beforeunload", function (event) {
      if (submitting || !modified()) return;
      event.preventDefault();
      event.returnValue = "";
    });

    // image upload: the server stores the file and returns the Markdown,
    // which is inserted at the cursor
    const upload = document.getElementById("wikiUpload");
    const uploadState = document.getElementById("wikiUploadState");
    if (upload) {
      upload.addEventListener("change", function () {
        const file = upload.files && upload.files[0];
        if (!file) return;
        const maxBytes = Number(upload.dataset.maxBytes) || 0;
        if (maxBytes && file.size > maxBytes) {
          uploadState.textContent = "Too large (max " + Math.round(maxBytes / 1024 / 1024) + " MB)";
          upload.value = "";
          return;
        }
        uploadState.textContent = "Uploading " + file.name + " …";
        const reader = new FileReader();
        reader.onload = function () {
          fetch(upload.dataset.uploadUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ page: pageId, fileName: file.name, data: reader.result })
          })
            .then(function (response) {
              return response.json().then(function (data) {
                if (!response.ok) throw new Error(data.error || ("Upload failed (" + response.status + ")"));
                return data;
              });
            })
            .then(function (data) {
              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;
              const text = textarea.value;
              textarea.value = text.substring(0, start) + data.markdown + text.substring(end);
              textarea.selectionStart = textarea.selectionEnd = start + data.markdown.length;
              textarea.dispatchEvent(new Event("input"));
              uploadState.textContent = "Uploaded " + data.mediaPath;
            })
            .catch(function (err) {
              uploadState.textContent = err.message;
            })
            .then(function () { upload.value = ""; });
        };
        reader.onerror = function () { uploadState.textContent = "Could not read " + file.name; };
        reader.readAsDataURL(file);
      });
    }

    updatePreview();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
