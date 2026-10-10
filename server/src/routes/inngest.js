// Inngest serve handler — single Hono request handler that the
// Inngest local dev server (and Inngest Cloud at deploy time) calls
// to introspect functions, replay steps, and stream results back.

import {quarantineTextExecutions} from "../inngest/functions/text-reconciliation.js";
import { creativeMedia, recoverCreativeMedia } from "../inngest/functions/creative-media.js";
import { serve } from "inngest/hono";
import { inngest } from "../lib/inngest.js";
import { compileBio } from "../inngest/functions/compile-bio.js";
import { sendNotificationEmail } from "../inngest/functions/send-notification-email.js";

export const inngestHandler = serve({
  client: inngest,
  functions: [compileBio, sendNotificationEmail, creativeMedia, recoverCreativeMedia, quarantineTextExecutions],
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
