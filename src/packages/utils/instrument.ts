import { logger } from './logger';
import { dropUndefinedKeys, fill } from './object';
import { getFunctionName } from './stacktrace';

/** Object describing handler that will be triggered for a given `type` of instrumentation */
interface InstrumentHandler {
  type: InstrumentHandlerType;
  callback: InstrumentHandlerCallback;
}

type InstrumentHandlerType = 'console' | 'request' | 'error' | 'unhandledRejection';
type InstrumentHandlerCallback = (data: any) => void;

/**
 * Instrument native APIs to call handlers that can be used to create breadcrumbs, APM spans etc.
 *  - Console API
 *  - Request API
 *  - Error API
 *  - UnhandledRejection API
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
    case 'error':
      instrumentError();
      break;
    case 'unhandledRejection':
      instrumentUnhandledRejection();
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
  ['debug', 'info', 'warn', 'error', 'log'].forEach(function (
    level: string,
  ): void {
    if (!(level in console)) {
      return;
    }

    fill(console, level, function (
      originalConsoleLevel: (...args: any[]) => any,
    ): Function {
      return function (...args: any[]): void {
        triggerHandlers('console', { args, level });

        originalConsoleLevel.apply(console, args);
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
      const {
        success,
        fail,
        complete,
        method,
        url,
        data,
        ...restOptions
      } = options;
      const handlerData = {
        options: restOptions,
        fetchData: dropUndefinedKeys({
          method: (method || 'GET').toUpperCase(),
          url,
          data,
        }),
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

/** JSDoc */
function instrumentError(): void {
  wx.onError((stack) => {
    const error = new Error();
    const lines = stack.split(`\n`);
    error.name = lines[0];
    error.message = lines[1];
    error.stack = stack;
    triggerHandlers('error', { error });
  });
}

/** JSDoc */
function instrumentUnhandledRejection(): void {
  wx.onUnhandledRejection(({ reason, promise }) => {
    // @ts-ignore
    promise.reason = reason;
    triggerHandlers('unhandledRejection', promise);
  });
}
