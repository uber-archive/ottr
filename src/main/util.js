// @flow

export function nonnull<T: Object | string | number | Array<any>>(value?: ?T): T {
  if (value === null || value === undefined) {
    throw new Error('value cannot be null');
  }
  return value;
}
