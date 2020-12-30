import {
  AlgorithmInput,
  assert,
  assertThrowsAsync,
  create,
  createHttpError,
  getNumericDate,
  Payload,
  RouterContext,
} from "./deps.ts";
import { jwtMiddleware, JwtMiddlewareOptions } from "./mod.ts";

const SECRET = "some-secret";
const ALGORITHM: AlgorithmInput = "HS512";
const jwtOptions = {
  key: SECRET,
  algorithm: ALGORITHM,
};

const mockContext = (token?: string): RouterContext =>
  ({
    request: {
      headers: new Headers(
        token ? { "Authorization": `Bearer ${token}` } : undefined,
      ),
      url: new URL("http://foo.bar/baz"),
      method: "GET",
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

const tests = [
  {
    name: "Success",
    async fn() {
      let jwtObj: Payload = {};

      const payload = { test: "test" };
      const mockJwt = await create(
        { alg: ALGORITHM, typ: "jwt" },
        payload,
        SECRET,
      );

      const mw = jwtMiddleware({
        ...jwtOptions,
        onSuccess: (ctx: any, payload: Payload) => {
          jwtObj = payload;
        },
      });

      await mw(mockContext(mockJwt), mockNext);

      assert(jwtObj.test === payload.test);
    },
  },
  {
    name: "Failure with expired token",
    async fn() {
      const mockJwt = await create(
        { alg: ALGORITHM, typ: "jwt" },
        { exp: getNumericDate(new Date(2000, 1, 0)) },
        SECRET,
      );

      const mw = jwtMiddleware(jwtOptions);

      assertThrowsAsync(
        async () => await mw(mockContext(mockJwt), mockNext),
        undefined,
        "Authentication failed",
      );
    },
  },
  {
    name: "No header",
    async fn() {
      const mw = jwtMiddleware(jwtOptions);

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
      const mw = jwtMiddleware(jwtOptions);

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
      const mw = jwtMiddleware(jwtOptions);

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
  {
    name: "Pattern ignore string",
    async fn() {
      const mw = jwtMiddleware(Object.assign({}, jwtOptions, {
        ignorePatterns: ["/baz"],
      }));

      await mw(mockContext(), mockNext);

      assert(true);
    },
  },
  {
    name: "Pattern ignore regex",
    async fn() {
      const mw = jwtMiddleware(Object.assign({}, jwtOptions, {
        ignorePatterns: [/baz/],
      }));

      await mw(mockContext(), mockNext);

      assert(true);
    },
  },
  {
    name: "Pattern ignore object string",
    async fn() {
      const mw = jwtMiddleware(Object.assign({}, jwtOptions, {
        ignorePatterns: [{ path: "/baz" }],
      }));

      await mw(mockContext(), mockNext);

      assert(true);
    },
  },
  {
    name: "Pattern ignore object regex",
    async fn() {
      const mw = jwtMiddleware(Object.assign({}, jwtOptions, {
        ignorePatterns: [{ path: /baz/ }],
      }));

      await mw(mockContext(), mockNext);

      assert(true);
    },
  },
  {
    name: "Pattern ignore object string wrong method",
    async fn() {
      const mw = jwtMiddleware({
        ...jwtOptions,
        ignorePatterns: [{ path: "/baz", methods: ["PUT"] }],
      });

      assertThrowsAsync(async () => await mw(mockContext(), mockNext));
    },
  },
  {
    name: "Pattern ignore object string correct method",
    async fn() {
      const mw = jwtMiddleware({
        ...jwtOptions,
        ignorePatterns: [{ path: "/baz", methods: ["GET"] }],
      });

      await mw(mockContext(), mockNext);

      assert(true);
    },
  },
  {
    name: "Pattern ignore multiple",
    async fn() {
      const mw = jwtMiddleware({
        ...jwtOptions,
        ignorePatterns: ["/baz", /buz/, { path: "/biz", methods: ["GET"] }],
      });

      await mw(mockContext(), mockNext);

      assert(true);
    },
  },
  {
    name: "onSuccess is not called on invalid jwt",
    async fn() {
      const mw = jwtMiddleware({
        ...jwtOptions,
        onSuccess: () => {
          assert(false, "onSuccess is not called");
        },
      });

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
  {
    name: "onFailure is called",
    async fn() {
      const mw = jwtMiddleware({
        ...jwtOptions,
        onFailure: () => {
          assert(true, "onFailure is called");

          return false;
        },
      });

      await mw(
        mockContext(
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
        ),
        mockNext,
      );
    },
  },
];

for await (const test of tests) {
  Deno.test(test);
}
