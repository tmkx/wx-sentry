import { API } from '../packages/core';
import {
  Event,
  Response,
  SentryRequestType,
  Status,
  Transport,
  TransportOptions,
} from '../packages/types';
import {
  logger,
  parseRetryAfterHeader,
  PromiseBuffer,
  SentryError,
} from '../packages/utils';

/** Base Transport class implementation */
export abstract class BaseTransport implements Transport {
  /** Helper to get Sentry API endpoints. */
  protected readonly _api: API;

  /** A simple buffer holding all requests. */
  protected readonly _buffer: PromiseBuffer<Response> = new PromiseBuffer(30);

  /** Locks transport after receiving rate limits in a response */
  protected readonly _rateLimits: Record<string, Date> = {};

  public constructor(public options: TransportOptions) {
    this._api = new API(this.options.dsn);
  }

  /**
   * @inheritDoc
   */
  public sendEvent(_: Event): PromiseLike<Response> {
    throw new SentryError(
      'Transport Class has to implement `sendEvent` method',
    );
  }

  /**
   * @inheritDoc
   */
  public close(timeout?: number): PromiseLike<boolean> {
    return this._buffer.drain(timeout);
  }

  /**
   * Handle Sentry response for promise-based transports.
   */
  protected _handleResponse({
    requestType,
    result,
    headers,
    resolve,
    reject,
  }: {
    requestType: SentryRequestType;
    result: WechatMiniprogram.RequestSuccessCallbackResult;
    headers: Record<string, string | null>;
    resolve: (value: Response | PromiseLike<Response>) => void;
    reject: (reason?: unknown) => void;
  }): void {
    const status = Status.fromHttpCode(result.statusCode);
    /**
     * "The name is case-insensitive."
     * https://developer.mozilla.org/en-US/docs/Web/API/Headers/get
     */
    const limited = this._handleRateLimit(headers);
    if (limited)
      logger.warn(
        `Too many requests, backing off till: ${this._disabledUntil(
          requestType,
        )}`,
      );

    if (status === Status.Success) {
      resolve({ status });
      return;
    }

    reject(result.errMsg);
  }

  /**
   * Gets the time that given category is disabled until for rate limiting
   */
  protected _disabledUntil(category: string): Date {
    return this._rateLimits[category] || this._rateLimits.all;
  }

  /**
   * Checks if a category is rate limited
   */
  protected _isRateLimited(category: string): boolean {
    return this._disabledUntil(category) > new Date(Date.now());
  }

  /**
   * Sets internal _rateLimits from incoming headers. Returns true if headers contains a non-empty rate limiting header.
   */
  protected _handleRateLimit(headers: Record<string, string | null>): boolean {
    const now = Date.now();
    const rlHeader = headers['x-sentry-rate-limits'];
    const raHeader = headers['retry-after'];

    if (rlHeader) {
      for (const limit of rlHeader.trim().split(',')) {
        const parameters = limit.split(':', 2);
        const headerDelay = parseInt(parameters[0], 10);
        const delay = (!isNaN(headerDelay) ? headerDelay : 60) * 1000; // 60sec default
        for (const category of parameters[1].split(';')) {
          this._rateLimits[category || 'all'] = new Date(now + delay);
        }
      }
      return true;
    } else if (raHeader) {
      this._rateLimits.all = new Date(
        now + parseRetryAfterHeader(now, raHeader),
      );
      return true;
    }
    return false;
  }
}
