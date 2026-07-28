import { Transform, TransformFnParams } from 'class-transformer';

const parseBoolean = ({ obj, key, value }: TransformFnParams): unknown => {
  const rawValue =
    obj && Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : value;

  if (rawValue === true || rawValue === 'true') return true;
  if (rawValue === false || rawValue === 'false') return false;

  return rawValue;
};

/**
 * Strictly transforms HTTP query booleans without relying on JavaScript
 * truthiness. Unsupported values remain unchanged so @IsBoolean can reject
 * them instead of silently converting them to true or false.
 */
export const ToBoolean = (): PropertyDecorator => Transform(parseBoolean);
