import axios from "axios";

import config from "../config.js";
import util from "./util.js";
import ssrfAgents from "./ssrfAgents.js";

const userAgent = config.getValue("User-Agent", { mustExist: true });

// Own axios instance: the charset decoder must only see these pages. On
// the global instance it also ran on every other request in flight
// (DeepL, osmcal, webhooks) and threw on their already parsed JSON.
const client = axios.create();
client.interceptors.response.use(util.charsetDecoder);

/**
 * Loads a web page an editor named (link title, readability, first draft)
 * and returns its HTML as a string, decoded from the page's charset.
 * Local and private addresses are refused (ssrfAgents), also after a
 * redirect.
 * @param {string} url the page
 * @param {object} [options]
 * @param {number} [options.timeout] milliseconds until the request is
 *   aborted (axios error code ECONNABORTED), default 10 s
 * @returns {Promise<string>} the HTML of the page
 */
export async function fetchExternalPage(url, { timeout = 10000 } = {}) {
  const response = await client.get(url, {
    httpAgent: ssrfAgents.httpAgent,
    httpsAgent: ssrfAgents.httpsAgent,
    headers: { "User-Agent": userAgent },
    timeout: timeout,
    responseType: "arraybuffer",
    responseEncoding: "binary"
  });
  return response.data;
}

export default { fetchExternalPage };
