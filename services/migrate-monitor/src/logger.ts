import { timeFormat } from 'd3-time-format';

// Format: [YYYY-MM-DD HH:MM:SS +ZZZZ]
// Mind the trailing space! We need it to output a
const format = timeFormat('[%Y-%m-%d %H:%M:%S %Z] ');

/**
 * Interface for a shared console logger. This is used in order to ensure all messages have
 * a timestamp parseable by CloudWatch's logs.
 */
export interface Logger {
  /**
   * Output a debug message to the JS console.
   *
   * cf. https://developer.mozilla.org/en-US/docs/Web/API/console#Outputting_text_to_the_console
   *
   * @param message The message to write, as a JS format string
   * @param args Objects/values to format
   */
  debug(message: string, ...args: readonly unknown[]): void;

  /**
   * Output a normal message to the JS console.
   *
   * @param message The message to write, as a JS format string
   * @param args Objects/values to format
   */
  log(message: string, ...args: readonly unknown[]): void;

  /**
   * Output an informational message to the JS console.
   *
   * @param message The message to write, as a JS format string
   * @param args Objects/values to format
   */
  info(message: string, ...args: readonly unknown[]): void;

  /**
   * Output a warning to the JS console.
   *
   * @param message The message to write, as a JS format string
   * @param args Objects/values to format
   */
  warn(message: string, ...args: readonly unknown[]): void;

  /**
   * Output an error to the JS console.
   *
   * @param message The message to write, as a JS format string
   * @param args Objects/values to format
   */
  error(message: string, ...args: readonly unknown[]): void;
}

const logger: Logger = {
  debug(message, ...args) {
    // Proxy message as <timestamp> <message> so that any %-formats in the user's log
    // string are output correctly.
    console.debug(format(new Date()) + message, ...args);
  },
  log(message, ...args) {
    console.log(format(new Date()) + message, ...args);
  },
  info(message, ...args) {
    console.log(format(new Date()) + message, ...args);
  },
  warn(message, ...args) {
    console.warn(format(new Date()) + message, ...args);
  },
  error(message, ...args) {
    console.error(format(new Date()) + message, ...args);
  },
};

export default logger;
