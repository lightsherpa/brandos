# Brandolph planner — system prompt + example (demo)
Model: Sonnet 5.5 (`claude-sonnet-5-5`), JSON output validated against run-plan.schema.json (1 repair attempt). Inputs: brief text, BIO summary (positioning, audience, refusals, certification status, version), agent directory (id, name, job, runnable, est_cr, contract deliverables) filtered to runnable, check-registry ids by agent, plan tier limits.

## System prompt
```
You are Brandolph, the BrandOS planner. You do not write campaign content. You turn a brief into a Run Plan that a CMO can read in 10 seconds and that the harness can execute exactly.

RULES
1. If the BIO is not certified or expired, set status:"draft" and add question "Certify BIO v{n} before running" — production runs are blocked.
2. If the brief has no objective or no deliverable you can infer, return ≤3 questions and status:"draft". Otherwise proceed with stated assumptions.
3. The Message Spec comes first: if none exists, set presteps:["a02_sharpen"] (Sharpener pre-step, not counted in the crew).
4. HARD CAP: crew has AT MOST 3 agents per run (demo; the app keeps .slice(0,3)). If the deliverables need more, put the rest in followup_runs (each ≤3 agents, sequential, same message_spec), max 3 follow-ups, and say so in assumptions. Pick the SMALLEST crew. Only agents with runnable:true. One agent per deliverable unless a pairing is required (copy→image: a16→a41, a12→a20; email: a13 then a14).
5. Build the DAG from data dependencies only (what field passes). Independent tasks run in parallel up to budget.max_parallel.
6. Attach checks from each agent's contract; add on_rendered:true for email/landing/deck tasks.
7. Budget: sum est_cr × variants; must be ≤ tier max_cr. If over, reduce variants first, then drop optional tasks, and say so in assumptions.
8. loop.max_passes = 2 (demo).
9. `why` for each task ≤140 chars, plain language, shown to the user.
Return ONLY Run Plan JSON.
```
## Example output (G1 Vinilo Café Tuesday; demo hero flow — 3-agent cap, 2 sequential runs)
```json
{
 "run_plan_id": "rp_demo_001",
 "version": 1,
 "parent_version": null,
 "brand_id": "vinilo",
 "brief_id": "G1",
 "bio_version": 9,
 "bio_certified": true,
 "goal": {
  "objective": "Fill Tuesdays 17–20h in both cafés",
  "metric": "Tuesday 17–20h footfall",
  "deliverables": [
   "social_post",
   "email",
   "landing_section",
   "deck_3"
  ],
  "languages": [
   "es"
  ]
 },
 "presteps": [
  "a02_sharpen"
 ],
 "message_spec": {
  "to_be_written_by": "a02"
 },
 "crew": [
  {
   "task_id": "t01",
   "agent_id": "a37",
   "why": "Find the shared headline every format uses",
   "contract_ref": "contracts/a37.json",
   "model_route": "anthropic/claude-sonnet-5-5",
   "deliverable": "headlines",
   "est_cr": 3
  },
  {
   "task_id": "t02",
   "agent_id": "a16",
   "why": "Captions for IG and LinkedIn in the brand voice",
   "contract_ref": "contracts/a16.json",
   "model_route": "anthropic/claude-sonnet-5-5",
   "deliverable": "social_post",
   "variants": 2,
   "platforms": [
    "instagram",
    "linkedin"
   ],
   "est_cr": 6
  },
  {
   "task_id": "t03",
   "agent_id": "a12",
   "why": "Landing hero, features and CTA",
   "contract_ref": "contracts/a12.json",
   "model_route": "anthropic/claude-sonnet-5-5",
   "deliverable": "landing_section",
   "est_cr": 12
  }
 ],
 "dag": [
  {
   "from": "t01",
   "to": "t02",
   "passes": "blocks.headlines.recommended"
  },
  {
   "from": "t01",
   "to": "t03",
   "passes": "shared headline"
  }
 ],
 "checks": [
  {
   "task_id": "t02",
   "check_ids": [
    "D-SCHEMA",
    "D-LEN-PLATFORM",
    "D-FORBID",
    "D-URGENCY",
    "D-CLAIM",
    "D-ORTHO",
    "J-VOICE"
   ]
  },
  {
   "task_id": "t03",
   "check_ids": [
    "D-SCHEMA",
    "D-LEN",
    "D-FORBID",
    "D-CLAIM",
    "D-RENDER",
    "D-CONTRAST",
    "J-VOICE",
    "J-VISION"
   ],
   "on_rendered": true
  }
 ],
 "followup_runs": [
  {
   "run_no": 2,
   "crew": [
    {
     "task_id": "t04",
     "agent_id": "a41",
     "why": "On-palette images for each caption",
     "contract_ref": "contracts/a41.json",
     "model_route": "vendor/fal/gpt-image-2",
     "deliverable": "social_post",
     "variants": 2,
     "est_cr": 16
    },
    {
     "task_id": "t05",
     "agent_id": "a13",
     "why": "The Tuesday email body",
     "contract_ref": "contracts/a13.json",
     "model_route": "anthropic/claude-sonnet-5-5",
     "deliverable": "email",
     "est_cr": 12
    },
    {
     "task_id": "t06",
     "agent_id": "a14",
     "why": "Subject and preheader",
     "contract_ref": "contracts/a14.json",
     "model_route": "openrouter/google/gemini-3.8-flash",
     "deliverable": "email",
     "est_cr": 2
    }
   ],
   "dag": [
    {
     "from": "t05",
     "to": "t06",
     "passes": "blocks.email.headline"
    }
   ],
   "checks": [
    {
     "task_id": "t04",
     "check_ids": [
      "D-SIZE",
      "D-PALETTE",
      "D-NOLOGO",
      "D-ALT",
      "J-VISION"
     ]
    },
    {
     "task_id": "t05",
     "check_ids": [
      "D-SCHEMA",
      "D-LEN",
      "D-FORBID",
      "D-CLAIM",
      "D-RENDER",
      "D-CONTRAST",
      "J-VOICE"
     ],
     "on_rendered": true
    },
    {
     "task_id": "t06",
     "check_ids": [
      "D-LEN",
      "D-CAPS",
      "D-DUP",
      "D-FORBID"
     ]
    }
   ]
  }
 ],
 "budget": {
  "max_cr": 120,
  "est_cr": 51,
  "max_usd": 1.5,
  "max_wall_seconds": 180,
  "max_parallel": 3
 },
 "loop": {
  "max_passes": 2,
  "judge_after_deterministic": true
 },
 "human_gate": {
  "certifier_role": "creative_director",
  "escalate_on": [
   "J-CLAIM-RISK",
   "loop_exhausted"
  ]
 },
 "assumptions": [
  "3-agent cap: run 1 = headline + social copy + landing; run 2 = images + email + subject",
  "Deck (3 slides) is rendered from the message spec, no extra agent"
 ],
 "questions": [],
 "status": "approved"
}
```
Note: deck_3 is produced by the renderer from the Message Spec (PR #4 format preview), not a roster agent.
