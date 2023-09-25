import {
  afterEach,
  Algorithm,
  Application,
  assertEquals,
  beforeEach,
  create,
  describe,
  getNumericDate,
  it,
  Middleware,
} from "../deps.ts";
import { jwtMiddleware } from "../mod.ts";

const SECRET = await crypto.subtle.generateKey(
  { name: "HMAC", hash: "SHA-512" },
  true,
  ["sign", "verify"],
);
const ALGORITHM: Algorithm = "HS512";
const INVALID_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
const PORT = 8001;

const getJWT = ({ expirationDate }: { expirationDate?: Date } = {}) => {
  return create({ alg: ALGORITHM, typ: "jwt" }, {
    exp: getNumericDate(expirationDate || 60 * 60),
  }, SECRET);
};

// Spawns an application with middleware instantiated
const createApplicationAndClient = async () => {
  const controller = new AbortController();
  const app = new Application({ logErrors: false });

  app.use(
    jwtMiddleware<Middleware>({
      algorithm: ALGORITHM,
      key: SECRET,
    }),
  );

  app.use((ctx) => {
    ctx.response.body = "hello-world";
    ctx.response.status = 200;
  });

  const listen = app.listen({
    port: PORT,
    hostname: "localhost",
    signal: controller.signal,
  });

  await new Promise((resolve) => {
    setTimeout(resolve, 1000);
  });

  return {
    listen,
    controller,
    request: (options: RequestInit) => {
      return fetch(`http://localhost:${PORT}`, options);
    },
  };
};

describe("jwtMiddleware integration test", () => {
  let testCtx: Awaited<ReturnType<typeof createApplicationAndClient>>;

  beforeEach(async () => {
    testCtx = await createApplicationAndClient();
  });

  afterEach(async () => {
    testCtx.controller.abort();
    await testCtx.listen;
  });

  it("error with invalid Authorization", async () => {
    const headers = new Headers();
    headers.set("Authorization", "Noth");
    const response = await testCtx.request({ headers });

    assertEquals(response.status, 401);
    assertEquals(response.statusText, "Unauthorized");
    assertEquals(await response.text(), "Authentication failed");
  });

  it("error with invalid Bearer", async () => {
    const headers = new Headers();
    headers.set("Authorization", "Bearer 123");

    const response = await testCtx.request({ headers });

    assertEquals(response.status, 401);
    assertEquals(response.statusText, "Unauthorized");
    assertEquals(
      await response.text(),
      "The serialization of the jwt is invalid.",
    );
  });

  it("success with valid token", async () => {
    const headers = new Headers();
    headers.set("Authorization", `Bearer ${await getJWT()}`);

    const response = await testCtx.request({ headers });

    assertEquals(response.status, 200);
    assertEquals(await response.text(), "hello-world");
  });

  it("failure with invalid token", async () => {
    const headers = new Headers();
    headers.set("Authorization", `Bearer ${INVALID_JWT}`);

    const response = await testCtx.request({ headers });

    assertEquals(response.status, 401);
    assertEquals(
      await response.text(),
      "The jwt's alg 'HS256' does not match the key's algorithm.",
    );
  });

  it("failure with expired token", async () => {
    const headers = new Headers();
    const expiredJwt = await getJWT({
      expirationDate: new Date(2000, 0, 0),
    });

    headers.set("Authorization", `Bearer ${expiredJwt}`);

    const response = await testCtx.request({ headers });

    assertEquals(response.status, 401);
    assertEquals(await response.text(), "The jwt is expired.");
  });
});
