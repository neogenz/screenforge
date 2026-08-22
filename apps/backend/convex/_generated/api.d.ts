/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountDeletion from "../accountDeletion.js";
import type * as assets from "../assets.js";
import type * as auth from "../auth.js";
import type * as authAdmission from "../authAdmission.js";
import type * as authz from "../authz.js";
import type * as billing from "../billing.js";
import type * as billingLifecycle from "../billingLifecycle.js";
import type * as cloudData from "../cloudData.js";
import type * as crons from "../crons.js";
import type * as download from "../download.js";
import type * as entitlements from "../entitlements.js";
import type * as http from "../http.js";
import type * as limits from "../limits.js";
import type * as maintenance from "../maintenance.js";
import type * as media from "../media.js";
import type * as mirror from "../mirror.js";
import type * as origins from "../origins.js";
import type * as polar from "../polar.js";
import type * as posthog from "../posthog.js";
import type * as preflight from "../preflight.js";
import type * as preflight_evaluation from "../preflight_evaluation.js";
import type * as projects from "../projects.js";
import type * as settings from "../settings.js";
import type * as storageReferences from "../storageReferences.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountDeletion: typeof accountDeletion;
  assets: typeof assets;
  auth: typeof auth;
  authAdmission: typeof authAdmission;
  authz: typeof authz;
  billing: typeof billing;
  billingLifecycle: typeof billingLifecycle;
  cloudData: typeof cloudData;
  crons: typeof crons;
  download: typeof download;
  entitlements: typeof entitlements;
  http: typeof http;
  limits: typeof limits;
  maintenance: typeof maintenance;
  media: typeof media;
  mirror: typeof mirror;
  origins: typeof origins;
  polar: typeof polar;
  posthog: typeof posthog;
  preflight: typeof preflight;
  preflight_evaluation: typeof preflight_evaluation;
  projects: typeof projects;
  settings: typeof settings;
  storageReferences: typeof storageReferences;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
