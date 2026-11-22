import axios from "axios";
import _debug from "debug";

import config from "../config.js";
import ssrfAgents from "../util/ssrfAgents.js";

const debug = _debug("OSMBC:util:linkCheck");

const userAgent = config.getValue("User-Agent", { mustExist: true });

const REQUEST_TIMEOUT_MS = 20000;

// Answers that say nothing about whether the page exists: bot protection
// (DataDome, Cloudflare), login walls, geo blocking. An editor can confirm
// such a link (model/link.js).
const BLOCKED_STATUS = new Set([401, 403, 451]);

// Certificate problems Node reports although browsers often open the page
// (e.g. a missing intermediate certificate, which browsers fetch themselves).
const CERTIFICATE_ERRORS = new Set([
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "UNABLE_TO_GET_ISSUER_CERT", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "SELF_SIGNED_CERT_IN_CHAIN", "DEPTH_ZERO_SELF_SIGNED_CERT", "CERT_HAS_EXPIRED", "CERT_UNTRUSTED",
  "ERR_TLS_CERT_ALTNAME_INVALID"
]);

// Network errors that may be gone a moment later.
const TEMPORARY_ERRORS = new Set(["ECONNABORTED", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN", "ECONNREFUSED", "ERR_SOCKET_CONNECTION_TIMEOUT"]);

function requestOptions() {
  return {
    httpAgent: ssrfAgents.httpAgent,
    httpsAgent: ssrfAgents.httpsAgent,
    timeout: REQUEST_TIMEOUT_MS,
    headers: { "User-Agent": userAgent }
  };
}

// A GET that only waits for the status line and headers, the body is dropped.
function getWithoutBody(url) {
  return axios.get(url, Object.assign(requestOptions(), { responseType: "stream" })).then(function(response) {
    if (response.data && typeof response.data.destroy === "function") response.data.destroy();
    return response;
  });
}

function isTemporary(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

/**
 * Sorts a failed request into a link check result.
 * @param {Error} err the axios error
 * @returns {{state: string, status: (number|string)}} state "ok", "broken",
 *   "blocked" (page may exist, can't be checked) or "unreachable" (try later)
 */
function classifyError(err) {
  // www.openstreetmap.com is delivering content_length and transfer encoding, which
  // results node in throwing this error.
  // as the existance of the url is approved by this error, everything is fine.
  if (err.code === "HPE_UNEXPECTED_CONTENT_LENGTH") return { state: "ok", status: "OK" };
  if (err.response && err.response.status >= 300) {
    const status = err.response.status;
    if (BLOCKED_STATUS.has(status)) return { state: "blocked", status: status };
    if (isTemporary(status)) return { state: "unreachable", status: status };
    return { state: "broken", status: status };
  }
  if (CERTIFICATE_ERRORS.has(err.code)) return { state: "blocked", status: err.code };
  if (TEMPORARY_ERRORS.has(err.code)) return { state: "unreachable", status: err.code };
  return { state: "broken", status: (typeof err.message === "string") ? err.message : "NOK" };
}

// One HEAD request; a server that does not allow HEAD (405, 501) gets a GET.
function requestOnce(url) {
  return axios.head(url, requestOptions()).catch(function(err) {
    const status = err.response && err.response.status;
    if (status !== 405 && status !== 501) throw err;
    debug("HEAD not allowed for %s, trying GET", url);
    return getWithoutBody(url);
  }).then(function() {
    return { state: "ok", status: "OK" };
  }, classifyError);
}

/**
 * Checks whether an absolute url exists. A temporary problem (5xx, timeout,
 * dropped connection) is tried a second time, a rate limit (429) is not.
 * No cache here: model/link.js stores the results.
 * @param {string} url absolute http(s) url
 * @param {function(null, {state: string, status: (number|string)})} callback
 *   state is "ok", "broken" (404, 410, unknown host ...), "blocked" (401,
 *   403, 451, certificate error: the page may exist) or "unreachable";
 *   status is "OK", the HTTP status or an error code/message
 */
function checkLink(url, callback) {
  debug("checkLink %s", url);
  try {
    // eslint-disable-next-line no-unused-vars
    const testurl = new URL(url);
  } catch (error) {
    return callback(null, { state: "broken", status: `Invalid URI "${url}"` });
  }

  requestOnce(url).then(function(result) {
    if (result.state !== "unreachable" || result.status === 429) return result;
    debug("retry %s after %s", url, result.status);
    return requestOnce(url);
  }).then(function(result) {
    return callback(null, result);
  });
}

/**
 * Short form of checkLink.
 * @param {string} url absolute http(s) url
 * @param {function(null, (string|number))} callback "OK", the HTTP status
 *   (>= 300) or an error message
 */
function checkUrl(url, callback) {
  checkLink(url, function(err, result) {
    return callback(err, result.status);
  });
}

const linkCheck = {
  checkLink: checkLink,
  checkUrl: checkUrl
};

export default linkCheck;
