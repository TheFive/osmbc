// Mattermost message integration: one message per wiki change.
//
// The module does not know how OSMBC talks to Mattermost; the host passes
// a send(message) function (OSMBC: SlackAPI with the hook of the team).

const MODES = ["each", "off"];

function link(text, url) {
  return "[" + String(text).replace(/[[\]]/g, "") + "](" + url + ")";
}

// event: { type, id, user, rev, message, url, fromId, mediaPath }
export function wikiChangeText(event, siteUrl) {
  const pageLink = link(event.id, siteUrl + event.url);
  const diffLink = event.rev ? " (" + link("changes", siteUrl + event.url + "?diff=" + event.rev.substring(0, 12)) + ")" : "";
  const comment = event.message ? ": " + event.message : "";
  switch (event.type) {
    case "create": return "created wiki page " + pageLink + comment;
    case "edit": return "edited wiki page " + pageLink + comment + diffLink;
    case "revert": return "reverted wiki page " + pageLink + comment + diffLink;
    case "move": return "moved wiki page " + event.fromId + " to " + pageLink + comment;
    case "delete": return "deleted wiki page " + event.id + comment;
    case "upload": return "uploaded " + link(event.mediaPath, siteUrl + event.url) + " to the wiki";
    default: return "changed wiki page " + pageLink + comment;
  }
}

/**
 * settings: the wiki.mattermost config block { channel, mode } (may be null)
 * options: send(message) (returns nothing, logs its own errors),
 *          siteUrl (e.g. https://osmbc.example.com), botName, iconUrl, logger
 * Returns the onChange(event) function for the router.
 */
export function createWikiNotifier(settings, options) {
  const mode = (settings && settings.mode) || "off";
  if (!MODES.includes(mode)) {
    options.logger.error("Wiki: unknown wiki.mattermost.mode '" + mode + "', messages are off");
    return () => {};
  }
  if (mode === "off" || !settings.channel || typeof options.send !== "function") return () => {};
  return function onChange(event) {
    try {
      options.send({
        text: wikiChangeText(event, options.siteUrl || ""),
        channel: settings.channel,
        username: (options.botName || "osmbc") + "(" + event.user + ")",
        icon_url: options.iconUrl
      });
    } catch (err) {
      options.logger.error("Wiki: Mattermost message failed: " + err.message);
    }
  };
}
