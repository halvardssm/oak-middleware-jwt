# Oak Middleware JWT

[![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/halvardssm/oak-middleware-jwt?logo=deno&style=flat-square)](https://github.com/halvardssm/oak-middleware-jwt)
[![GitHub Workflow Status (branch)](https://img.shields.io/github/workflow/status/halvardssm/oak-middleware-jwt/CI/master?style=flat-square&logo=github)](https://github.com/halvardssm/oak-middleware-jwt/actions?query=branch%3Amaster+workflow%3ACI)
[![(Deno)](https://img.shields.io/badge/deno-v1.18.2-green.svg?style=flat-square&logo=deno)](https://deno.land)
[![(Deno)](https://img.shields.io/badge/oak-v10.2.0-orange.svg?style=flat-square&logo=deno)](https://github.com/oakserver/oak)
[![(Deno)](https://img.shields.io/badge/djwt-v2.4-orange.svg?style=flat-square&logo=deno)](https://github.com/timonson/djwt)
[![deno doc](https://img.shields.io/badge/deno-doc-blue.svg?style=flat-square&logo=deno)](https://doc.deno.land/https/raw.githubusercontent.com/halvardssm/oak-middleware-jwt/master/mod.ts)
[![nest badge](https://nest.land/badge-block.svg)](https://nest.land/package/oak-middleware-jwt)

Oak middleware for JWT using Djwt

## Usage

- As an application middleware

  ```ts
  import { jwtMiddleware } from "https://raw.githubusercontent.com/halvardssm/oak-middleware-jwt/master/mod.ts";
  import { Middleware } from "https://deno.land/x/oak/mod.ts";

  const app = new Application();

  app.use(jwtMiddleware<Middleware>({ key: "foo" }));

  await app.listen(appOptions);
  ```

- As a router middleware

  ```ts
  import { jwtMiddleware, OnSuccessHandler } from "https://raw.githubusercontent.com/halvardssm/oak-middleware-jwt/master/mod.ts"
  import { RouterMiddleware } from "https://deno.land/x/oak/mod.ts";

  interface ApplicationState {
    userId: string
  }

  const router = new Router();
  const app = new Application<ApplicationState>();

  const onSuccess: OnSuccessHandler = (ctx, jwtPayload) => {
    ctx.state.userId = jwtPayload.userId
  }

  router
    .get("/bar", jwtMiddleware<RouterMiddleware>({ key:"foo", onSuccess }), async (ctx) => {
      const callerId = ctx.state.userId
      ...
    })

  app.use(router.routes());

  await app.listen(appOptions);
  ```

- With ignore patterns

  ```ts
  import {
    IgnorePattern,
    jwtMiddleware,
    OnSuccessHandler,
  } from "https://raw.githubusercontent.com/halvardssm/oak-middleware-jwt/master/mod.ts";
  import { RouterMiddleware } from "https://deno.land/x/oak/mod.ts";

  const app = new Application<ApplicationState>();

  const ignorePatterns: IgnorePattern[] = ["/baz", /buz/, {
    path: "/biz",
    methods: ["GET"],
  }];

  app.use(jwtMiddleware<Middleware>({ key: "foo", ignorePatterns }));

  await app.listen(appOptions);
  ```

## Options

- key: string; // See the djwt module for Validation options
- algorithm: AlgorithmInput ; // See the djwt module for Validation options
- customMessages?: ErrorMessages; // Custom error messages
- ignorePatterns?: Array<IgnorePattern>; // Pattern to ignore e.g.
  `/authenticate`, can be a RegExp, Pattern object or string. When passing a
  string, the string will be matched with the path `===`
- onSuccess?: OnSuccessHandler; // Optional callback for successfull validation,
  passes the Context and the Payload object from djwt module
- onFailure?: OnFailureHandler; // Optional callback for unsuccessfull
  validation, passes the Context and the Error encountered while validating the
  jwt

## Error Handling

All errors originating from this middleware is of class `JWTMiddlewareError`
which is exported. To handle `JWTMiddlewareError`s you can do such:

```ts
...
} catch(e){
  if(e instanceof JWTMiddlewareError){
    //do something
  }
}
```

## Migrating from v1.0.0

- Change the previous `algorithm` parameter's type from `Algorithm` to
  `AlgorithmInput`

```ts
import { AlgorithmInput } from "https://raw.githubusercontent.com/halvardssm/oak-middleware-jwt/master/mod.ts";

const algorithm: AlgorithmInput = "HS512";

app.use(jwtMiddleware<Middleware>({ key: "foo", algorithm }));
```

- Change the onFailure and onSuccess callbacks.
  - `onSuccess` gets an object of type `Payload` as a second argument (check
    https://github.com/timonson/djwt#decode)
  - `onFailure` gets an object of type `Error` as a second argument, should
    return `true` if the error should be thrown instead of returning as a
    response.

```ts
const onFailure = (ctx, error: Error) => {
  console.log(error.message);
};

const onSuccess = (ctx, payload: Payload) => {
  console.log(payload.userId);
};
```

- The expired token bug was fixed. This module will now throw an error (and call
  `onFailure` callback) if the token sent is expired. Can cause problems in
  implementations that weren't expecting that

## Contributing

All contributions are welcome, make sure to read the
[contributing guidelines](./.github/CONTRIBUTING.md).

## Uses

- [Oak](https://deno.land/x/oak/)
- [djwt](https://deno.land/x/djwt)
