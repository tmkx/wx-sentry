<p align="center">
  <a href="https://sentry.io" target="_blank" align="center">
    <img src="https://sentry-brand.storage.googleapis.com/sentry-logo-black.png" width="280">
  </a>
  <br />
</p>

# Sentry SDK for WeChat MiniApp

Sentry SDK 微信小程序版，基于官方 SDK 5.27.0 版修改

## 链接

- [官方 SDK 文档](https://docs.sentry.io/platforms/javascript/)

## 使用方式 Usage

请在小程序初始化后尽早调用`Sentry.init(options)`。这将初始化 SDK 并注入到小程序环境中。你可以使用相应的选项关闭几乎所有的副作用。

```javascript
import Sentry from '@4in/wx-sentry';

Sentry.init({
  dsn: '__DSN__',
  // ...
});
```

要设置上下文信息或发送手动事件，请使用`@4in/wx-sentry`导出的函数。注意，这些在调用`Sentry.init()`之前，函数不会执行任何操作:

```javascript
import * as Sentry from '@4in/wx-sentry';

// Set user information, as well as tags and further extras
Sentry.configureScope((scope) => {
  scope.setExtra('battery', 0.7);
  scope.setTag('user_mode', 'admin');
  scope.setUser({ id: '4711' });
  // scope.clear();
});

// Add a breadcrumb for future events
Sentry.addBreadcrumb({
  message: 'My Breadcrumb',
  // ...
});

// Capture exceptions, messages or manual events
Sentry.captureMessage('Hello, world!');
Sentry.captureException(new Error('Good bye'));
Sentry.captureEvent({
  message: 'Manual',
  stacktrace: [
    // ...
  ],
});
```
