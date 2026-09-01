// Generic receiver wrapper: forwards a messageCenter event to the wrapped
// receiver only if the given predicate (keyed by method name) returns true
// for that event's arguments; otherwise it just calls back without
// touching the wrapped receiver at all.
//
// This formalizes, as a reusable building block, the same idea
// UserConfigFilter already applies ad-hoc for per-user mail preferences:
// "every setAndSave change is broadcast to every receiver, and it's up to
// each receiver (or a filter sitting in front of it) to decide whether
// it's actually relevant." Use it to keep a receiver from reacting to
// changes it was never meant to see - e.g. wrapping LogModuleReceiver so
// purely operational fields (like the `exportedBy` export marker, see
// notification/exportReceiver.js) don't turn into a Postgres changes-log
// row that editors see in the blog history tab.
//
// filters: { [methodName]: (...eventArgs) => boolean }
// Any method without an entry in `filters` is passed through unfiltered.

import _debug from "debug";

const debug = _debug("OSMBC:notification:FilterReceiver");

const RECEIVER_METHODS = [
  "sendInfo",
  "updateArticle",
  "updateBlog",
  "sendReviewStatus",
  "sendCloseStatus",
  "addComment",
  "editComment"
];

class FilterReceiver {
  constructor(receiver, filters) {
    this.receiver = receiver;
    this.filters = filters || {};
  }
}

for (const method of RECEIVER_METHODS) {
  FilterReceiver.prototype[method] = function (...args) {
    debug("FilterReceiver::%s", method);
    const callback = args[args.length - 1];
    const eventArgs = args.slice(0, -1);
    const filter = this.filters[method];
    if (filter && !filter(...eventArgs)) return callback();
    return this.receiver[method](...args);
  };
}

export default FilterReceiver;
