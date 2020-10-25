import { getCurrentHub } from '../packages/hub';
import { Event, Integration, Severity } from '../packages/types';
import {
  addExceptionMechanism,
  addInstrumentationHandler,
  getCurrentPageRoute,
  isPrimitive,
  isString,
  logger,
} from '../packages/utils';

import { eventFromUnknownInput } from '../eventbuilder';
import { shouldIgnoreOnError } from '../helpers';

/** JSDoc */
interface GlobalHandlersIntegrations {
  onError: boolean;
  onUnhandledRejection: boolean;
}

/** Global handlers */
export class GlobalHandlers implements Integration {
  /**
   * @inheritDoc
   */
  public static id: string = 'GlobalHandlers';

  /**
   * @inheritDoc
   */
  public name: string = GlobalHandlers.id;

  /** JSDoc */
  private readonly _options: GlobalHandlersIntegrations;

  /** JSDoc */
  private _onErrorHandlerInstalled: boolean = false;

  /** JSDoc */
  private _onUnhandledRejectionHandlerInstalled: boolean = false;

  /** JSDoc */
  public constructor(options?: GlobalHandlersIntegrations) {
    this._options = {
      onError: true,
      onUnhandledRejection: true,
      ...options,
    };
  }
  /**
   * @inheritDoc
   */
  public setupOnce(): void {
    Error.stackTraceLimit = 50;

    if (this._options.onError) {
      logger.log('Global Handler attached: onError');
      this._installGlobalOnErrorHandler();
    }

    if (this._options.onUnhandledRejection) {
      logger.log('Global Handler attached: onUnhandledRejection');
      this._installGlobalOnUnhandledRejectionHandler();
    }
  }

  /** JSDoc */
  private _installGlobalOnErrorHandler(): void {
    if (this._onErrorHandlerInstalled) {
      return;
    }

    addInstrumentationHandler({
      callback: (data: {
        error: any;
        msg?: any;
        url?: any;
        line?: any;
        column?: any;
      }) => {
        const error = data.error;
        const currentHub = getCurrentHub();
        const hasIntegration = currentHub.getIntegration(GlobalHandlers);
        const isFailedOwnDelivery =
          error && error.__sentry_own_request__ === true;

        if (!hasIntegration || shouldIgnoreOnError() || isFailedOwnDelivery) {
          return;
        }

        const client = currentHub.getClient();
        const event = GlobalHandlers._enhanceEventWithInitialFrame(
          eventFromUnknownInput(error, undefined, {
            attachStacktrace: client && client.getOptions().attachStacktrace,
            rejection: false,
          }),
          data.url,
          data.line,
          data.column,
        );

        addExceptionMechanism(event, {
          handled: false,
          type: 'onError',
        });

        currentHub.captureEvent(event, {
          originalException: error,
        });
      },
      type: 'error',
    });

    this._onErrorHandlerInstalled = true;
  }

  /** JSDoc */
  private _installGlobalOnUnhandledRejectionHandler(): void {
    if (this._onUnhandledRejectionHandlerInstalled) {
      return;
    }

    addInstrumentationHandler({
      callback: (e: any) => {
        let error = e;

        // dig the object of the rejection out of known event types
        try {
          // PromiseRejectionEvents store the object of the rejection under 'reason'
          // see https://developer.mozilla.org/en-US/docs/Web/API/PromiseRejectionEvent
          if ('reason' in e) {
            error = e.reason;
          }
        } catch (_oO) {
          // no-empty
        }

        const currentHub = getCurrentHub();
        const hasIntegration = currentHub.getIntegration(GlobalHandlers);
        const isFailedOwnDelivery =
          error && error.__sentry_own_request__ === true;

        if (!hasIntegration || shouldIgnoreOnError() || isFailedOwnDelivery) {
          return true;
        }

        const client = currentHub.getClient();
        const event = isPrimitive(error)
          ? GlobalHandlers._eventFromIncompleteRejection(error)
          : eventFromUnknownInput(error, undefined, {
              attachStacktrace: client && client.getOptions().attachStacktrace,
              rejection: true,
            });

        event.level = Severity.Error;

        addExceptionMechanism(event, {
          handled: false,
          type: 'onUnhandledRejection',
        });

        currentHub.captureEvent(event, {
          originalException: error,
        });

        return;
      },
      type: 'unhandledRejection',
    });

    this._onUnhandledRejectionHandlerInstalled = true;
  }

  /**
   * This function creates an Event from an TraceKitStackTrace that has part of it missing.
   */
  private static _eventFromIncompleteRejection(error: any): Event {
    return {
      exception: {
        values: [
          {
            type: 'UnhandledRejection',
            value: `Non-Error promise rejection captured with value: ${error}`,
          },
        ],
      },
    };
  }

  /** JSDoc */
  private static _enhanceEventWithInitialFrame(
    event: Event,
    url: any,
    line: any,
    column: any,
  ): Event {
    event.exception ||= {};
    event.exception.values ||= [];
    event.exception.values[0] ||= {};
    event.exception.values[0].stacktrace ||= {};
    event.exception.values[0].stacktrace.frames ||= [];

    const colno = isNaN(parseInt(column, 10)) ? undefined : column;
    const lineno = isNaN(parseInt(line, 10)) ? undefined : line;
    const filename =
      isString(url) && url.length > 0 ? url : getCurrentPageRoute();
    if (event.exception.values[0].stacktrace.frames.length === 0) {
      event.exception.values[0].stacktrace.frames.push({
        colno,
        filename,
        function: '?',
        in_app: true,
        lineno,
      });
    }

    return event;
  }
}
