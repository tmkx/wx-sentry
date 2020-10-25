import { Event, WrappedFunction } from '../types';
import IAnyObject = WechatMiniprogram.IAnyObject;

/**
 * UUID4 generator
 *
 * @returns string Generated UUID4.
 */
export function uuid4(): string {
  // http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/2117523#2117523
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Extracts either message or type+value from an event that can be used for user-facing logs
 * @returns event's description
 */
export function getEventDescription(event: Event): string {
  if (event.message) {
    return event.message;
  }
  if (event.exception && event.exception.values && event.exception.values[0]) {
    const exception = event.exception.values[0];

    if (exception.type && exception.value) {
      return `${exception.type}: ${exception.value}`;
    }
    return exception.type || exception.value || event.event_id || '<unknown>';
  }
  return event.event_id || '<unknown>';
}

/** JSDoc */
interface ExtensibleConsole extends Console {
  [key: string]: any;
}

/** JSDoc */
export function consoleSandbox(callback: () => any): any {
  const levels = ['debug', 'info', 'warn', 'error', 'log'];

  const originalConsole = console as ExtensibleConsole;
  const wrappedLevels: { [key: string]: any } = {};

  // Restore all wrapped console methods
  levels.forEach((level) => {
    if (
      level in console &&
      (originalConsole[level] as WrappedFunction).__sentry_original__
    ) {
      wrappedLevels[level] = originalConsole[level] as WrappedFunction;
      originalConsole[level] = (originalConsole[
        level
      ] as WrappedFunction).__sentry_original__;
    }
  });

  // Perform callback manipulations
  const result = callback();

  // Revert restoration to wrapped state
  Object.keys(wrappedLevels).forEach((level) => {
    originalConsole[level] = wrappedLevels[level];
  });

  return result;
}

/**
 * Adds exception values, type and value to an synthetic Exception.
 * @param event The event to modify.
 * @param value Value of the exception.
 * @param type Type of the exception.
 * @hidden
 */
export function addExceptionTypeValue(
  event: Event,
  value?: string,
  type?: string,
): void {
  event.exception ||= {};
  event.exception.values ||= [];
  event.exception.values[0] ||= {};
  event.exception.values[0].value ||= value || '';
  event.exception.values[0].type ||= type || 'Error';
}

/**
 * Adds exception mechanism to a given event.
 * @param event The event to modify.
 * @param mechanism Mechanism of the mechanism.
 * @hidden
 */
export function addExceptionMechanism(
  event: Event,
  mechanism: {
    [key: string]: any;
  } = {},
): void {
  // TODO: Use real type with `keyof Mechanism` thingy and maybe make it better?
  try {
    // @ts-ignore Type 'Mechanism | {}' is not assignable to type 'Mechanism | undefined'
    event.exception!.values![0].mechanism ||= {};
    Object.keys(mechanism).forEach((key) => {
      // @ts-ignore Mechanism has no index signature
      event.exception!.values![0].mechanism[key] = mechanism[key];
    });
  } catch (_oO) {
    // no-empty
  }
}

export function getCurrentPage(): WechatMiniprogram.Page.Instance<
  IAnyObject,
  IAnyObject
> {
  const pages = getCurrentPages();
  return pages[pages.length - 1];
}

/**
 * A safe form of location.href
 */
export function getCurrentPageRoute(): string {
  try {
    return getCurrentPage().route;
  } catch (oO) {
    return '';
  }
}

const defaultRetryAfter = 60 * 1000; // 60 seconds

/**
 * Extracts Retry-After value from the request header or returns default value
 * @param now current unix timestamp
 * @param header string representation of 'Retry-After' header
 */
export function parseRetryAfterHeader(
  now: number,
  header?: string | number | null,
): number {
  if (!header) {
    return defaultRetryAfter;
  }

  const headerDelay = parseInt(`${header}`, 10);
  if (!isNaN(headerDelay)) {
    return headerDelay * 1000;
  }

  const headerDate = Date.parse(`${header}`);
  if (!isNaN(headerDate)) {
    return headerDate - now;
  }

  return defaultRetryAfter;
}
