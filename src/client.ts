import { BaseClient, Scope } from './packages/core';
import { Event, EventHint } from './packages/types';

import { MiniAppBackend, MiniAppOptions } from './backend';
import { Breadcrumbs } from './integrations';
import { SDK_NAME, SDK_VERSION } from './version';

/**
 * The Sentry MiniApp SDK Client.
 *
 * @see MiniAppOptions for documentation on configuration options.
 * @see SentryClient for usage documentation.
 */
export class MiniAppClient extends BaseClient<MiniAppBackend, MiniAppOptions> {
  /**
   * Creates a new MiniApp SDK instance.
   *
   * @param options Configuration options for this SDK.
   */
  public constructor(options: MiniAppOptions) {
    super(MiniAppBackend, options);
  }

  /**
   * @inheritDoc
   */
  protected _prepareEvent(
    event: Event,
    scope?: Scope,
    hint?: EventHint,
  ): PromiseLike<Event | null> {
    event.platform = 'javascript';
    event.sdk = {
      ...event.sdk,
      name: SDK_NAME,
      packages: [
        ...((event.sdk && event.sdk.packages) || []),
        {
          name: 'npm:wx-sentry',
          version: SDK_VERSION,
        },
      ],
      version: SDK_VERSION,
    };

    return super._prepareEvent(event, scope, hint);
  }

  /**
   * @inheritDoc
   */
  protected _sendEvent(event: Event): void {
    const integration = this.getIntegration(Breadcrumbs);
    if (integration) {
      integration.addSentryBreadcrumb(event);
    }
    super._sendEvent(event);
  }
}
