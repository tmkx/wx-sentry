export * from './exports';

import { Integrations as CoreIntegrations } from '@sentry/core';

import * as MiniAppIntegrations from './integrations';
import * as Transports from './transports';

const INTEGRATIONS = {
  ...CoreIntegrations,
  ...MiniAppIntegrations,
};

export { INTEGRATIONS as Integrations, Transports };
