/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */
import { WrappedFunction } from '../../packages/types';

import { isInstanceOf, isString } from './is';
import { logger } from './logger';
import { getGlobalObject } from './misc';
import { fill } from './object';
import { getFunctionName } from './stacktrace';
import { supportsNativeFetch } from './supports';

const global = getGlobalObject<Window>();

/** Object describing handler that will be triggered for a given `type` of instrumentation */
interface InstrumentHandler {
  type: InstrumentHandlerType;
  callback: InstrumentHandlerCallback;
}
type InstrumentHandlerType =
  | 'console'
  | 'fetch'
  | 'xhr';
type InstrumentHandlerCallback = (data: any) => void;

/**
 * Instrument native APIs to call handlers that can be used to create breadcrumbs, APM spans etc.
 *  - Console API
 *  - Fetch API
 *  - XHR API
 */

const handlers: {
  [key in InstrumentHandlerType]?: InstrumentHandlerCallback[];
} = {};
const instrumented: { [key in InstrumentHandlerType]?: boolean } = {};

/** Instruments given API */
function instrument(type: InstrumentHandlerType): void {
  if (instrumented[type]) {
    return;
  }

  instrumented[type] = true;

  switch (type) {
    case 'console':
      instrumentConsole();
      break;
    case 'xhr':
      instrumentXHR();
      break;
    case 'fetch':
      instrumentFetch();
      break;
    default:
      logger.warn('unknown instrumentation type:', type);
  }
}

/**
 * Add handler that will be called when given type of instrumentation triggers.
 * Use at your own risk, this might break without changelog notice, only used internally.
 * @hidden
 */
export function addInstrumentationHandler(handler: InstrumentHandler): void {
  if (
    !handler ||
    typeof handler.type !== 'string' ||
    typeof handler.callback !== 'function'
  ) {
    return;
  }
  handlers[handler.type] = handlers[handler.type] || [];
  (handlers[handler.type] as InstrumentHandlerCallback[]).push(
    handler.callback,
  );
  instrument(handler.type);
}

/** JSDoc */
function triggerHandlers(type: InstrumentHandlerType, data: any): void {
  if (!type || !handlers[type]) {
    return;
  }

  for (const handler of handlers[type] || []) {
    try {
      handler(data);
    } catch (e) {
      logger.error(
        `Error while triggering instrumentation handler.\nType: ${type}\nName: ${getFunctionName(
          handler,
        )}\nError: ${e}`,
      );
    }
  }
}

/** JSDoc */
function instrumentConsole(): void {
  if (!('console' in window)) {
    return;
  }

  ['debug', 'info', 'warn', 'error', 'log', 'assert'].forEach(function (
    level: string,
  ): void {
    if (!(level in console)) {
      return;
    }

    fill(console, level, function (
      originalConsoleLevel: () => any,
    ): Function {
      return function (...args: any[]): void {
        triggerHandlers('console', { args, level });

        // this fails for some browsers. :(
        if (originalConsoleLevel) {
          Function.prototype.apply.call(
            originalConsoleLevel,
            window.console,
            args,
          );
        }
      };
    });
  });
}

