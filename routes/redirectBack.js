import config from "../config.js";


/**
 * The page the request came from (Referer header), if it may be used as a
 * redirect target: a page of this server (same host and port; the protocol
 * may differ behind a TLS proxy) and not the OSM login callback (that would
 * start the login again). Everything else - no Referer, a foreign or
 * unparsable one - gives undefined. This check is what keeps the "back to
 * where you were" redirects from becoming an open redirect.
 * @param {object} req the express request
 * @returns {string|undefined} the absolute URL of that page
 */
export function sameHostReferer(req) {
  const referer = req.header("Referer");
  if (!referer) return undefined;
  let refererUrl;
  try {
    refererUrl = new URL(referer);
  } catch (err) {
    return undefined;
  }
  if (refererUrl.protocol !== "https:" && refererUrl.protocol !== "http:") return undefined;
  if (refererUrl.host !== req.get("host")) return undefined;
  if (refererUrl.pathname.includes("/auth/openstreetmap")) return undefined;
  return refererUrl.href;
}

/**
 * Answers a form POST with a redirect back to the page the user came from,
 * so a deep link stays where it was; see sameHostReferer for which pages
 * count. Otherwise it goes to the fallback.
 * @param {object} req the express request
 * @param {object} res the express response
 * @param {string} [fallback] target without a usable Referer, default start page
 */
export function redirectBack(req, res, fallback = config.htmlRoot() + "/osmbc") {
  res.redirect(sameHostReferer(req) ?? fallback);
}

export default { sameHostReferer, redirectBack };
