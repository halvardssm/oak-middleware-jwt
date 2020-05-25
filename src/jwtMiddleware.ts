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

export type jwtMiddlewareOptions = {
  secret: string; // Secret key
  decryptedTokenHandler?: (
    ctx: Context | RouterContext,
    jwtObject: JwtObject,
  ) => void; // Callback for decrypted token
  isThrowing?: boolean; // True if you want the throw message from djwt, False, if you prefer custom messages (uses ctx.throw()). Default true, recommended false
  critHandlers?: Handlers; // see djwt
  customMessages?: customMessagesT; // Custom error messages
  expiresAfter?: number; // Duration for expiration, uses iat to determine if the token is expired. E.g. (1000*60*60) = 1 hour expiration time
  ignorePatterns?: Array<ignorePathT>; // Pattern to ignore e.g. `/authenticate`, when passing a string, the string will be matched with the path `===`
};

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
  isThrowing = true,
  critHandlers,
  decryptedTokenHandler,
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
              decryptedTokenHandler &&
                decryptedTokenHandler(ctx, decryptedToken);
            }
          }
        }
      }

      if (isUnauthorized) {
        ctx.throw(
          ErrorStatus.Unauthorized,
          isExpired
            ? (customMessages?.expired ?? "Token expired")
            : (customMessages?.invalid ?? "Authentication failed"),
        );
      }
    }

    await next();
  };

  return core as T;
};

export default { jwtMiddleware };
