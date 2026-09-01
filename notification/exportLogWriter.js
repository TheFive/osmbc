// Plain rotating-text-file audit trail for bulk-export marker writes
// (see CLAUDE.local.md, section "outstanding export").
//
// Deliberately NOT a messageCenter receiver and NOT going through
// setAndSave: marking a blog as exported is an operational record for
// admins, not editorial content. Routing it through setAndSave would
// (a) create a Postgres changes-log row visible to editors in the blog
// history tab, and (b) trigger the mail/Slack "blog changed" notification
// fan-out that messageCenter.global.updateBlog broadcasts on every field
// change - editors would get spurious "WN1234 changed status to ..."
// notifications every time an export pipeline pulls the outstanding ZIP.
//
// Mirrors the existing maillog_* convention (notification/mailReceiver.js):
// same winston + daily-rotate-file approach, less load on Postgres, admins
// can still read the file. Config keys are optional (default instead of
// mustExist) so existing environments don't need a config change to keep
// starting up.

import { join } from "path";
import { existsSync } from "fs";
import winston from "winston";
import "winston-daily-rotate-file";
import config from "../config.js";
import _debug from "debug";

const debug = _debug("OSMBC:notification:exportLogWriter");

let logDir = config.getValue("exportlog_directory", { default: "." });
const logNamePrefix = config.getValue("exportlog_prefix", { default: "exportlog%DATE%.log" });
const logNameDateFormat = config.getValue("exportlog_dateformat", { default: "YYYY-MM-DD" });
if (logDir === ".") logDir = join(config.getDirName(), "..");

if (!(existsSync(logDir))) {
  console.error("Missing Directory (exportlog_directory) %s", logDir);
  process.exit(1);
}

const transport = new winston.transports.DailyRotateFile({
  filename: logNamePrefix,
  dirname: logDir,
  datePattern: logNameDateFormat,
  level: "info"
});

const logger = winston.createLogger({
  transports: [transport]
});

// logMarkAsExported({user, blog, exportProfile, lang})
// user: OSMUser string (real user, or the synthetic "apikey:<label>"
//       identity used for shared API keys - see routes/api.js)
function logMarkAsExported({ user, blog, exportProfile, lang }) {
  debug("logMarkAsExported");
  logger.info({ user, blog, exportProfile, lang, timestamp: new Date().toISOString() });
}

const exportLogWriter = { logMarkAsExported };
export default exportLogWriter;

// Exposes the underlying winston logger so tests can stub logger.info(...)
// instead of asserting on the actual log file, same pattern as
// MailReceiverForTestOnly in notification/mailReceiver.js.
export const ExportLogWriterForTestOnly = { logger };
