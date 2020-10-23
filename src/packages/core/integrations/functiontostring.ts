import { Integration, WrappedFunction } from '../../types';

let originalFunctionToString: (...args: any[]) => string;

/** Patch toString calls to return proper name for wrapped functions */
export class FunctionToString implements Integration {
  /**
   * @inheritDoc
   */
  public static id: string = 'FunctionToString';

  /**
   * @inheritDoc
   */
  public name: string = FunctionToString.id;

  /**
   * @inheritDoc
   */
  public setupOnce(): void {
    originalFunctionToString = Function.prototype.toString;

    Function.prototype.toString = function (
      this: WrappedFunction,
      ...args: any[]
    ): string {
      const context = this.__sentry_original__ || this;
      return originalFunctionToString.apply(context, args);
    };
  }
}
