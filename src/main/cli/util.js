// @flow

export const wrap = (fn: (express$Request, express$Response) => any) => (
  req: express$Request,
  res: express$Response,
  next: express$NextFunction
) => fn(req, res).catch(next);
