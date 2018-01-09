// @flow

export const wrap = fn => (...args: any) => fn(...args).catch(args[2]);
