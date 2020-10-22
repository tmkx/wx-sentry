import { eventToSentryRequest, sessionToSentryRequest } from '../packages/core';
import { Event, Response, SentryRequest, Session } from '../packages/types';
import { SyncPromise } from '../packages/utils';

import { BaseTransport } from './base';

/** `wx.request` based transport */
export class RequestTransport extends BaseTransport {
  /**
   * @inheritDoc
   */
  public sendEvent(event: Event): PromiseLike<Response> {
    return this._sendRequest(eventToSentryRequest(event, this._api), event);
  }

  /**
   * @inheritDoc
   */
  public sendSession(session: Session): PromiseLike<Response> {
    return this._sendRequest(
      sessionToSentryRequest(session, this._api),
      session,
    );
  }

  /**
   * @param sentryRequest Prepared SentryRequest to be delivered
   * @param originalPayload Original payload used to create SentryRequest
   */
  private _sendRequest(
    sentryRequest: SentryRequest,
    originalPayload: Event | Session,
  ): PromiseLike<Response> {
    if (this._isRateLimited(sentryRequest.type)) {
      return Promise.reject({
        event: originalPayload,
        type: sentryRequest.type,
        reason: `Transport locked till ${this._disabledUntil(
          sentryRequest.type,
        )} due to too many requests.`,
        status: 429,
      });
    }

    return this._buffer.add(
      new SyncPromise<Response>((resolve, reject) => {
        wx.request({
          url: sentryRequest.url,
          method: 'POST',
          data: sentryRequest.body,
          success: (res) => {
            const headers = {
              'x-sentry-rate-limits': res.header['X-Sentry-Rate-Limits'],
              'retry-after': res.header['Retry-After'],
            };
            this._handleResponse({
              requestType: sentryRequest.type,
              response: res.data as any,
              headers,
              resolve,
              reject,
            });
          },
          fail: reject,
        });
      }),
    );
  }
}
