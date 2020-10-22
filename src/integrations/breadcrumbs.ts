/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable max-lines */
import { getCurrentHub } from '../packages/core';
import { Event, Integration, Severity } from '../packages/types';
import {
  addInstrumentationHandler,
  getEventDescription,
  getGlobalObject,
  parseUrl,
  safeJoin,
} from '../packages/utils';

/** JSDoc */
interface BreadcrumbsOptions {
  console: boolean;
  fetch: boolean;
  sentry: boolean;
}

/**
 * Default Breadcrumbs instrumentations
 * TODO: Deprecated - with v6, this will be renamed to `Instrument`
 */
export class Breadcrumbs implements Integration {
  /**
   * @inheritDoc
   */
  public static id: string = 'Breadcrumbs';

  /**
   * @inheritDoc
   */
  public name: string = Breadcrumbs.id;

  /** JSDoc */
  private readonly _options: BreadcrumbsOptions;

  /**
   * @inheritDoc
   */
  public constructor(options?: Partial<BreadcrumbsOptions>) {
    this._options = {
      console: true,
      fetch: true,
      sentry: true,
      ...options,
    };
  }

  /**
   * Create a breadcrumb of `sentry` from the events themselves
   */
  public addSentryBreadcrumb(event: Event): void {
    if (!this._options.sentry) {
      return;
    }
    getCurrentHub().addBreadcrumb(
      {
        category: `sentry.${
          event.type === 'transaction' ? 'transaction' : 'event'
        }`,
        event_id: event.event_id,
        level: event.level,
        message: getEventDescription(event),
      },
      {
        event,
      },
    );
  }

  /**
   * Instrument browser built-ins w/ breadcrumb capturing
   *  - Console API
   *  - Fetch API
   *  - History API
   */
  public setupOnce(): void {
    if (this._options.console) {
      addInstrumentationHandler({
        callback: (...args) => {
          this._consoleBreadcrumb(...args);
        },
        type: 'console',
      });
    }
    if (this._options.fetch) {
      addInstrumentationHandler({
        callback: (...args) => {
          this._fetchBreadcrumb(...args);
        },
        type: 'fetch',
      });
    }
  }

  /**
   * Creates breadcrumbs from console API calls
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _consoleBreadcrumb(handlerData: { [key: string]: any }): void {
    const breadcrumb = {
      category: 'console',
      data: {
        arguments: handlerData.args,
        logger: 'console',
      },
      level: Severity.fromString(handlerData.level),
      message: safeJoin(handlerData.args, ' '),
    };

    if (handlerData.level === 'assert') {
      if (handlerData.args[0] === false) {
        breadcrumb.message = `Assertion failed: ${
          safeJoin(handlerData.args.slice(1), ' ') || 'console.assert'
        }`;
        breadcrumb.data.arguments = handlerData.args.slice(1);
      } else {
        // Don't capture a breadcrumb for passed assertions
        return;
      }
    }

    getCurrentHub().addBreadcrumb(breadcrumb, {
      input: handlerData.args,
      level: handlerData.level,
    });
  }

  /**
   * Creates breadcrumbs from fetch API calls
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _fetchBreadcrumb(handlerData: { [key: string]: any }): void {
    // We only capture complete fetch requests
    if (!handlerData.endTimestamp) {
      return;
    }

    if (
      handlerData.fetchData.url.match(/sentry_key/) &&
      handlerData.fetchData.method === 'POST'
    ) {
      // We will not create breadcrumbs for fetch requests that contain `sentry_key` (internal sentry requests)
      return;
    }

    if (handlerData.error) {
      getCurrentHub().addBreadcrumb(
        {
          category: 'fetch',
          data: handlerData.fetchData,
          level: Severity.Error,
          type: 'http',
        },
        {
          data: handlerData.error,
          input: handlerData.args,
        },
      );
    } else {
      getCurrentHub().addBreadcrumb(
        {
          category: 'fetch',
          data: {
            ...handlerData.fetchData,
            status_code: handlerData.response.status,
          },
          type: 'http',
        },
        {
          input: handlerData.args,
          response: handlerData.response,
        },
      );
    }
  }

  /**
   * Creates breadcrumbs from history API calls
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _historyBreadcrumb(handlerData: { [key: string]: any }): void {
    const global = getGlobalObject<Window>();
    let from = handlerData.from;
    let to = handlerData.to;
    const parsedLoc = parseUrl(global.location.href);
    let parsedFrom = parseUrl(from);
    const parsedTo = parseUrl(to);

    // Initial pushState doesn't provide `from` information
    if (!parsedFrom.path) {
      parsedFrom = parsedLoc;
    }

    // Use only the path component of the URL if the URL matches the current
    // document (almost all the time when using pushState)
    if (
      parsedLoc.protocol === parsedTo.protocol &&
      parsedLoc.host === parsedTo.host
    ) {
      to = parsedTo.relative;
    }
    if (
      parsedLoc.protocol === parsedFrom.protocol &&
      parsedLoc.host === parsedFrom.host
    ) {
      from = parsedFrom.relative;
    }

    getCurrentHub().addBreadcrumb({
      category: 'navigation',
      data: {
        from,
        to,
      },
    });
  }
}
