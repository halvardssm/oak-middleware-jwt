import {
  AlgorithmInput,
  Application,
  assertEquals,
  create,
  getNumericDate,
  Middleware,
} from "./deps.ts";
import { jwtMiddleware } from "./mod.ts";

const SECRET = "some-secret";
const ALGORITHM: AlgorithmInput = "HS512";
const INVALID_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

const getJWT = ({ expirationDate }: { expirationDate?: Date } = {}) => {
  return create({ alg: ALGORITHM, typ: "jwt" }, {
    exp: getNumericDate(expirationDate || 60 * 60),
  }, SECRET);
};

// Spawns an application with middleware instantiated
const createApplicationAndClient = () => {
  const controller = new AbortController();
  const app = new Application();

  app.use(
    jwtMiddleware<Middleware>({
      algorithm: ALGORITHM,
      secret: SECRET,
    }),
  );

  app.use((ctx) => {
    ctx.response.body = "hello-world";
    ctx.response.status = 200;
  });

  return {
    listen: () => {
      return app.listen({
        port: 9876,
        hostname: "localhost",
        signal: controller.signal,
      });
    },
    controller,
    client: {
      request: (options: RequestInit) => {
        return fetch("http://localhost:9876", options);
      },
    },
  };
};

const tests = [
  {
    name: "error with invalid Authorization",
    async fn() {
      const { controller, client, listen } = createApplicationAndClient();
      listen();

      const headers = new Headers();
      headers.set("Authorization", "Noth");

      const response = await client.request({ headers });

      assertEquals(response.status, 401);
      assertEquals(response.statusText, "Unauthorized");
      assertEquals(await response.text(), "Authentication failed");

      controller.abort();
    },
  },
  {
    name: "error with invalid Bearer",
    async fn() {
      const { controller, client, listen } = createApplicationAndClient();
      listen();

      const headers = new Headers();
      headers.set("Authorization", "Bearer 123");

      const response = await client.request({ headers });

      assertEquals(response.status, 401);
      assertEquals(response.statusText, "Unauthorized");
      assertEquals(await response.text(), "Authentication failed");

      controller.abort();
    },
  },
  {
    name: "success with valid token",
    async fn() {
      const { controller, client, listen } = createApplicationAndClient();
      listen();

      const headers = new Headers();
      headers.set("Authorization", `Bearer ${await getJWT()}`);

      const response = await client.request({ headers });

      assertEquals(response.status, 200);
      assertEquals(await response.text(), "hello-world");

      controller.abort();
    },
  },
  {
    name: "failure with invalid token",
    async fn() {
      const { controller, client, listen } = createApplicationAndClient();
      listen();

      const headers = new Headers();
      headers.set("Authorization", `Bearer ${INVALID_JWT}`);

      const response = await client.request({ headers });

      assertEquals(response.status, 401);
      assertEquals(await response.text(), "Authentication failed");

      controller.abort();
    },
  },
  {
    name: "failure with expired token",
    async fn() {
      const { controller, client, listen } = createApplicationAndClient();
      listen();

      const headers = new Headers();
      const expiredJwt = await getJWT({
        expirationDate: new Date(2000, 0, 0),
      });

      headers.set("Authorization", `Bearer ${expiredJwt}`);

      const response = await client.request({ headers });

      assertEquals(response.status, 401);
      assertEquals(await response.text(), "Authentication failed");

      controller.abort();
    },
  },
];

for await (const test of tests) {
  test.name = `integration: ${test.name}`;
  Deno.test(test);
}

export {};
