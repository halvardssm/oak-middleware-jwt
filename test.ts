import {
	RouterContext,
	createHttpError,
	JwtObject,
	Jose,
	makeJwt,
	Payload,
	setExpiration,
	assertThrowsAsync,
	assert,
} from "./deps.ts";
import { jwtMiddlewareApplication } from "./mod.ts";

const SECRET = "some-secret";
const header: Jose = {
	alg: "HS512",
};

const payload = (): Payload => {
	return {
		iat: setExpiration(new Date().getTime()),
		iss: "test",
	};
};

const mockContext = (token?: string): RouterContext =>
	({
		request: {
			headers: new Headers(
				token ? { "Authorization": `Bearer ${token}` } : undefined,
			),
		},
		throw: (status: number, msg: string) => {
			throw createHttpError(status, msg);
		},
	}) as RouterContext;

const mockNext = () => {
	return new Promise<void>((resolve) => {
		resolve();
	});
};

const initJwtObj = (): JwtObject => ({}) as JwtObject;

const tests = [
	{
		name: "Success",
		async fn() {
			let jwtObj = initJwtObj();

			const mockJwt = makeJwt({ key: SECRET, header, payload: payload() });

			const mw = jwtMiddlewareApplication(
				{
					secret: SECRET,
					decryptedTokenHandler: (ctx, jwt) => {
						jwtObj = jwt;
					},
				},
			);

			await mw(mockContext(mockJwt), mockNext);

			assert(jwtObj.payload?.iss === payload().iss);
		},
	},
	{
		name: "Expired",
		async fn() {
			let jwtObj = initJwtObj();

			const pl = payload();

			const mockJwt = makeJwt({ key: SECRET, header, payload: pl });

			const mw = jwtMiddlewareApplication(
				{
					secret: SECRET,
					isThrowing: false,
					expiresAfter: -10000,
				},
			);

			assertThrowsAsync(
				async () => await mw(mockContext(mockJwt), mockNext),
				undefined,
				"Token expired",
			);
		},
	},
	{
		name: "No header",
		async fn() {
			const mw = jwtMiddlewareApplication(
				{
					secret: SECRET,
					isThrowing: false,
				},
			);

			assertThrowsAsync(
				async () => await mw(mockContext(), mockNext),
				undefined,
				"Authentication failed",
			);
		},
	},
	{
		name: "Invalid header",
		async fn() {
			const mw = jwtMiddlewareApplication(
				{
					secret: SECRET,
					isThrowing: false,
				},
			);

			assertThrowsAsync(
				async () => await mw(mockContext(""), mockNext),
				undefined,
				"Authentication failed",
			);
		},
	},
	{
		name: "Invalid token",
		async fn() {
			const mw = jwtMiddlewareApplication(
				{
					secret: SECRET,
					isThrowing: false,
				},
			);

			assertThrowsAsync(
				async () =>
					await mw(
						mockContext(
							"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
						),
						mockNext,
					),
				undefined,
				"Authentication failed",
			);
		},
	},
];

for await (const test of tests) {
	Deno.test(test);
}
