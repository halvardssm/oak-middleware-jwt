import {
  Context,
  ErrorStatus,
  Handlers,
  JwtObject,
  Middleware,
  Opts,
  RouterContext,
  RouterMiddleware,
  validateJwt,
  HTTPMethods,
} from "../deps.ts";
export type customMessagesT = {
  expired?: string; // Message for when the token is expired, uses iat to determine
  invalid?: string; // Message for when the token is invalid
};
export type patternT = { path: string | RegExp; methods?: HTTPMethods[] };
export type ignorePathT = string | RegExp | patternT;

export interface jwtMiddlewareOptions extends Partial<Opts> {
  /** Secret key */
  secret: string;

  /** Custom error messages */
  customMessages?: customMessagesT;

  /** Duration for expiration, uses iat to determine if the token is expired. E.g. (1000*60*60) = 1 hour expiration time */
  expiresAfter?: number;

  /** Pattern to ignore e.g. `/authenticate`, when passing a string, the string will be matched with the path `===` */
  ignorePatterns?: Array<ignorePathT>;

  /** Optional callback for successfull validation, passes the Context and the decrypted JWT as an object */
  onSuccess?: (
    ctx: Context | RouterContext,
    jwtObject: JwtObject,
  ) => void;

  /** Optional callback for unsuccessfull validation, passes the Context and isExpired.
	 * 
	 * When not used, will throw HTTPError using custom (or default) messages.
	 * If you want the failure to be ignored and to call the next middleware, return true.
	 */
  onFailure?: (
    ctx: Context | RouterContext,
    isExpired: boolean,
  ) => boolean; //
}

const ignorePath = <T extends Context | RouterContext>(
  ctx: T,
  patterns: Array<ignorePathT>,
): boolean => {
  const testString = (pattern: any) =>
    typeof pattern === "string" && pattern === ctx.request.url.pathname;
  const testRegExp = (pattern: any) =>
    pattern instanceof RegExp && pattern.test(ctx.request.url.pathname);

  for (const pattern of patterns) {
    if (
      testString(pattern) ||
      testRegExp(pattern) ||
      (
        typeof pattern === "object" &&
        (
          testString((pattern as patternT).path) ||
          testRegExp((pattern as patternT).path)
        ) && (
          !(pattern as patternT).methods ||
          (pattern as patternT).methods?.includes(ctx.request.method)
        )
      )
    ) {
      return true;
    }
  }

  return false;
};

export const jwtMiddleware = <
  T extends RouterMiddleware | Middleware = Middleware,
>({
  secret,
  isThrowing = false,
  critHandlers,
  onSuccess,
  onFailure,
  customMessages,
  expiresAfter,
  ignorePatterns,
}: jwtMiddlewareOptions): T => {
  const core: RouterMiddleware = async (ctx, next) => {
    if (!ignorePatterns || !ignorePath(ctx, ignorePatterns)) {
      let isUnauthorized = true;
      let isExpired = false;

      if (ctx.request.headers.has("Authorization")) {
        const authHeader = ctx.request.headers.get("Authorization")!;

        if (authHeader.startsWith("Bearer ") && authHeader.length > 7) {
          const token = authHeader.slice(7);
          const jwtOptions: Opts = { isThrowing };

          if (critHandlers) jwtOptions.critHandlers = critHandlers;

          const decryptedToken = await validateJwt(
            token,
            secret,
            jwtOptions,
          );

          if (decryptedToken) {
            if (
              expiresAfter &&
              decryptedToken.payload?.iat &&
              decryptedToken.payload?.iat <
                (new Date().getTime() - (expiresAfter || 0))
            ) {
              isExpired = true;
            } else {
              isUnauthorized = false;
              onSuccess &&
                onSuccess(ctx, decryptedToken);
            }
          }
        }
      }

      if (isUnauthorized) {
        if (onFailure) {
          const ignoreFailure = onFailure(ctx, isExpired);

          if (!ignoreFailure) return;
        } else {
          ctx.throw(
            ErrorStatus.Unauthorized,
            isExpired
              ? (customMessages?.expired ?? "Token expired")
              : (customMessages?.invalid ?? "Authentication failed"),
          );
        }
      }
    }

    await next();
  };

  return core as T;
};

export default { jwtMiddleware };
