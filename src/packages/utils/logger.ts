import { consoleSandbox } from './misc';

/** Prefix for logging strings */
const PREFIX = 'Sentry Logger ';

/** JSDoc */
class Logger {
  /** JSDoc */
  private _enabled: boolean;

  /** JSDoc */
  public constructor() {
    this._enabled = false;
  }

  /** JSDoc */
  public disable(): void {
    this._enabled = false;
  }

  /** JSDoc */
  public enable(): void {
    this._enabled = true;
  }

  /** JSDoc */
  public log(...args: any[]): void {
    if (!this._enabled) {
      return;
    }
    consoleSandbox(() => {
      console.log(`${PREFIX}[Log]: ${args.join(' ')}`);
    });
  }

  /** JSDoc */
  public warn(...args: any[]): void {
    if (!this._enabled) {
      return;
    }
    consoleSandbox(() => {
      console.warn(`${PREFIX}[Warn]: ${args.join(' ')}`);
    });
  }

  /** JSDoc */
  public error(...args: any[]): void {
    if (!this._enabled) {
      return;
    }
    consoleSandbox(() => {
      console.error(`${PREFIX}[Error]: ${args.join(' ')}`);
    });
  }
}

const logger = new Logger();

export { logger };
