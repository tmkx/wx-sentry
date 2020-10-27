import { isRegExp, isString } from './is';

/**
 * Truncates given string to the maximum characters count
 *
 * @param str An object that contains serializable values
 * @param max Maximum number of characters in truncated string
 * @returns string Encoded
 */
export function truncate(str: string, max: number = 0): string {
  return str.length <= max || max === 0 ? str : `${str.substr(0, max)}...`;
}

/**
 * Join values in array
 * @param input array of values to be joined together
 * @param delimiter string to be placed in-between values
 * @returns Joined values
 */
export function safeJoin(input: any[], delimiter?: string): string {
  if (!Array.isArray(input)) {
    return '';
  }

  const output = [];
  for (let i = 0; i < input.length; i++) {
    const value = input[i];
    try {
      output.push(JSON.stringify(value));
    } catch (e) {
      output.push('[value cannot be serialized]');
    }
  }

  return output.join(delimiter);
}

/**
 * Checks if the value matches a regex or includes the string
 * @param value The string value to be checked against
 * @param pattern Either a regex or a string that must be contained in value
 */
export function isMatchingPattern(
  value: string,
  pattern: RegExp | string,
): boolean {
  if (!isString(value)) {
    return false;
  }

  if (isRegExp(pattern)) {
    return (pattern as RegExp).test(value);
  }
  if (typeof pattern === 'string') {
    return value.indexOf(pattern) !== -1;
  }
  return false;
}
