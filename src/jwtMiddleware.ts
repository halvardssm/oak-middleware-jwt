import {
  AlgorithmInput,
  Context,
  HTTPMethods,
  Middleware,
  Payload,
  RouterContext,
  RouterMiddleware,
  Status,
  verify,
} from "../deps.ts";

export type Pattern = { path: string | RegExp; methods?: HTTPMethods[] };
export type IgnorePattern = string | RegExp | Pattern;
export type ErrorMessagesKeys = "ERROR_INVALID_AUTH";
export type ErrorMessages = Partial<Record<ErrorMessagesKeys, string>>;
export type OnSuccessHandler = (
  ctx: Context | RouterContext,
  payload: Payload,
) => void;
export type OnFailureHandler = (
  ctx: Context | RouterContext,
  error: Error,
) => boolean;

export type { AlgorithmInput, Payload };

export interface JwtMiddlewareOptions {
  /** Custom error messages */
  customMessages?: ErrorMessages;

  /** Pattern to ignore e.g. `/authenticate`, can be a RegExp, Pattern object or string.
   *
   * When passing a string, the string will be matched with the path `===`.
   */
  ignorePatterns?: Array<IgnorePattern>;

  /** Optional callback for successfull validation, passes the Context and the JwtValidation object */
  onSuccess?: OnSuccessHandler;

  /** Optional callback for unsuccessfull validation, passes the Context and JwtValidation if the JWT is present in the header.
	 *
	 * When not used, will throw HTTPError using custom (or default) messages.
	 * If you want the failure to be ignored and to call the next middleware, return true.
	 */
  onFailure?: OnFailureHandler;

  /** See the djwt module for Validation options */
  key: string;
  algorithm: AlgorithmInput;
}

const errorMessages: ErrorMessages = {
  ERROR_INVALID_AUTH: "Authentication failed",
};

const isPattern = (obj: any): obj is Pattern => {
  return typeof obj === "object" && obj.path;
};

const ignorePath = <T extends Context | RouterContext>(
  ctx: T,
  patterns: Array<IgnorePattern>,
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
        isPattern(pattern) &&
        (testString(pattern.path) || testRegExp(pattern.path)) &&
        (!pattern.methods || pattern.methods?.includes(ctx.request.method))
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
  key,
  algorithm,
  customMessages = {},
  ignorePatterns,
  onSuccess = () => {},
  onFailure = () => true,
}: JwtMiddlewareOptions): T => {
  Object.assign(customMessages, errorMessages);

  const core: RouterMiddleware = async (ctx, next) => {
    const onUnauthorized = async (
      jwtValidation: Error,
    ) => {
      const shouldThrow = onFailure(ctx, jwtValidation);
      if (shouldThrow) {
        ctx.throw(
          Status.Unauthorized,
          customMessages?.ERROR_INVALID_AUTH,
        );
      }

      await next();
    };

    // If request matches ignore, call next early
    if (ignorePatterns && ignorePath(ctx, ignorePatterns)) {
      await next();

      return;
    }

    // No Authorization header
    if (!ctx.request.headers.has("Authorization")) {
      await onUnauthorized(new Error("Authorization header is not present"));

      return;
    }

    // Authorization header has no Bearer or no token
    const authHeader = ctx.request.headers.get("Authorization")!;
    if (!authHeader.startsWith("Bearer ") || authHeader.length <= 7) {
      await onUnauthorized(new Error("Invalid Authorization header"));

      return;
    }

    const jwt = authHeader.slice(7);
    try {
      onSuccess(ctx, await verify(jwt, key, algorithm));
      await next();
    } catch (e) {
      await onUnauthorized(e);
    }
  };

  return core as T;
};

export default { jwtMiddleware };
