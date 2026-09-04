// Wraps a messageCenter receiver so that updateArticle/updateBlog events
// authored by the Blog-Sync-Merger's synthetic user are suppressed before
// they reach it - safety mechanism (c2) agreed for the Blog-Sync-Merger
// (see CLAUDE.local.md): a bulk merge run touching many historical,
// already-closed WN issues must not spam editor mail/Slack notifications
// the way a live human edit would.
//
// Deliberately NOT applied to LogModuleReceiver (the Postgres `changes`
// audit trail) or ExportReceiver - the changes log must keep recording
// every migration write both for editor transparency and because
// merger/rollback.js depends on reading it back.

import FilterReceiver from "./FilterReceiver.js";

export const SYNTHETIC_MIGRATION_USER_NAME = "wp-backport";

function isNotMigrationUser(user) {
  return !(user && user.OSMUser === SYNTHETIC_MIGRATION_USER_NAME);
}

export function suppressMigrationNotifications(receiver) {
  return new FilterReceiver(receiver, {
    updateArticle: isNotMigrationUser,
    updateBlog: isNotMigrationUser
  });
}

export default { SYNTHETIC_MIGRATION_USER_NAME, suppressMigrationNotifications };
