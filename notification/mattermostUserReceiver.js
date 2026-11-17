// Notifications for one user as Mattermost direct message (issue #1170).
//
// The user's wishes are the same as for mail (UserConfigFilter); the user
// picks the way with notifyVia ("mail", "mattermost", "both") and names
// the Mattermost account in the existing field SlackUser ("Mattermost
// User", also used for collecting from Mattermost). The message goes
// through the incoming webhook of the team named in the config
//
//   MattermostUserNotification:
//     team: <key of the slacktool block>
//
// to the channel "@<SlackUser>". Without that config the option is off.

import config from "../config.js";
import UserConfigFilter from "./UserConfigFilter.js";
import { SlackReceiver } from "./slackReceiver.js";
import { userNotifyVia } from "./articleChangeFilter.js";

/**
 * The slacktool team used for direct messages, or null when the feature
 * is not configured (missing block or unknown team).
 * @returns {string|null} the team key
 */
export function mattermostUserTeam() {
  const settings = config.getValue("MattermostUserNotification");
  if (!settings || typeof settings.team !== "string") return null;
  const hooks = config.getValue("slacktool") || {};
  if (!hooks[settings.team]) return null;
  return settings.team;
}

/**
 * The Mattermost user name a user's direct messages go to, or null.
 * @param {object} user the user
 * @returns {string|null} the name without a leading "@"
 */
export function mattermostName(user) {
  if (typeof user.SlackUser !== "string") return null;
  const name = user.SlackUser.trim().replace(/^@/, "");
  return name === "" ? null : name;
}

/**
 * Creates the receiver for a user's Mattermost direct messages, or null if
 * the user does not want them, has no Mattermost name or the feature is
 * not configured. Only full and guest users get notifications.
 * @param {object} user the user
 * @returns {UserConfigFilter|null} the filtered receiver
 */
export function createMattermostUserReceiver(user) {
  if (user.access !== "full" && user.access !== "guest") return null;
  if (!userNotifyVia(user).mattermost) return null;
  const name = mattermostName(user);
  if (!name) return null;
  const team = mattermostUserTeam();
  if (!team) return null;
  return new UserConfigFilter(user, new SlackReceiver("Mattermost user " + user.OSMUser, team, "@" + name));
}

export default { mattermostUserTeam, mattermostName, createMattermostUserReceiver };
