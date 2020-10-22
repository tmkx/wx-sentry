import { getGlobalObject } from './misc';

/**
 * Tells whether current environment supports ReportingObserver API
 * {@link supportsReportingObserver}.
 *
 * @returns Answer to the given question.
 */
export function supportsReportingObserver(): boolean {
  return 'ReportingObserver' in getGlobalObject();
}
