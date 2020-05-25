import {
  assert,
  assertThrowsAsync,
  createHttpError,
  Jose,
  JwtObject,
  makeJwt,
  Payload,
  RouterContext,
  setExpiration,
  HTTPMethods,
} from "./deps.ts";
import { jwtMiddleware } from "./mod.ts";

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

const initJwtObj = (): JwtObject => ({}) as JwtObject;

const tests = [
  {
    name: "Success",
    async fn() {
      let jwtObj = initJwtObj();

      const mockJwt = makeJwt({ key: SECRET, header, payload: payload() });

      const mw = jwtMiddleware(
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

      const mw = jwtMiddleware(
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
      const mw = jwtMiddleware(
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
      const mw = jwtMiddleware(
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
      const mw = jwtMiddleware(
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
  {
    name: "Pattern ignore string",
    async fn() {
      const mw = jwtMiddleware({
        secret: SECRET,
        ignorePatterns: ["/baz"],
      });

      await mw(mockContext(), mockNext);

      assert(true);
    },
  },
  {
    name: "Pattern ignore regex",
    async fn() {
      const mw = jwtMiddleware({
        secret: SECRET,
        ignorePatterns: [/baz/],
      });

      await mw(mockContext(), mockNext);

      assert(true);
    },
  },
  {
    name: "Pattern ignore object string",
    async fn() {
      const mw = jwtMiddleware({
        secret: SECRET,
        ignorePatterns: [{ path: "/baz" }],
      });

      await mw(mockContext(), mockNext);

      assert(true);
    },
  },
  {
    name: "Pattern ignore object regex",
    async fn() {
      const mw = jwtMiddleware({
        secret: SECRET,
        ignorePatterns: [{ path: /baz/ }],
      });

      await mw(mockContext(), mockNext);

      assert(true);
    },
  },
  {
    name: "Pattern ignore object string wrong method",
    async fn() {
      const mw = jwtMiddleware({
        secret: SECRET,
        ignorePatterns: [{ path: "/baz", methods: ["PUT"] }],
      });

      assertThrowsAsync(async () => await mw(mockContext(), mockNext));
    },
  },
  {
    name: "Pattern ignore object string correct method",
    async fn() {
      const mw = jwtMiddleware({
        secret: SECRET,
        ignorePatterns: [{ path: "/baz", methods: ["GET"] }],
      });

      await mw(mockContext(), mockNext);

      assert(true);
    },
  },
];

for await (const test of tests) {
  Deno.test(test);
}
