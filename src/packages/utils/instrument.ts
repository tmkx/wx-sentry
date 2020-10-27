import { logger } from './logger';
import { dropUndefinedKeys, fill } from './object';
import { getFunctionName } from './stacktrace';
import { getCurrentPageRoute } from './misc';

/** Object describing handler that will be triggered for a given `type` of instrumentation */
interface InstrumentHandler {
  type: InstrumentHandlerType;
  callback: InstrumentHandlerCallback;
}

type InstrumentHandlerType =
  | 'console'
  | 'request'
  | 'navigation'
  | 'error'
  | 'unhandledRejection';
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
    case 'navigation':
      instrumentNavigation();
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
  handlers[handler.type] ||= [];
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

function instrumentNavigation(): void {
  fill(wx, 'navigateTo', function (
    originalFunc: (options: WechatMiniprogram.NavigateToOption) => any,
  ): Function {
    return function (options: WechatMiniprogram.NavigateToOption): void {
      triggerHandlers('navigation', {
        type: 'navigateTo',
        from: getCurrentPageRoute(),
        to: options.url,
      });

      originalFunc.call(wx, options);
    };
  });

  fill(wx, 'redirectTo', function (
    originalFunc: (options: WechatMiniprogram.RedirectToOption) => any,
  ): Function {
    return function (options: WechatMiniprogram.RedirectToOption): void {
      triggerHandlers('navigation', {
        type: 'redirectTo',
        from: getCurrentPageRoute(),
        to: options.url,
      });

      originalFunc.call(wx, options);
    };
  });

  fill(wx, 'navigateBack', function (
    originalFunc: (options?: WechatMiniprogram.NavigateBackOption) => any,
  ): Function {
    return function (options?: WechatMiniprogram.NavigateBackOption): void {
      const pages = getCurrentPages();
      const delta = Math.min(options?.delta || 1, pages.length - 1);
      const targetPage = pages[pages.length - delta - 1];

      triggerHandlers('navigation', {
        type: 'navigateBack',
        from: getCurrentPageRoute(),
        to: targetPage.route,
      });

      originalFunc.call(wx, options);
    };
  });
}

function instrumentError(): void {
  wx.onError((stack) => {
    const [name, message] = stack.split(`\n`);
    const error = new Error(message);
    error.name = name;
    error.stack = stack;
    triggerHandlers('error', { error });
  });
}

function instrumentUnhandledRejection(): void {
  wx.onUnhandledRejection(({ reason, promise }) => {
    // @ts-ignore
    promise.reason = reason;
    triggerHandlers('unhandledRejection', promise);
  });
}
