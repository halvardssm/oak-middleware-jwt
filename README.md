# Oak Middleware JWT

![CI](https://github.com/halvardssm/oak-middleware-jwt/workflows/CI/badge.svg)
[![(Deno)](https://img.shields.io/badge/deno-1.0.3-green.svg)](https://deno.land)
[![deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/raw.githubusercontent.com/halvardssm/oak-middleware-jwt/master/mod.ts)

Oak middleware for JWT

## Usage

* As an application middleware

  ```ts
  import { jwtMiddlewareApplication } from "https://raw.githubusercontent.com/halvardssm/oak-middleware-jwt/master/mod.ts"
  import { Middleware } from "https://deno.land/x/oak/mod.ts";

  const app = new Application();
  
  app.use(jwtMiddlewareApplication<Middleware>({secret:"foo"}));
  
  await app.listen(appOptions);
  ```

* As a router middleware

  ```ts
  import { jwtMiddlewareRouter } from "https://raw.githubusercontent.com/halvardssm/oak-middleware-jwt/master/mod.ts"
  import { RouterMiddleware } from "https://deno.land/x/oak/mod.ts";
  
  interface ApplicationState {
    userId: string
  }
  
  const router = new Router();
  
  const app = new Application<ApplicationState>();
  
  const decryptedTokenHandler = (ctx,token) => {
    ctx.state.userId = token
  }
  
  router
    .get("/bar", jwtMiddlewareRouter<RouterMiddleware>({ secret:"foo", decryptedTokenHandler }), async (ctx) => {
      const callerId = ctx.state.userId
      ...
    })
  
  app.use(router.routes());
  
  await app.listen(appOptions);
  ```

## Options

* secret: string; // Secret key
* decryptedTokenHandler?: (ctx: Context | RouterContext, jwtObject: JwtObject) => void; // Callback for decrypted token
* isThrowing?: boolean; // True if you want the throw message from djwt, False, if you prefer custom messages (uses ctx.throw()). Default true, recommended false
* critHandlers?: Handlers; // see djwt
* customMessages?: customMessagesT; // Custom error messages
* expiresAfter?: number; // Duration for expiration, uses iat to determine if the token is expired. E.g. (1000*60*60) = 1 hour expiration time
* ignorePatterns?: Array<ignorePathT>; // Pattern to ignore e.g. `/authenticate`, when passing a string, the string will be matched with the path `===`

## Contributing

All contributions are welcome, make sure to read the [contributing guidelines](./.github/CONTRIBUTING.md).

## Uses

* [Oak](https://deno.land/x/oak/)
* [djwt](https://deno.land/x/djwt)
