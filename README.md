# Oak Middleware JWT

[![GitHub Workflow Status (branch)](https://img.shields.io/github/workflow/status/halvardssm/oak-middleware-jwt/CI/master?style=flat-square&logo=github)](https://github.com/halvardssm/oak-middleware-jwt/actions?query=branch%3Amaster+workflow%3ACI)
[![(Deno)](https://img.shields.io/badge/deno-v1.2.0-green.svg?style=flat-square&logo=deno)](https://deno.land)
[![deno doc](https://img.shields.io/badge/deno-doc-blue.svg?style=flat-square&logo=deno)](https://doc.deno.land/https/raw.githubusercontent.com/halvardssm/oak-middleware-jwt/master/mod.ts)

Oak middleware for JWT

## Usage

* As an application middleware

  ```ts
  import { jwtMiddleware } from "https://raw.githubusercontent.com/halvardssm/oak-middleware-jwt/master/mod.ts"
  import { Middleware } from "https://deno.land/x/oak/mod.ts";

  const app = new Application();
  
  app.use(jwtMiddleware<Middleware>({key: "foo"}));
  
  await app.listen(appOptions);
  ```

* As a router middleware

  ```ts
  import { jwtMiddleware, OnSuccessHandler } from "https://raw.githubusercontent.com/halvardssm/oak-middleware-jwt/master/mod.ts"
  import { RouterMiddleware } from "https://deno.land/x/oak/mod.ts";
  
  interface ApplicationState {
    userId: string
  }
  
  const router = new Router();
  const app = new Application<ApplicationState>();
  
  const onSuccess: OnSuccessHandler = (ctx, token) => {
    ctx.state.userId = token
  }
  
  router
    .get("/bar", jwtMiddleware<RouterMiddleware>({ key:"foo", onSuccess }), async (ctx) => {
      const callerId = ctx.state.userId
      ...
    })
  
  app.use(router.routes());
  
  await app.listen(appOptions);
  ```

* With ignore patterns

  ```ts
  import { jwtMiddleware, OnSuccessHandler } from "https://raw.githubusercontent.com/halvardssm/oak-middleware-jwt/master/mod.ts"
  import { RouterMiddleware } from "https://deno.land/x/oak/mod.ts";
  
  const app = new Application<ApplicationState>();
  
  const ignorePatterns = ["/baz", /buz/, {path: "/biz", methods: ["GET"]}]

  app.use(jwtMiddleware<Middleware>({key: "foo", ignorePatterns}));
  
  await app.listen(appOptions);
  ```

## Options

* key: string; // See the djwt module for Validation options
* algorithm: Algorithm | Algorithm[]; // See the djwt module for Validation options
* customMessages?: ErrorMessages; // Custom error messages
* ignorePatterns?: Array<IgnorePath>; // Pattern to ignore e.g. `/authenticate`, can be a RegExp, Pattern object or string. When passing a string, the string will be matched with the path `===`
* onSuccess?: OnSuccessHandler; // Optional callback for successfull validation, passes the Context and the JwtValidation object
* onFailure?: OnFailureHandler; // Optional callback for unsuccessfull validation, passes the Context and JwtValidation if the JWT is present in the header

## Contributing

All contributions are welcome, make sure to read the [contributing guidelines](./.github/CONTRIBUTING.md).

## Uses

* [Oak](https://deno.land/x/oak/)
* [djwt](https://deno.land/x/djwt)
