import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const discoveryUrl = new URL("./portal-discovery.jsx", import.meta.url);
const sharedUrl = new URL("./portal-shared.jsx", import.meta.url);

test("Discovery imports the shared Brandolph message it renders", async () => {
  const [discoverySource, sharedSource] = await Promise.all([
    readFile(discoveryUrl, "utf8"),
    readFile(sharedUrl, "utf8"),
  ]);

  assert.match(
    discoverySource,
    /import\s*\{\s*BrandolphLine\s*\}\s*from\s*["']\.\/portal-shared\.jsx["']/,
  );
  assert.match(sharedSource, /export\s+function\s+BrandolphLine\s*\(/);
});

test("the Discovery completion message renders without a missing component", async (t) => {
  globalThis.window = {
    CI_USER: { name: "Test operator", avatar: "" },
    matchMedia: () => ({ matches: true }),
  };

  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  t.after(async () => {
    await vite.close();
    delete globalThis.window;
  });

  const { BrandolphLine } = await vite.ssrLoadModule("/src/portal-shared.jsx");
  const markup = renderToStaticMarkup(
    React.createElement(BrandolphLine, {
      html: "*I've compiled the candidate BIO.* Unsupported claims stay out of the canon.",
    }),
  );

  assert.match(markup, /Brandolph/);
  assert.match(markup, /compiled the candidate BIO/);
});

test("the BIO evidence flow uses a real document picker and multipart upload", async () => {
  const source = await readFile(discoveryUrl, "utf8");

  assert.match(source, /type="file" multiple/);
  assert.match(source, /bucket\.key === "visual" \? SOURCE_FILE_ACCEPT : DOCUMENT_FILE_ACCEPT/);
  assert.match(source, /new FormData\(\)/);
  assert.match(source, /sources\/upload/);
  assert.match(source, /fileRef\.current\?\.click\(\)/);
  assert.doesNotMatch(source, /addReference\("Document upload · brand-deck\.pdf"/);
});

test("pending evidence must be incorporated before human review", async () => {
  const source = await readFile(discoveryUrl, "utf8");

  assert.match(source, /hasUnappliedSourceChanges/);
  assert.match(source, /Update your Brand Core with your new sources before you ask for a review/);
  assert.match(source, /Update Brand Core/);
  assert.match(source, /Check your changes before you ask for a review/);
});

test("visual intake requires declared roles, rights, and licensed font metadata", async () => {
  const source = await readFile(discoveryUrl, "utf8");

  assert.match(source, /otf,\.ttf,\.woff,\.woff2/);
  assert.match(source, /assetRole/);
  assert.match(source, /rightsConfirmed/);
  assert.match(source, /fontFamily/);
  assert.match(source, /licenseType/);
  assert.match(source, /visualAssetsReady/);
  assert.match(source, /Object\.entries\(meta\).*form\.set/s);
  assert.match(source, /type="button" className="discovery-text-action"/);
  assert.match(source, /method:"DELETE"/);
  assert.match(source, /fontFailures/);
});

test('competitive BIO renders safely and round trips evidence; unreviewed draft values are not confirmed', async (t) => {
 globalThis.window={CI_USER:{name:'Test'},matchMedia:()=>({matches:true})};
 const vite=await createServer({server:{middlewareMode:true},appType:'custom',define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('http://127.0.0.1:57321'),'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify('synthetic-unit-test')}});
 t.after(async()=>{await vite.close();delete globalThis.window;});
 const {BioCompetitive,safeCompetitiveUrl}=await vite.ssrLoadModule('/src/bio-competitive.jsx');
 const {payloadToFields,fieldsToPayload,discoFieldStatus}=await vite.ssrLoadModule('/src/portal-discovery.jsx');
 const positioning={frameOfReference:'Local services',competitors:[{name:'<script>alert(1)</script>',type:'indirect',source:'javascript:alert(1)',reasonToChoose:'Low cost'}],pointsOfDifference:[{claim:'Local support',proof:'',source:'Client interview'}],pointsOfParity:['Core service'],researchGaps:['Verify competitor service terms']};
 const payload={identity:{positioning:'Studio'},positioning};
 assert.deepEqual(fieldsToPayload(payloadToFields(payload),payload).positioning,positioning);
 const markup=renderToStaticMarkup(React.createElement(BioCompetitive,{value:positioning,editing:false}));
 assert.match(markup,/&lt;script&gt;/);assert.doesNotMatch(markup,/href="javascript:/);assert.match(markup,/checked these yet/);assert.match(markup,/Verify competitor service terms/);assert.equal(safeCompetitiveUrl('javascript:alert(1)'),null);
 assert.equal(discoFieldStatus({value:[{id:'empty',type:'direct',name:''}]}).kind,'missing');
 assert.equal(discoFieldStatus({value:positioning.competitors}).kind,'review');
 assert.equal(discoFieldStatus({value:positioning.competitors,mark:'accurate'}).kind,'accurate');
});

test('gated review shows actionable waiting reasons and score until checks pass',async t=>{
 const vite=await createServer({server:{middlewareMode:true,ws:false},appType:'custom'});t.after(()=>vite.close());
 const {ReviewGateNotice}=await vite.ssrLoadModule('/src/discovery-review-gate.jsx');
 const gate={status:'gated',score:79,min_score:80,reasons:[{code:'LOGO_RIGHTS_UNCONFIRMED'}]};
 const markup=renderToStaticMarkup(React.createElement(ReviewGateNotice,{gate}));
 assert.match(markup,/Waiting on: confirm logo rights/);assert.match(markup,/79% complete \(80% needed\)/);assert.match(markup,/automatically/);assert.match(markup,/role="status"/);
 assert.equal(renderToStaticMarkup(React.createElement(ReviewGateNotice,{gate:{...gate,status:'queued'}})),'');
 const source=await readFile(discoveryUrl,'utf8');assert.equal((source.match(/<ReviewGateNotice gate=\{live\.bio\?\.reviewGate\}/g)||[]).length,2);
 assert.match(source,/runFinished=\["completed","gated"\]/);
});
