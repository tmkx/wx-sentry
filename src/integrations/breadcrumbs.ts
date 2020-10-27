import { getCurrentHub } from '../packages/hub';
import { Event, Integration, Severity } from '../packages/types';
import {
  addInstrumentationHandler,
  getEventDescription,
  safeJoin,
} from '../packages/utils';

interface BreadcrumbsOptions {
  sentry: boolean;
  console: boolean;
  request: boolean;
  navigation: boolean;
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

  private readonly _options: BreadcrumbsOptions;

  /**
   * @inheritDoc
   */
  public constructor(options?: Partial<BreadcrumbsOptions>) {
    this._options = {
      sentry: true,
      console: true,
      request: true,
      navigation: true,
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
   *  - Request API
   *  - Navigation API
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
    if (this._options.navigation) {
      addInstrumentationHandler({
        callback: (arg: any) => {
          Breadcrumbs._navigationBreadcrumb(arg);
        },
        type: 'navigation',
      });
    }
  }

  /**
   * Creates breadcrumbs from console API calls
   */
  private static _consoleBreadcrumb(handlerData: { [key: string]: any }): void {
    const breadcrumb = {
      type: 'console',
      category: 'console',
      data: {
        // 有 message 字段了，这俩数据就显得有点多余...
        // arguments: handlerData.args,
        // logger: 'console',
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
   * Creates breadcrumbs from request API calls
   */
  private static _requestBreadcrumb(handlerData: { [key: string]: any }): void {
    const { endTimestamp, fetchData, error, options, response } = handlerData;
    // We only capture complete requests
    if (!endTimestamp) {
      return;
    }

    if (fetchData.url.match(/sentry_key/) && fetchData.method === 'POST') {
      // We will not create breadcrumbs for fetch requests that contain `sentry_key` (internal sentry requests)
      return;
    }

    if (error) {
      getCurrentHub().addBreadcrumb(
        {
          category: 'request',
          data: fetchData,
          level: Severity.Error,
          type: 'http',
        },
        {
          input: options,
          data: error,
        },
      );
    } else {
      getCurrentHub().addBreadcrumb(
        {
          category: 'request',
          data: {
            ...fetchData,
            status_code: response.statusCode,
          },
          type: 'http',
        },
        {
          input: options,
          response: response,
        },
      );
    }
  }

  /**
   * Creates breadcrumbs from navigation API calls
   */
  private static _navigationBreadcrumb(handlerData: {
    type: string;
    from: string;
    to: string;
  }): void {
    getCurrentHub().addBreadcrumb({
      type: 'navigation',
      category: handlerData.type,
      data: {
        from: handlerData.from,
        to: handlerData.to,
      },
    });
  }
}
