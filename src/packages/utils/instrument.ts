/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */
import { logger } from './logger';
import { getGlobalObject } from './misc';
import { fill } from './object';
import { getFunctionName } from './stacktrace';

const global = getGlobalObject<Window>();

/** Object describing handler that will be triggered for a given `type` of instrumentation */
interface InstrumentHandler {
  type: InstrumentHandlerType;
  callback: InstrumentHandlerCallback;
}

type InstrumentHandlerType = 'console' | 'request';
type InstrumentHandlerCallback = (data: any) => void;

/**
 * Instrument native APIs to call handlers that can be used to create breadcrumbs, APM spans etc.
 *  - Console API
 *  - Request API
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
    case 'request':
      instrumentRequest();
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
  if (!handler || typeof handler.callback !== 'function') {
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
  ['debug', 'info', 'warn', 'error', 'log', 'assert'].forEach(function (
    level: string,
  ): void {
    if (!(level in console)) {
      return;
    }

    fill(console, level, function (originalConsoleLevel: () => any): Function {
      return function (...args: any[]): void {
        triggerHandlers('console', { args, level });

        // this fails for some browsers. :(
        if (originalConsoleLevel) {
          Function.prototype.apply.call(originalConsoleLevel, console, args);
        }
      };
    });
  });
}

/** JSDoc */
function instrumentRequest(): void {
  fill(wx, 'request', function (
    originalRequest: (
      options: WechatMiniprogram.RequestOption,
    ) => PromiseLike<any>,
  ) {
    return function (
      options: WechatMiniprogram.RequestOption,
    ): PromiseLike<any> {
      const { method, url, success, fail } = options;
      const handlerData = {
        options,
        fetchData: {
          method: (method || 'unknown').toUpperCase(),
          url,
        },
        startTimestamp: Date.now(),
      };
      triggerHandlers('request', {
        ...handlerData,
      });
      return originalRequest.call(wx, {
        ...options,
        success(response: WechatMiniprogram.RequestSuccessCallbackResult) {
          triggerHandlers('request', {
            ...handlerData,
            endTimestamp: Date.now(),
            response,
          });
          success?.(response);
        },
        fail(error: WechatMiniprogram.GeneralCallbackResult) {
          triggerHandlers('request', {
            ...handlerData,
            endTimestamp: Date.now(),
            error,
          });
          fail?.(error);
        },
      });
    };
  });
}
