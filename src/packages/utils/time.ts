/**
 * An object that can return the current timestamp in seconds since the UNIX epoch.
 */
interface TimestampSource {
  nowSeconds(): number;
}

/**
 * A TimestampSource implementation for environments that do not support the Performance Web API natively.
 *
 * Note that this TimestampSource does not use a monotonic clock. A call to `nowSeconds` may return a timestamp earlier
 * than a previously returned value. We do not try to emulate a monotonic behavior in order to facilitate debugging. It
 * is more obvious to explain "why does my span have negative duration" than "why my spans have zero duration".
 */
const dateTimestampSource: TimestampSource = {
  nowSeconds: () => Date.now() / 1000,
};

/**
 * Returns a timestamp in seconds since the UNIX epoch using the Date API.
 */
export const dateTimestampInSeconds = dateTimestampSource.nowSeconds.bind(
  dateTimestampSource,
);
