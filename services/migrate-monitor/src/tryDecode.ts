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
 * Validates an object property.
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
 * Attempts to deserialize a UDP message into a Message object.
 *
 * @param rawMessage The raw UDP socket message
 */
function tryDecode(rawMessage: Buffer): Message {
  const decoded = rawMessage.toString('utf-8');
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

  const messageType: unknown = maybeMessage.type;
  if (messageType === undefined) {
    throw new Error("Property 'type' missing from incoming message");
  }

  if (typeof messageType !== 'string') {
    throw new Error(`Message type is not string (got ${typeof maybeMessage})`);
  }

  if (messageType === 'migration') {
    checkProperty(messageType, maybeMessage, 'name', 'string');

    return maybeMessage as SetMigrationMessage;
  }

  if (messageType === 'import') {
    checkProperty(messageType, maybeMessage, 'time', 'number');
    checkProperty(messageType, maybeMessage, 'success', 'boolean');

    return maybeMessage as EntityImportMessage;
  }

  throw new Error(`Unexpected message type '${messageType}`);
}

export default tryDecode;
