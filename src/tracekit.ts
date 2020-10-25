/**
 * This was originally forked from https://github.com/occ/TraceKit, but has since been
 * largely modified and is now maintained as part of Sentry JS SDK.
 */

/**
 * An object representing a single stack frame.
 * {Object} StackFrame
 * {string} url The JavaScript or HTML file URL.
 * {string} func The function name, or empty for anonymous functions (if guessing did not work).
 * {string[]?} args The arguments passed to the function, if known.
 * {number=} line The line number, if known.
 * {number=} column The column number, if known.
 * {string[]} context An array of source code lines; the middle element corresponds to the correct line#.
 */
export interface StackFrame {
  url: string;
  func: string;
  args: string[];
  line: number | null;
  column: number | null;
}

/**
 * An object representing a JavaScript stack trace.
 * {Object} StackTrace
 * {string} name The name of the thrown exception.
 * {string} message The exception error message.
 * {TraceKit.StackFrame[]} stack An array of stack frames.
 */
export interface StackTrace {
  name: string;
  message: string;
  mechanism?: string;
  stack: StackFrame[];
  failed?: boolean;
}

// global reference to slice
const UNKNOWN_FUNCTION = '?';

const chrome = /^\s*at (?:(.*?) ?\()?((?:file|https?|blob|address|native|eval|webpack|<anonymous>|[-a-z]+:|.*bundle|\/).*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
const chromeEval = /\((\S*)(?::(\d+))(?::(\d+))\)/;

/** JSDoc */
export function computeStackTrace(ex: any): StackTrace {
  let stack = null;
  let popSize = 0;

  if (ex && typeof ex.framesToPop === 'number') {
    popSize = ex.framesToPop;
  }

  try {
    stack = computeStackTraceFromStackProp(ex);
    if (stack) {
      return popFrames(stack, popSize);
    }
  } catch (e) {
    // no-empty
  }

  return {
    message: extractMessage(ex),
    name: ex && ex.name,
    stack: [],
    failed: true,
  };
}

/** JSDoc */
function computeStackTraceFromStackProp(ex: any): StackTrace | null {
  if (!ex || !ex.stack) {
    return null;
  }

  const stack = [];
  const lines = ex.stack.split('\n');
  let isEval;
  let submatch;
  let parts;
  let element;

  for (let i = 0; i < lines.length; ++i) {
    if ((parts = chrome.exec(lines[i]))) {
      const isNative = parts[2] && parts[2].indexOf('native') === 0; // start of line
      isEval = parts[2] && parts[2].indexOf('eval') === 0; // start of line
      if (isEval && (submatch = chromeEval.exec(parts[2]))) {
        // throw out eval line/column and use top-most line/column number
        parts[2] = submatch[1]; // url
        parts[3] = submatch[2]; // line
        parts[4] = submatch[3]; // column
      }
      element = {
        // working with the regexp above is super painful. it is quite a hack, but just stripping the `address at `
        // prefix here seems like the quickest solution for now.
        url:
          parts[2] && parts[2].indexOf('address at ') === 0
            ? parts[2].substr('address at '.length)
            : parts[2],
        func: parts[1] || UNKNOWN_FUNCTION,
        args: isNative ? [parts[2]] : [],
        line: parts[3] ? +parts[3] : null,
        column: parts[4] ? +parts[4] : null,
      };
    } else {
      continue;
    }

    if (!element.func && element.line) {
      element.func = UNKNOWN_FUNCTION;
    }

    stack.push(element);
  }

  if (!stack.length) {
    return null;
  }

  return {
    message: extractMessage(ex),
    name: ex.name,
    stack,
  };
}

/** Remove N number of frames from the stack */
function popFrames(stacktrace: StackTrace, popSize: number): StackTrace {
  try {
    return {
      ...stacktrace,
      stack: stacktrace.stack.slice(popSize),
    };
  } catch (e) {
    return stacktrace;
  }
}

/**
 * There are cases where stacktrace.message is an Event object
 * https://github.com/getsentry/sentry-javascript/issues/1949
 * In this specific case we try to extract stacktrace.message.error.message
 */
function extractMessage(ex: any): string {
  const message = ex && ex.message;
  if (!message) {
    return 'No error message';
  }
  if (message.error && typeof message.error.message === 'string') {
    return message.error.message;
  }
  return message;
}
