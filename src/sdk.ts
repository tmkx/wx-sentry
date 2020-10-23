import {
  getCurrentHub,
  initAndBind,
  Integrations as CoreIntegrations,
} from './packages/core';
import { SyncPromise } from './packages/utils';

import { MiniAppOptions } from './backend';
import { MiniAppClient } from './client';
import { wrap as internalWrap } from './helpers';
import {
  Breadcrumbs,
  GlobalHandlers,
  LinkedErrors,
  TryCatch,
} from './integrations';

export const defaultIntegrations = [
  new CoreIntegrations.InboundFilters(),
  new CoreIntegrations.FunctionToString(),
  new TryCatch(),
  new Breadcrumbs(),
  new GlobalHandlers(),
  new LinkedErrors(),
];

/**
 * The Sentry MiniApp SDK Client.
 *
 * To use this SDK, call the {@link init} function as early as possible when
 * loading the mini app. To set context information or send manual events, use
 * the provided methods.
 *
 * @see {@link MiniAppOptions} for documentation on configuration options.
 */
export function init(options: MiniAppOptions = {}): void {
  if (options.defaultIntegrations === undefined) {
    options.defaultIntegrations = defaultIntegrations;
  }
  if (options.release === undefined) {
    /**
     * 线上小程序版本号仅支持在正式版小程序中获取，开发版和体验版中无法获取。
     * @see https://developers.weixin.qq.com/miniprogram/dev/api/open-api/account-info/wx.getAccountInfoSync.html
     */
    options.release = wx.getAccountInfoSync().miniProgram.version;
  }
  if (options.autoSessionTracking === undefined) {
    options.autoSessionTracking = false;
  }

  initAndBind(MiniAppClient, options);

  if (options.autoSessionTracking) {
    startSessionTracking();
  }
}

/**
 * This is the getter for lastEventId.
 *
 * @returns The last event id of a captured event.
 */
export function lastEventId(): string | undefined {
  return getCurrentHub().lastEventId();
}

/**
 * A promise that resolves when all current events have been sent.
 * If you provide a timeout and the queue takes longer to drain the promise returns false.
 *
 * @param timeout Maximum time in ms the client should wait.
 */
export function flush(timeout?: number): PromiseLike<boolean> {
  const client = getCurrentHub().getClient<MiniAppClient>();
  if (client) {
    return client.flush(timeout);
  }
  return SyncPromise.reject(false);
}

/**
 * A promise that resolves when all current events have been sent.
 * If you provide a timeout and the queue takes longer to drain the promise returns false.
 *
 * @param timeout Maximum time in ms the client should wait.
 */
export function close(timeout?: number): PromiseLike<boolean> {
  const client = getCurrentHub().getClient<MiniAppClient>();
  if (client) {
    return client.close(timeout);
  }
  return SyncPromise.reject(false);
}

/**
 * Wrap code within a try/catch block so the SDK is able to capture errors.
 *
 * @param fn A function to wrap.
 *
 * @returns The result of wrapped function call.
 */
export function wrap(fn: (...args: any) => any): any {
  return internalWrap(fn)();
}

/**
 * Enable automatic Session Tracking for the initial page load.
 */
function startSessionTracking(): void {
  const hub = getCurrentHub();

  let fcpResolved = false;
  const possiblyEndSession = (): void => {
    if (fcpResolved) {
      hub.endSession();
    }
  };

  hub.startSession();

  try {
    // TODO: Performance measurement
    fcpResolved = true;
    possiblyEndSession();
  } catch (e) {
    fcpResolved = true;
    possiblyEndSession();
  }
}
