import { BaseBackend } from './packages/core';
import {
  Event,
  EventHint,
  Options,
  Severity,
  Transport,
} from './packages/types';
import { supportsFetch } from './packages/utils';

import { eventFromException, eventFromMessage } from './eventbuilder';
import { FetchTransport } from './transports';

/**
 * Configuration options for the Sentry MiniApp SDK.
 * @see MiniAppClient for more information.
 */
export interface MiniAppOptions extends Options {
  /**
   * A pattern for error URLs which should exclusively be sent to Sentry.
   * This is the opposite of {@link Options.denyUrls}.
   * By default, all errors will be sent.
   */
  allowUrls?: Array<string | RegExp>;

  /**
   * A pattern for error URLs which should not be sent to Sentry.
   * To allow certain errors instead, use {@link Options.allowUrls}.
   * By default, all errors will be sent.
   */
  denyUrls?: Array<string | RegExp>;

  /** @deprecated use {@link Options.allowUrls} instead. */
  whitelistUrls?: Array<string | RegExp>;

  /** @deprecated use {@link Options.denyUrls} instead. */
  blacklistUrls?: Array<string | RegExp>;

  /**
   * A flag enabling Sessions Tracking feature.
   * By default Sessions Tracking is disabled.
   */
  autoSessionTracking?: boolean;
}

/**
 * The Sentry MiniApp SDK Backend.
 * @hidden
 */
export class MiniAppBackend extends BaseBackend<MiniAppOptions> {
  /**
   * @inheritDoc
   */
  public eventFromException(
    exception: unknown,
    hint?: EventHint,
  ): PromiseLike<Event> {
    return eventFromException(this._options, exception, hint);
  }
  /**
   * @inheritDoc
   */
  public eventFromMessage(
    message: string,
    level: Severity = Severity.Info,
    hint?: EventHint,
  ): PromiseLike<Event> {
    return eventFromMessage(this._options, message, level, hint);
  }

  /**
   * @inheritDoc
   */
  protected _setupTransport(): Transport {
    if (!this._options.dsn) {
      // We return the noop transport here in case there is no Dsn.
      return super._setupTransport();
    }

    const transportOptions = {
      ...this._options.transportOptions,
      dsn: this._options.dsn,
    };

    if (this._options.transport) {
      return new this._options.transport(transportOptions);
    }
    return new FetchTransport(transportOptions);
  }
}
