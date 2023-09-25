import {
  Algorithm,
  assert,
  assertRejects,
  create,
  createHttpError,
  describe,
  getNumericDate,
  it,
  Payload,
  RouterContext,
} from "../deps.ts";
import { jwtMiddleware, JwtMiddlewareOptions } from "../mod.ts";

const SECRET = await crypto.subtle.generateKey(
  { name: "HMAC", hash: "SHA-512" },
  true,
  ["sign", "verify"],
);
const ALGORITHM: Algorithm = "HS512";
const jwtOptions: JwtMiddlewareOptions = {
  key: SECRET,
  algorithm: ALGORITHM,
};

const mockContext = (token?: string): RouterContext<string> =>
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
  }) as RouterContext<string>;

const mockNext = () => {
  return new Promise<void>((resolve) => {
    resolve();
  });
};

describe("jwtMiddleware unit test", () => {
  it("succeeds", async () => {
    let jwtObj: Payload = {};

    const payload = { test: "test" };
    const mockJwt = await create(
      { alg: ALGORITHM, typ: "jwt" },
      payload,
      SECRET,
    );

    const mw = jwtMiddleware({
      ...jwtOptions,
      onSuccess: (_ctx, payload) => {
        jwtObj = payload;
      },
    });

    await mw(mockContext(mockJwt), mockNext);

    assert(jwtObj.test === payload.test);
  });

  it("fails with expired token", async () => {
    const mockJwt = await create(
      { alg: ALGORITHM, typ: "jwt" },
      { exp: getNumericDate(new Date(2000, 1, 0)) },
      SECRET,
    );

    const mw = jwtMiddleware(jwtOptions);

    await assertRejects(
      async () => await mw(mockContext(mockJwt), mockNext),
      Error,
      "The jwt is expired.",
    );
  });

  it("fails with no header", async () => {
    const mw = jwtMiddleware(jwtOptions);

    await assertRejects(
      async () => await mw(mockContext(), mockNext),
      Error,
      "Authentication failed",
    );
  });

  it("fails with invalid header", async () => {
    const mw = jwtMiddleware(jwtOptions);

    await assertRejects(
      async () => await mw(mockContext(""), mockNext),
      Error,
      "Authentication failed",
    );
  });

  it("fails with invalid token", async () => {
    const mw = jwtMiddleware(jwtOptions);

    await assertRejects(
      async () =>
        await mw(
          mockContext(
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
          ),
          mockNext,
        ),
      Error,
      "The jwt's alg 'HS256' does not match the key's algorithm.",
    );
  });

  it("pattern ignore string", async () => {
    const mw = jwtMiddleware(Object.assign({}, jwtOptions, {
      ignorePatterns: ["/baz"],
    }));

    await mw(mockContext(), mockNext);

    assert(true);
  });

  it("pattern ignore regex", async () => {
    const mw = jwtMiddleware(Object.assign({}, jwtOptions, {
      ignorePatterns: [/baz/],
    }));

    await mw(mockContext(), mockNext);

    assert(true);
  });

  it("pattern ignore object string", async () => {
    const mw = jwtMiddleware(Object.assign({}, jwtOptions, {
      ignorePatterns: [{ path: "/baz" }],
    }));

    await mw(mockContext(), mockNext);

    assert(true);
  });

  it("pattern ignore object regex", async () => {
    const mw = jwtMiddleware(Object.assign({}, jwtOptions, {
      ignorePatterns: [{ path: /baz/ }],
    }));

    await mw(mockContext(), mockNext);

    assert(true);
  });

  it("fails with pattern ignore object string wrong method", async () => {
    const mw = jwtMiddleware({
      ...jwtOptions,
      ignorePatterns: [{ path: "/baz", methods: ["PUT"] }],
    });

    await assertRejects(async () => await mw(mockContext(), mockNext));
  });

  it("succeeds with pattern ignore object string correct method", async () => {
    const mw = jwtMiddleware({
      ...jwtOptions,
      ignorePatterns: [{ path: "/baz", methods: ["GET"] }],
    });

    await mw(mockContext(), mockNext);

    assert(true);
  });

  it("succeeds with pattern ignore multiple", async () => {
    const mw = jwtMiddleware({
      ...jwtOptions,
      ignorePatterns: ["/baz", /buz/, { path: "/biz", methods: ["GET"] }],
    });

    await mw(mockContext(), mockNext);

    assert(true);
  });

  it("fails with onSuccess is not called on invalid jwt", async () => {
    const mw = jwtMiddleware({
      ...jwtOptions,
      onSuccess: () => {
        assert(false, "onSuccess is not called");
      },
    });

    await assertRejects(
      async () =>
        await mw(
          mockContext(
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
          ),
          mockNext,
        ),
      Error,
      "The jwt's alg 'HS256' does not match the key's algorithm.",
    );
  });

  it("fails with onFailure is called", async () => {
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
  });
});
