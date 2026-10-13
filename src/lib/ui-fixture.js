import cakeMePayload from "../fixtures/cake-me-foundation.json";
import {scoreBio} from "../../server/src/lib/score-bio.js";
import React from "react";

/* Dev-only sample workspace for UI review screenshots.
   Active only when Vite is in dev and VITE_UI_FIXTURE=1.
   Production builds tree-shake the flag to false. */

export const uiFixtureEnabled = import.meta.env.DEV && import.meta.env.VITE_UI_FIXTURE === "1";

const cakeMeFixture = import.meta.env.VITE_UI_FIXTURE_BRAND === "cakeme";
export const FIXTURE_BRAND_ID = cakeMeFixture ? "fixture-brand-cakeme" : "fixture-brand-northshore";

export const FIXTURE_SESSION = {
  id: "fixture-user",
  email: "aitana@northshore.test",
  role: "client",
  portal: "client",
  permissions: [],
  name: "Aitana Vives",
  avatar: "caastor/assets/profile-1.jpg",
};

export const FIXTURE_BRANDS = [
  { id: FIXTURE_BRAND_ID, name: cakeMeFixture ? "Cake Me" : "Northshore", created_at: "2026-04-02T09:00:00.000Z" },
];

const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();

export const FIXTURE_BRIEFS = [
  {
    id: "fixture-brief-launch",
    title: "Spring launch for the house blend",
    type: "campaign",
    mode: "auto",
    status: "approved",
    created_at: hoursAgo(5),
    payload: { title: "Spring launch for the house blend", request: "Spring launch for the house blend" },
    runs: [
      {
        id: "run-1",
        specialist_id: "a01",
        status: "complete",
        outputs: [{ id: "out-1", kind: "copy", body: "Keep the roast story specific.", status: "approved" }],
      },
      {
        id: "run-2",
        specialist_id: "a02",
        status: "complete",
        outputs: [{ id: "out-2", kind: "copy", body: "One line, not a paragraph.", status: "approved" }],
      },
    ],
  },
  {
    id: "fixture-brief-cafe",
    title: "Cafe window posters",
    type: "campaign",
    mode: "auto",
    status: "review",
    created_at: hoursAgo(30),
    payload: { title: "Cafe window posters", request: "Cafe window posters" },
    runs: [
      {
        id: "run-3",
        specialist_id: "a03",
        status: "complete",
        outputs: [{ id: "out-3", kind: "copy", body: "The headline overclaims origin.", status: "flagged" }],
      },
    ],
  },
  {
    id: "fixture-brief-list",
    title: "Wholesale one-pager",
    type: "one_off",
    mode: "auto",
    status: "approved",
    created_at: hoursAgo(50),
    payload: { title: "Wholesale one-pager", request: "Wholesale one-pager" },
    runs: [
      {
        id: "run-4",
        specialist_id: "a34",
        status: "complete",
        outputs: [{ id: "out-4", kind: "copy", body: "Buyers want the price and the promise.", status: "approved" }],
      },
    ],
  },
];

export const FIXTURE_BIO_STATE = {
  brandId: FIXTURE_BRAND_ID,
  brandName: "Northshore",
  brandUrl: "https://northshore.example",
  loading: false,
  error: null,
  review: null,
  diff: [],
  reviewPending: false,
  focusCount: 4,
  cert: null,
  bio: {
    id: "fixture-bio-1",
    version: 3,
    score: 72,
    certified: false,
    self_certified: false,
    payload: {
      identity: {
        positioning: "A coastal roaster for people who want the cup to taste like the place it came from.",
        category: "Specialty coffee",
        founded: "2014",
        pillars: ["Origin", "Restraint", "Hospitality"],
      },
      audience: {
        primary: "Independent cafe buyers",
        secondary: "Weekend home brewers",
        tertiary: "",
        jtbd: ["Choose a house blend they can defend"],
      },
      voice: {
        register: "Plain, specific, a little dry",
        forbidden: ["Journey", "Curated", "Elevate"],
        rhythm: "Short sentences. One claim at a time.",
        signatures: ["Named farms", "No exclamation marks"],
      },
      goals: {
        northStar: "Become the default house blend on the coast",
        q2: "Open wholesale to twelve cafes",
        q3: "Publish the brand book",
      },
      strategic: {
        watchouts: [
          "The origin story is doing the work the product should do.",
          "Seasonal language keeps drifting into lifestyle filler.",
        ],
        notList: [
          "A lifestyle brand about mornings",
          "A discount subscription",
          "A cafe chain",
          "A sustainability lecture",
        ],
        diagnosis: "The brand is clearer in the cup than in the copy. Hold the line on place and process.",
      },
      missing: [
        { field: "Price architecture", why: "Wholesale and retail are still one number." },
        { field: "Cafe audience", why: "Buyers are described, not evidenced." },
        { field: "Packaging rules", why: "No crop or clear-space note." },
        { field: "Proof of origin", why: "Farm names are claimed, not sourced." },
      ],
      confidence: {
        "identity.positioning": { conf: 80, source: "site" },
        "identity.category": { conf: 90, source: "site" },
        "identity.founded": { conf: 70, source: "about" },
      },
    },
  },
};

if(cakeMeFixture){
  FIXTURE_BIO_STATE.brandName='Cake Me';FIXTURE_BIO_STATE.brandUrl='https://thecake-me.com';
  FIXTURE_BIO_STATE.bio={id:'fixture-cakeme-v1',version:1,payload:cakeMePayload,score:scoreBio(cakeMePayload),certified:false,self_certified:false};
}
export function saveFixtureFoundation(payload){
  if(!uiFixtureEnabled)throw Error('Fixture saves only run locally');
  FIXTURE_BIO_STATE.bio={...FIXTURE_BIO_STATE.bio,id:`fixture-bio-${crypto.randomUUID()}`,version:FIXTURE_BIO_STATE.bio.version+1,payload,score:scoreBio(payload),certified:false,self_certified:false};
  window.dispatchEvent(new Event('fixture:bio'));
}

export const FIXTURE_SOURCES = [
  { src: "northshore.example", date: "2 Apr", n: 18, bucket: "foundations" },
  { src: "Wholesale menu 2026.pdf", date: "4 Apr", n: 6, bucket: "voice" },
  { src: "Cafe interviews", date: "9 Apr", n: 4, bucket: "foundations" },
];

/* Reading progress for the shell status row. Null means idle. */
let readProgress = null;
const readListeners = new Set();

export function getReadProgress() {
  return readProgress;
}

export function subscribeReadProgress(listener) {
  readListeners.add(listener);
  return () => readListeners.delete(listener);
}

export function publishReadProgress(next) {
  readProgress = next && next.total ? next : null;
  readListeners.forEach((listener) => listener());
}

export function useReadProgress() {
  return React.useSyncExternalStore(subscribeReadProgress, getReadProgress, getReadProgress);
}

if (uiFixtureEnabled && typeof window !== "undefined") {
  try { localStorage.setItem("ci_current_brand_id", FIXTURE_BRAND_ID); } catch { /* private mode */ }
  /* Sample in-progress read so the status row is visible without a live job. */
  publishReadProgress({ done: 3, total: 7 });
}
