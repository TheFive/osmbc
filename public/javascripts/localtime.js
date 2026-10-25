// Adds the browser's local time behind every <time data-localtime data-tz="...">,
// if the browser runs in another timezone than the one shown by the server.
document.addEventListener("DOMContentLoaded", function () {
  const browserTz = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  document.querySelectorAll("time[data-localtime]").forEach(function (element) {
    if (element.dataset.tz === browserTz) return;
    const date = new Date(element.getAttribute("datetime"));
    if (Number.isNaN(date.getTime())) return;
    const span = document.createElement("span");
    span.className = "text-muted";
    span.textContent = " (local: " + date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZoneName: "short" }) + ")";
    element.after(span);
  });
});
