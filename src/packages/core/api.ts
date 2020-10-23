import { DsnLike } from '../types';
import { Dsn, urlEncode } from '../utils';

const SENTRY_API_VERSION = '7';

/** Helper class to provide urls to different Sentry endpoints. */
export class API {
  /** The internally used Dsn object. */
  private readonly _dsnObject: Dsn;
  /** Create a new instance of API */
  public constructor(public dsn: DsnLike) {
    this._dsnObject = new Dsn(dsn);
  }

  /** Returns the prefix to construct Sentry ingestion API endpoints. */
  public getBaseApiEndpoint(): string {
    const dsn = this._dsnObject;
    const protocol = dsn.protocol ? `${dsn.protocol}:` : '';
    const port = dsn.port ? `:${dsn.port}` : '';
    return `${protocol}//${dsn.host}${port}${
      dsn.path ? `/${dsn.path}` : ''
    }/api/`;
  }

  /** Returns the store endpoint URL. */
  public getStoreEndpoint(): string {
    return this._getIngestEndpoint('store');
  }

  /**
   * Returns the store endpoint URL with auth in the query string.
   *
   * Sending auth as part of the query string and not as custom HTTP headers avoids CORS preflight requests.
   */
  public getStoreEndpointWithUrlEncodedAuth(): string {
    return `${this.getStoreEndpoint()}?${this._encodedAuth()}`;
  }

  /**
   * Returns the envelope endpoint URL with auth in the query string.
   *
   * Sending auth as part of the query string and not as custom HTTP headers avoids CORS preflight requests.
   */
  public getEnvelopeEndpointWithUrlEncodedAuth(): string {
    return `${this._getEnvelopeEndpoint()}?${this._encodedAuth()}`;
  }

  /** Returns the envelope endpoint URL. */
  private _getEnvelopeEndpoint(): string {
    return this._getIngestEndpoint('envelope');
  }

  /** Returns the ingest API endpoint for target. */
  private _getIngestEndpoint(target: 'store' | 'envelope'): string {
    const base = this.getBaseApiEndpoint();
    const dsn = this._dsnObject;
    return `${base}${dsn.projectId}/${target}/`;
  }

  /** Returns a URL-encoded string with auth config suitable for a query string. */
  private _encodedAuth(): string {
    const dsn = this._dsnObject;
    const auth = {
      // We send only the minimum set of required information. See
      // https://github.com/getsentry/sentry-javascript/issues/2572.
      sentry_key: dsn.user,
      sentry_version: SENTRY_API_VERSION,
    };
    return urlEncode(auth);
  }
}
