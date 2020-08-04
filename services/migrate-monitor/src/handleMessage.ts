import { TextDecoder } from 'util';

import Aggregator from './Aggregator';
import logger from './logger';

/**
 * Shared ICU decoder instance. This decoder is configured to throw errors on invalid
 * UTF-8.
 */
const decoder = new TextDecoder('utf-8', { fatal: true });

/**
 * JSON message setting the migration name for CloudWatch dimensions.
 */
export interface SetMigrationMessage {
  readonly type: 'migration';
  readonly name: string;
}

/**
 * JSON message recording an entity import and the time it took to process.
 */
export interface EntityImportMessage {
  readonly type: 'import';
  readonly time: number;
  readonly success: boolean;
}

/**
 * Type of JSON messages this daemon expects.
 *
 * Messages can be distinguished by the `type` field. TypeScript will handle the rest.
 */
export type Message = SetMigrationMessage | EntityImportMessage;

/**
 * Error indicating a required property is missing.
 */
class RequiredPropertyError extends Error {
  constructor(messageType: string, propertyName: string) {
    super(
      `Message of type '${messageType} is mising required property ${propertyName}`,
    );
  }
}

/**
 * Error indicating a required property has the wrong type.
 */
class PropertyTypeMismatchError extends Error {
  constructor(propertyName: string, expected: string, actual: string) {
    super(
      `Property '${propertyName}' should be of type ${expected} but got ${actual}`,
    );
  }
}

/**
 * Validates an object property, as determined by the following criteria:
 *
 * 1. The named property exists (i.e., is not `undefined`).
 * 2. `typeof value` is the same as `expected`.
 *
 * If either of these fails, a validation exception is thrown.
 *
 * @param messageType What type of message we're inspecting
 * @param object The message object
 * @param property The property to check
 * @param expected The expected type of the object's property
 */
function checkProperty<K extends string>(
  messageType: string,
  object: { [Key in K]: unknown },
  property: K,
  expected: string,
) {
  const value = object[property];
  const valueType = typeof value;

  // Is the property even available in the object?
  if (value === undefined) {
    throw new RequiredPropertyError(messageType, property);
  }

  // Is the property of the right type?
  if (valueType !== expected) {
    throw new PropertyTypeMismatchError(
      property,
      expected,
      // NB. typeof null === 'object', but we call it out to be more specific in errors
      value === null ? 'null' : valueType,
    );
  }
}

/**
 * Attempts to decode a UDP package into a Message object.
 *
 * Messages are handled in a few steps:
 *
 * 1. The `Buffer` is decoded as UTF-8.
 * 2. The string is parsed into a JSON object.
 * 3. The JSON object is validated as one of two message types: a `SetMigrationMessage` or
 *    a `EntityImportMessage`.
 *
 * If any of these steps fails, an exception is thrown.
 *
 * @param udpPacket The UDP message as a Node.js buffer
 *
 * @return A decoded `Message` object.
 */
function decodeMessage(udpPacket: Buffer): Message {
  const decoded = decoder.decode(udpPacket);
  const maybeMessage = JSON.parse(decoded);

  if (typeof maybeMessage !== 'object') {
    throw new Error(
      `Expected message to be object; got ${typeof maybeMessage}`,
    );
  }

  // typeof [] === 'object', so we have to do this check for arrays
  if (Array.isArray(maybeMessage)) {
    throw new Error('Expected message to be plain object, not an array');
  }

  // Is the message type present?
  const messageType: unknown = maybeMessage.type;
  if (messageType === undefined) {
    throw new Error("Property 'type' missing from incoming message");
  }

  // Is the message type correct?
  if (typeof messageType !== 'string') {
    throw new Error(`Message type is not string (got ${typeof maybeMessage})`);
  }

  switch (messageType) {
    // Validate migration messages
    case 'migration':
      checkProperty(messageType, maybeMessage, 'name', 'string');
      return maybeMessage as SetMigrationMessage;

    // Validate import timing messages
    case 'import':
      checkProperty(messageType, maybeMessage, 'time', 'number');
      checkProperty(messageType, maybeMessage, 'success', 'boolean');
      return maybeMessage as EntityImportMessage;

    // In all other cases, fail
    default:
      throw new Error(`Unexpected message type '${messageType}`);
  }
}

/**
 * Logs messaging-related errors. If the message can be parsed as a UTF-8 string, it is
 * logged in decoded form. Otherwise, the Buffer's bytes are logged instead.
 *
 * @param error The error thrown during message handling
 * @param udpMessage The raw UDP message
 */
function logMessageError(error: unknown, udpMessage: Buffer) {
  try {
    const decoded = decoder.decode(udpMessage);
    logger.error(`Failed to handle message %s due to ${error}`, decoded);
  } catch {
    logger.error(`Failed to handle message %o due to ${error}`, udpMessage);
  }
}

/**
 * Handles an incoming UDP packet. This function takes the transformed message and
 * logs the appropriate metrics.
 *
 * @param udpPacket The raw UDP buffer.
 * @param aggregator The shared metrics aggregator.
 */
function handleMessage(udpPacket: Buffer, aggregator: Aggregator): void {
  try {
    const message = decodeMessage(udpPacket);
    switch (message.type) {
      case 'migration':
        aggregator.setMigrationName(message.name);
        break;

      case 'import':
        aggregator.countMigration(message.time, message.success);
        break;
    }

    aggregator.countMessageSuccess();
  } catch (error) {
    logMessageError(error, udpPacket);
    aggregator.countMessageFailure();
  }
}

export default handleMessage;
