import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry-options";

Sentry.init(sentryOptions);

// Lets Sentry follow page-to-page navigation in the App Router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;