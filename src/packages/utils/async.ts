/**
 * Consumes the promise and logs the error when it rejects.
 * @param promise A promise to forget.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function forget(promise: PromiseLike<any>): void {
  promise.then(null, (e) => {
    // TODO: Use a better logging mechanism
    // eslint-disable-next-line no-console
    console.error(e);
  });
}
