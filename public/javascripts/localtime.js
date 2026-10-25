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
    // same rule as the server side text: weekday only within the coming week
    const days = Math.round((new Date(date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
    const options = (days >= 0 && days < 7)
      ? { weekday: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }
      : { weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZoneName: "short" };
    span.textContent = " (local: " + date.toLocaleString(undefined, options) + ")";
    element.after(span);
  });
});
