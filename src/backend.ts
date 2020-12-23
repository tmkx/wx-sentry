import { BaseBackend } from './packages/core';
import {
  Event,
  EventHint,
  Options,
  Severity,
  Transport,
} from './packages/types';

import { eventFromException, eventFromMessage } from './eventbuilder';
import { RequestTransport } from './transports';

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

  /**
   * A flag enabling Sessions Tracking feature.
   * By default Sessions Tracking is disabled.
   */
  autoSessionTracking?: boolean;

  /**
   * 默认上报的wx.getSystemInfo字段
   */
  defaultReportSystemInfos?: false | string[];
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
    return new RequestTransport({
      ...this._options.transportOptions,
      dsn: this._options.dsn!,
    });
  }
}
