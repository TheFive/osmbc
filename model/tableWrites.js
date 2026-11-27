// Tells interested modules that a table was written by this process, e.g.
// so a cache of derived data can drop its copy. pgMap.save/remove and
// logModule.log report every write; listeners must be cheap and must not
// throw (they run inside the write's callback path).

const listeners = [];

/**
 * Register a function that is called with the table name after every
 * insert, update or delete done through pgMap or logModule.log.
 * @param {Function} listener (table) => void
 */
export function onTableWrite(listener) {
  listeners.push(listener);
}

/**
 * Report a write to `table` to all listeners. Called by the persistence
 * layer only; also after a failed write, as the row may have changed.
 * @param {string} table table name, e.g. "article"
 */
export function reportTableWrite(table) {
  for (const listener of listeners) listener(table);
}
