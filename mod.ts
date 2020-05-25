import {
	ErrorStatus,
	Middleware,
	RouterMiddleware,
	JwtObject,
	Opts,
	validateJwt,
	Jose,
	JsonValue,
	Handlers,
	Context,
	RouterContext
} from "./deps.ts";

export type customMessagesT = {
	expired?: string; // Message for when the token is expired, uses iat to determine
	invalid?: string; // Message for when the token is invalid
};

export interface JwtMiddlewareOptions {
	secret: string; // Secret key
	decryptedTokenHandler?: (ctx: Context | RouterContext, jwtObject: JwtObject) => void; // Callback for decrypted token
	isThrowing?: boolean; // True if you want the throw message from djwt, False, if you prefer custom messages (uses ctx.throw()). Default true, recommended false
	critHandlers?: Handlers; // see djwt
	customMessages?: customMessagesT; // Custom error messages
	expiresAfter?: number; // Duration for expiration, uses iat to determine if the token is expired. E.g. (1000*60*60) = 1 hour expiration time
}

export interface JwtMiddleware {
	(options: JwtMiddlewareOptions): RouterMiddleware | Middleware;
}

const jwtMiddleware: JwtMiddleware = (
	{
		secret,
		isThrowing = true,
		critHandlers,
		decryptedTokenHandler,
		customMessages,
		expiresAfter,
	},
) => {
	const jwtMiddlewareCore: RouterMiddleware = async (ctx, next) => {
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
						decryptedTokenHandler && decryptedTokenHandler(ctx, decryptedToken);
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

		await next();
	};

	return jwtMiddlewareCore;
};

export const jwtMiddlewareRouter: JwtMiddleware = (
	options,
): RouterMiddleware => {
	return jwtMiddleware(options);
};

export const jwtMiddlewareApplication: JwtMiddleware = (
	options,
): Middleware => {
	return jwtMiddleware(options) as Middleware;
};

export default { jwtMiddlewareRouter, jwtMiddlewareApplication };
