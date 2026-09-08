// Wraps a messageCenter receiver so that updateArticle/updateBlog events
// authored by a migration-style user are suppressed before they reach it -
// safety mechanism (c2) agreed for the Blog-Sync-Merger (see
// CLAUDE.local.md): a bulk merge run touching many historical, already-
// closed WN issues must not spam editor mail/Slack notifications the way a
// live human edit would.
//
// Deliberately NOT applied to LogModuleReceiver (the Postgres `changes`
// audit trail) or ExportReceiver - the changes log must keep recording
// every migration write both for editor transparency and because
// merger/rollback.js depends on reading it back.
//
// "Migration-style user" is not just the one hardcoded name: routes/api.js
// applyBlogSync attributes every write to the calling key's own `apiKeys`
// value directly (see getBlogSyncUser - KISS, no second config map) - e.g.
// a data admin's own automated run (a Python template hitting the same
// endpoint, see CLAUDE.local.md 2026-09-05) shows up under whatever name
// their key is configured with. The filter has to recognize ALL of those,
// not just the historical hardcoded one - built directly from `apiKeys`
// itself (a finite, already-explicit list one admin controls), not a
// prefix/pattern guess. This does NOT collide with the outstanding-export
// endpoint's own "apikey:<label>" attribution (getOutstandingExportUser) -
// that one always carries the "apikey:" prefix, so it can never exactly
// equal one of these bare apiKeys values.
import FilterReceiver from "./FilterReceiver.js";
import config from "../config.js";

export const SYNTHETIC_MIGRATION_USER_NAME = "wp-backport";

function getKnownMigrationUserNames() {
  const apiKeys = config.getValue("apiKeys", { default: {} });
  return new Set([SYNTHETIC_MIGRATION_USER_NAME, ...Object.values(apiKeys)]);
}

function isNotMigrationUser(user) {
  return !(user && getKnownMigrationUserNames().has(user.OSMUser));
}

// Every messageCenter method whose first argument is the acting `user`
// object. All of them can be reached by a Blog-Sync-Merger run:
// updateArticle/updateBlog on every create/patch and on withReopenedBlog's
// status flips; addComment via model/article.js's addCommentWhenUnpublished
// (the two-step trash in replace mode writes a "#solved ... Reason: ..."
// comment on every article it moves to Trash - found the hard way, a real
// editor-mail flood on the WN219 prod run); sendReviewStatus/sendCloseStatus
// are not on the migration path today but cost nothing to guard. sendInfo
// is deliberately absent - its first argument is a plain object, not a
// user, and nothing on the migration path emits it.
export function suppressMigrationNotifications(receiver) {
  return new FilterReceiver(receiver, {
    updateArticle: isNotMigrationUser,
    updateBlog: isNotMigrationUser,
    addComment: isNotMigrationUser,
    editComment: isNotMigrationUser,
    sendReviewStatus: isNotMigrationUser,
    sendCloseStatus: isNotMigrationUser
  });
}

export default { SYNTHETIC_MIGRATION_USER_NAME, suppressMigrationNotifications };
