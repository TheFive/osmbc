// Weekly points in time ("every Thursday 00:00") for the transition rules
// and the blog creation. Calculated in the timezone of the server process.

const WEEKDAYS = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

function parseNumber(value, fallback) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;
  return fallback;
}

function isIntegerIn(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

// weekday as 0-6 from SUN…SAT (any case) or a number, null if invalid
function parseWeekday(value) {
  const weekday = (typeof value === "string") ? WEEKDAYS[value.trim().toUpperCase()] : value;
  return isIntegerIn(weekday, 0, 6) ? weekday : null;
}

/**
 * Check and normalise a weekly time from the config.
 * @param {object} raw `{ weekday, hour, minute }`; weekday is `SUN`…`SAT`
 *   (any case) or 0–6, hour/minute default to 12:00
 * @param {boolean} [allowHour24] accept `hour: 24` (with minute 0) as the end
 *   of that day; it is returned as 0:00 of the next weekday
 * @returns {{weekday: number, hour: number, minute: number}|null} null if
 *   missing or invalid
 */
export function normaliseWeeklyTime(raw, allowHour24) {
  if (!raw || typeof raw !== "object") return null;

  const weekday = parseWeekday(raw.weekday);
  if (weekday === null) return null;

  const hour = parseNumber(raw.hour, 12);
  const minute = parseNumber(raw.minute, 0);

  if (allowHour24 && hour === 24 && minute === 0) {
    return { weekday: (weekday + 1) % 7, hour: 0, minute: 0 };
  }
  if (!isIntegerIn(hour, 0, 23) || !isIntegerIn(minute, 0, 59)) return null;

  return { weekday: weekday, hour: hour, minute: minute };
}

/**
 * First point in time with the given weekday and time at or after a
 * reference time. Uses local calendar days, so it stays at the same wall
 * clock time across a daylight saving change.
 * @param {number} referenceTs reference time in ms
 * @param {{weekday: number, hour: number, minute: number}} at from
 *   normaliseWeeklyTime
 * @returns {number} time in ms
 */
export function nextWeeklyTimeAtOrAfter(referenceTs, at) {
  const result = new Date(referenceTs);

  result.setHours(at.hour, at.minute, 0, 0);
  const dayDiff = (at.weekday - result.getDay() + 7) % 7;
  result.setDate(result.getDate() + dayDiff);

  if (result.getTime() < referenceTs) {
    result.setDate(result.getDate() + 7);
  }

  return result.getTime();
}
