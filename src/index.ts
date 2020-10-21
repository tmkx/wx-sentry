export * from './exports';

import { Integrations as CoreIntegrations } from './packages/core';

import * as MiniAppIntegrations from './integrations';
import * as Transports from './transports';

const INTEGRATIONS = {
  ...CoreIntegrations,
  ...MiniAppIntegrations,
};

export { INTEGRATIONS as Integrations, Transports };
