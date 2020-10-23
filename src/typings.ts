interface ErrorConstructor {
  /** Create .stack property on a target object */
  captureStackTrace(targetObject: Object, constructorOpt?: Function): void;

  /**
   * Optional override for formatting stack traces
   *
   * @see https://github.com/v8/v8/wiki/Stack%20Trace%20API#customizing-stack-traces
   */
  prepareStackTrace?: (err: Error, stackTraces: any[]) => any;

  stackTraceLimit: number;
}

declare namespace WechatMiniprogram {
  interface Wx {
    Sentry?: {
      Integrations?: any[];
    };
    SENTRY_ENVIRONMENT?: string;
    SENTRY_DSN?: string;
    SENTRY_RELEASE?: {
      id?: string;
    };
    __SENTRY__: {
      globalEventProcessors?: any;
      hub?: any;
      logger?: any;
      extensions?: {
        [key: string]: Function;
      };
    };
  }
}
