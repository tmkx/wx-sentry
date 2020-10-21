import { Integration } from '@sentry/types';
import { fill, getFunctionName, getGlobalObject } from '@sentry/utils';

import { wrap } from '../helpers';

/** JSDoc */
interface TryCatchOptions {
  setTimeout: boolean;
  setInterval: boolean;
}

/** Wrap timer functions and event targets to catch errors and provide better meta data */
export class TryCatch implements Integration {
  /**
   * @inheritDoc
   */
  public static id: string = 'TryCatch';

  /**
   * @inheritDoc
   */
  public name: string = TryCatch.id;

  /** JSDoc */
  private readonly _options: TryCatchOptions;

  /**
   * @inheritDoc
   */
  public constructor(options?: Partial<TryCatchOptions>) {
    this._options = {
      setInterval: true,
      setTimeout: true,
      ...options,
    };
  }

  /**
   * Wrap timer functions and event targets to catch errors
   * and provide better metadata.
   */
  public setupOnce(): void {
    const global = getGlobalObject();

    if (this._options.setTimeout) {
      fill(global, 'setTimeout', this._wrapTimeFunction.bind(this));
    }

    if (this._options.setInterval) {
      fill(global, 'setInterval', this._wrapTimeFunction.bind(this));
    }
  }

  /** JSDoc */
  private _wrapTimeFunction(
    original: (...args: any[]) => number,
  ): () => number {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return function (this: any, ...args: any[]): number {
      const originalCallback = args[0];
      args[0] = wrap(originalCallback, {
        mechanism: {
          data: { function: getFunctionName(original) },
          handled: true,
          type: 'instrument',
        },
      });
      return original.apply(this, args);
    };
  }
}