/** JSDoc */
function instrumentFetch(): void {
  if (!supportsNativeFetch()) {
    return;
  }

  fill(global, 'fetch', function (originalFetch: (...args: any[]) => PromiseLike<any>): () => void {
    return function (...args: any[]): PromiseLike<any> {
      const handlerData = {
        args,
        fetchData: {
          method: getFetchMethod(args),
          url: getFetchUrl(args),
        },
        startTimestamp: Date.now(),
      };

      triggerHandlers('fetch', {
        ...handlerData,
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      return originalFetch.apply(global, args).then(
        (response: Response) => {
          triggerHandlers('fetch', {
            ...handlerData,
            endTimestamp: Date.now(),
            response,
          });
          return response;
        },
        (error: Error) => {
          triggerHandlers('fetch', {
            ...handlerData,
            endTimestamp: Date.now(),
            error,
          });
          // NOTE: If you are a Sentry user, and you are seeing this stack frame,
          //       it means the sentry.javascript SDK caught an error invoking your application code.
          //       This is expected behavior and NOT indicative of a bug with sentry.javascript.
          throw error;
        },
      );
    };
  });
}

type XHRSendInput =
  | null
  | Blob
  | BufferSource
  | FormData
  | URLSearchParams
  | string;

/** JSDoc */
interface SentryWrappedXMLHttpRequest extends XMLHttpRequest {
  [key: string]: any;
  __sentry_xhr__?: {
    method?: string;
    url?: string;
    status_code?: number;
    body?: XHRSendInput;
  };
}

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/** Extract `method` from fetch call arguments */
function getFetchMethod(fetchArgs: any[] = []): string {
  if (
    'Request' in global &&
    isInstanceOf(fetchArgs[0], Request) &&
    fetchArgs[0].method
  ) {
    return String(fetchArgs[0].method).toUpperCase();
  }
  if (fetchArgs[1] && fetchArgs[1].method) {
    return String(fetchArgs[1].method).toUpperCase();
  }
  return 'GET';
}

/** Extract `url` from fetch call arguments */
function getFetchUrl(fetchArgs: any[] = []): string {
  if (typeof fetchArgs[0] === 'string') {
    return fetchArgs[0];
  }
  if ('Request' in global && isInstanceOf(fetchArgs[0], Request)) {
    return fetchArgs[0].url;
  }
  return String(fetchArgs[0]);
}
/* eslint-enable @typescript-eslint/no-unsafe-member-access */

/** JSDoc */
function instrumentXHR(): void {
  if (!('XMLHttpRequest' in global)) {
    return;
  }

  // Poor man's implementation of ES6 `Map`, tracking and keeping in sync key and value separately.
  const requestKeys: XMLHttpRequest[] = [];
  const requestValues: Array<any>[] = [];
  const xhrproto = XMLHttpRequest.prototype;

  fill(xhrproto, 'open', function (originalOpen: (...args: any[]) => void): () => void {
    return function (this: SentryWrappedXMLHttpRequest, ...args: any[]): void {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const xhr = this;
      const url = args[1];
      xhr.__sentry_xhr__ = {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        method: isString(args[0]) ? args[0].toUpperCase() : args[0],
        url: args[1],
      };

      // if Sentry key appears in URL, don't capture it as a request
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (
        isString(url) &&
        xhr.__sentry_xhr__.method === 'POST' &&
        url.match(/sentry_key/)
      ) {
        xhr.__sentry_own_request__ = true;
      }

      const onreadystatechangeHandler = function (): void {
        if (xhr.readyState === 4) {
          try {
            // touching statusCode in some platforms throws
            // an exception
            if (xhr.__sentry_xhr__) {
              xhr.__sentry_xhr__.status_code = xhr.status;
            }
          } catch (e) {
            /* do nothing */
          }

          try {
            const requestPos = requestKeys.indexOf(xhr);
            if (requestPos !== -1) {
              // Make sure to pop both key and value to keep it in sync.
              requestKeys.splice(requestPos);
              const args = requestValues.splice(requestPos)[0];
              if (xhr.__sentry_xhr__ && args[0] !== undefined) {
                xhr.__sentry_xhr__.body = args[0] as XHRSendInput;
              }
            }
          } catch (e) {
            /* do nothing */
          }

          triggerHandlers('xhr', {
            args,
            endTimestamp: Date.now(),
            startTimestamp: Date.now(),
            xhr,
          });
        }
      };

      if (
        'onreadystatechange' in xhr &&
        typeof xhr.onreadystatechange === 'function'
      ) {
        fill(xhr, 'onreadystatechange', function (
          original: WrappedFunction,
        ): Function {
          return function (...readyStateArgs: any[]): void {
            onreadystatechangeHandler();
            return original.apply(xhr, readyStateArgs);
          };
        });
      } else {
        xhr.addEventListener('readystatechange', onreadystatechangeHandler);
      }

      return originalOpen.apply(xhr, args);
    };
  });

  fill(xhrproto, 'send', function (originalSend: (...args: any[]) => void): () => void {
    return function (this: SentryWrappedXMLHttpRequest, ...args: any[]): void {
      requestKeys.push(this);
      requestValues.push(args);

      triggerHandlers('xhr', {
        args,
        startTimestamp: Date.now(),
        xhr: this,
      });

      return originalSend.apply(this, args);
    };
  });
}

const debounceDuration: number = 1000;
let debounceTimer: number = 0;
let keypressTimeout: number | undefined;
let lastCapturedEvent: Event | undefined;

/**
 * Wraps addEventListener to capture UI breadcrumbs
 * @param name the event name (e.g. "click")
 * @param handler function that will be triggered
 * @param debounce decides whether it should wait till another event loop
 * @returns wrapped breadcrumb events handler
 * @hidden
 */
function domEventHandler(
  name: string,
  handler: Function,
  debounce: boolean = false,
): (event: Event) => void {
  return (event: Event): void => {
    // reset keypress timeout; e.g. triggering a 'click' after
    // a 'keypress' will reset the keypress debounce so that a new
    // set of keypresses can be recorded
    keypressTimeout = undefined;
    // It's possible this handler might trigger multiple times for the same
    // event (e.g. event propagation through node ancestors). Ignore if we've
    // already captured the event.
    if (!event || lastCapturedEvent === event) {
      return;
    }

    lastCapturedEvent = event;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    if (debounce) {
      debounceTimer = setTimeout(() => {
        handler({ event, name });
      });
    } else {
      handler({ event, name });
    }
  };
}

/**
 * Wraps addEventListener to capture keypress UI events
 * @param handler function that will be triggered
 * @returns wrapped keypress events handler
 * @hidden
 */
function keypressEventHandler(handler: Function): (event: Event) => void {
  // TODO: if somehow user switches keypress target before
  //       debounce timeout is triggered, we will only capture
  //       a single breadcrumb from the FIRST target (acceptable?)
  return (event: Event): void => {
    let target;

    try {
      target = event.target;
    } catch (e) {
      // just accessing event properties can throw an exception in some rare circumstances
      // see: https://github.com/getsentry/raven-js/issues/838
      return;
    }

    const tagName = target && (target as HTMLElement).tagName;

    // only consider keypress events on actual input elements
    // this will disregard keypresses targeting body (e.g. tabbing
    // through elements, hotkeys, etc)
    if (
      !tagName ||
      (tagName !== 'INPUT' &&
        tagName !== 'TEXTAREA' &&
        !(target as HTMLElement).isContentEditable)
    ) {
      return;
    }

    // record first keypress in a series, but ignore subsequent
    // keypresses until debounce clears
    if (!keypressTimeout) {
      domEventHandler('input', handler)(event);
    }
    clearTimeout(keypressTimeout);

    keypressTimeout = (setTimeout(() => {
      keypressTimeout = undefined;
    }, debounceDuration) as any) as number;
  };
}
