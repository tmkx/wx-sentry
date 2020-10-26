/**
 * Returns a timestamp in seconds since the UNIX epoch using the Date API.
 */
export function dateTimestampInSeconds() {
  return Date.now() / 1000;
}
