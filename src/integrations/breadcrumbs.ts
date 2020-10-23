import { getCurrentHub } from '../packages/hub';
import { Event, Integration, Severity } from '../packages/types';
import {
  addInstrumentationHandler,
  getEventDescription,
  safeJoin,
} from '../packages/utils';

/** JSDoc */
interface BreadcrumbsOptions {
  console: boolean;
  request: boolean;
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
      request: true,
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
   * Instrument MiniApp built-ins breadcrumb capturing
   *  - Console API
   *  - wx.request API
   */
  public setupOnce(): void {
    if (this._options.console) {
      addInstrumentationHandler({
        callback: (...args) => {
          Breadcrumbs._consoleBreadcrumb(...args);
        },
        type: 'console',
      });
    }
    if (this._options.request) {
      addInstrumentationHandler({
        callback: (...args) => {
          Breadcrumbs._requestBreadcrumb(...args);
        },
        type: 'request',
      });
    }
  }

  /**
   * Creates breadcrumbs from console API calls
   */
  private static _consoleBreadcrumb(handlerData: { [key: string]: any }): void {
    const breadcrumb = {
      category: 'console',
      data: {
        arguments: handlerData.args,
        logger: 'console',
      },
      level: Severity.fromString(handlerData.level),
      message: safeJoin(handlerData.args, ' '),
    };

    getCurrentHub().addBreadcrumb(breadcrumb, {
      input: handlerData.args,
      level: handlerData.level,
    });
  }

  /**
   * Creates breadcrumbs from wx.request API calls
   */
  private static _requestBreadcrumb(handlerData: { [key: string]: any }): void {
    // We only capture complete requests
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
          category: 'request',
          data: handlerData.fetchData,
          level: Severity.Error,
          type: 'http',
        },
        {
          input: handlerData.options,
          data: handlerData.error,
        },
      );
    } else {
      getCurrentHub().addBreadcrumb(
        {
          category: 'request',
          data: {
            ...handlerData.fetchData,
            status_code: handlerData.response.statusCode,
          },
          type: 'http',
        },
        {
          input: handlerData.options,
          response: handlerData.response,
        },
      );
    }
  }
}
