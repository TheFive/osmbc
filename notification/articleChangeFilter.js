// Shared rules for "which article change is worth a notification" (issue
// #1170), used for users (UserConfigFilter: mail and Mattermost direct
// message) and for Mattermost channels (ConfigFilter).
//
// Three kinds of changes, each with its own setting:
// - new submission:     the article gets its first collection (Collect)
// - collection change:  an existing collection is changed
// - text change:        a markdown<LANG> text is changed; only reported
//                       when a guest made it (editors write texts all day)
// Submission and collection change have the levels "all", "guest" (only
// when a guest made the change), "editor" (only when a non-guest made it)
// and "off". A channel for guest control and one for the editors can so
// split the stream.

import language from "../model/language.js";
import util from "../util/util.js";

export const LEVEL_ALL = "all";
export const LEVEL_GUEST = "guest";
export const LEVEL_EDITOR = "editor";
export const LEVEL_OFF = "off";

/**
 * What an article change is, seen from the notification settings.
 * @param {object} user the user who makes the change (access "guest" marks a guest)
 * @param {object} article the article before the change
 * @param {object} change the changed fields
 * @returns {{newSubmission: boolean, collectionChange: boolean, textLangs: string[], byGuest: boolean}}
 *   textLangs: languages whose text changes
 */
export function classifyArticleChange(user, article, change) {
  const collectionChanged = !!change.collection && change.collection !== article.collection;
  const textLangs = [];
  for (const lang in language.getLanguages()) {
    const key = "markdown" + lang;
    if (typeof change[key] === "undefined") continue;
    if ((change[key] || "") === (article[key] || "")) continue;
    textLangs.push(lang);
  }
  return {
    newSubmission: collectionChanged && !article.collection,
    collectionChange: collectionChanged && !!article.collection,
    textLangs: textLangs,
    byGuest: !!user && user.access === "guest"
  };
}

/**
 * Normalises a setting value to "all", "guest", "editor" or "off". Accepts the user
 * form values and the channel config values (true/"true" = all).
 * @param {*} value the stored value
 * @param {*} fallback used when value is missing (undefined/null/"")
 * @returns {string} LEVEL_ALL, LEVEL_GUEST, LEVEL_EDITOR or LEVEL_OFF
 */
export function normaliseLevel(value, fallback) {
  if (typeof value === "undefined" || value === null || value === "") {
    if (typeof fallback === "undefined") return LEVEL_OFF;
    return normaliseLevel(fallback);
  }
  if (util.isTrue(value) || value === LEVEL_ALL) return LEVEL_ALL;
  if (value === LEVEL_GUEST) return LEVEL_GUEST;
  if (value === LEVEL_EDITOR) return LEVEL_EDITOR;
  return LEVEL_OFF;
}

function levelMatches(level, byGuest) {
  if (level === LEVEL_ALL) return true;
  if (level === LEVEL_GUEST) return byGuest;
  if (level === LEVEL_EDITOR) return !byGuest;
  return false;
}

/**
 * True if a change of the given kind passes the three settings.
 * @param {{newSubmission: boolean, collectionChange: boolean, textLangs: string[], byGuest: boolean}} kind
 *   result of classifyArticleChange
 * @param {{newSubmission: string, collectionChange: string, guestTextChange: boolean}} settings
 *   levels from normaliseLevel, guestTextChange as boolean
 * @returns {boolean} whether to notify
 */
export function articleChangeWanted(kind, settings) {
  if (kind.newSubmission && levelMatches(settings.newSubmission, kind.byGuest)) return true;
  if (kind.collectionChange && levelMatches(settings.collectionChange, kind.byGuest)) return true;
  if (kind.textLangs.length > 0 && kind.byGuest && settings.guestTextChange) return true;
  return false;
}

/**
 * The article notification settings of a user. Users saved before #1170
 * only have mailNewCollection ("true" = every new and changed collection),
 * which stays the default for both new settings.
 * @param {object} user the user (model object or plain data)
 * @returns {{newSubmission: string, collectionChange: string, guestTextChange: boolean}}
 */
export function userArticleSettings(user) {
  const old = util.isTrue(user.mailNewCollection) ? LEVEL_ALL : LEVEL_OFF;
  return {
    newSubmission: normaliseLevel(user.notifyNewCollection, old),
    collectionChange: normaliseLevel(user.notifyCollectionChange, old),
    guestTextChange: util.isTrue(user.notifyGuestTextChange)
  };
}

/**
 * The article notification settings of a Mattermost channel config entry.
 * notifyCollectionChange falls back to notifyNewCollection, which covered
 * both before #1170.
 * @param {object} channelConfig one entry of the slacknotification config
 * @returns {{newSubmission: string, collectionChange: string, guestTextChange: boolean}}
 */
export function channelArticleSettings(channelConfig) {
  return {
    newSubmission: normaliseLevel(channelConfig.notifyNewCollection),
    collectionChange: normaliseLevel(channelConfig.notifyCollectionChange, channelConfig.notifyNewCollection),
    guestTextChange: util.isTrue(channelConfig.notifyGuestTextChange)
  };
}

/**
 * Where a user wants the notifications: "mail" (default), "mattermost" or
 * "both".
 * @param {object} user the user
 * @returns {{mail: boolean, mattermost: boolean}}
 */
export function userNotifyVia(user) {
  const via = user.notifyVia;
  if (via === "mattermost") return { mail: false, mattermost: true };
  if (via === "both") return { mail: true, mattermost: true };
  return { mail: true, mattermost: false };
}

export default {
  classifyArticleChange,
  normaliseLevel,
  articleChangeWanted,
  userArticleSettings,
  channelArticleSettings,
  userNotifyVia
};
