# BrandOS as a harness

Source: OpenAI, "Harness engineering" (Feb 11, 2026).
Their idea: humans steer, agents execute. The work is designing the environment, the intent and the feedback loops, not doing the task by hand.
For us: the designer steers, Brandolph and the specialists execute, and the brand profile (BIO) is the system of record.

## What we borrow, and what it means for BrandOS
| Harness principle | BrandOS translation | Today | Gap |
|---|---|---|---|
| Give the agent a map, not a manual | Each agent gets a **context contract**: the BIO slices it needs and pointers to more, never the whole BIO. Copy agents get voice, audience and the never-say list; image agents get palette, type and image rules | Copy agents get only voice; some get generic department prompts | Write one contract per agent |
| Repo is the system of record | The **BIO is the system of record**: versioned, sourced, certified. Anything not in the BIO doesn't exist for agents | BIO versions, provenance and certification exist | Rules and examples aren't stored as data yet |
| Execution plans as artifacts | Brandolph writes a **run plan** per brief: goal, message spec, crew, order and checks. It's versioned and visible to the user | Sharpener picks the crew; at most 3 agents, and no visible plan | Plan object and UI |
| Enforce invariants mechanically, with fix-it messages | **Brand checks** run on every output: forbidden words, claims, palette, contrast, logo use, format. Every failure returns a fix instruction to the agent | Voice and image QA exist but are defined three ways | One check registry, deterministic first, then a model judge |
| Loop until the reviewers pass | **Self-correction loop**: agent, then checks, then fix, up to N passes, before any human sees it | None | Loop in the runs route |
| Make the app legible to the agent | Agents and checkers **see the rendered output** (screenshots of email, landing page and deck), not just text | Image QA only | Render, then vision check |
| Human taste captured once, enforced continuously | **Designer corrections become rules or examples**, then BIO change proposals that a human approves | Signals are logged but only shape crew choice | Learning loop |
| Garbage collection | A recurring **brand gardener** flags stale BIO fields, weak agents and rules that conflict | None | Scheduled job |
| Escalate only when judgment is needed | Humans see only check-passed output; **Creative Director certifies**, and only judgment calls are escalated | Certification only covers the BIO | Certification per output |
| Observability | One **trace per run**: plan, each agent call, model, cost, check results, loops and verdict | Partial logs | Run trace table and view |

## Architecture (8 layers)
1. **Memory:** BIO, rules, approved examples, signals. Postgres, plus pgvector for examples.
2. **Planner:** Brandolph turns a brief into a run plan and message spec.
3. **Router:** each task goes to the best model (text, image, vision, research); see the model plan.
4. **Workers:** 55 specialists, each with a context contract and an output schema.
5. **Checks:** a registry of deterministic checks plus a model judge, returning remediation text.
6. **Loop:** fix until the checks pass, with a pass and cost budget.
7. **Human gate:** client approves, Creative Director certifies, certificate issued.
8. **Learning:** corrections become rules or examples, then BIO proposals; the gardener runs on a schedule.

## The demo on Oct 21 (one flow)
Certified brand → brief → **Brandolph's plan appears** (crew, order, checks) → crew runs live → **a check catches an off-brand word or color and the agent fixes it on screen** → email, landing page and deck from one message spec → Creative Director stamps the seal → **the correction becomes a rule**, and the next run obeys it.
That last step is the "unprecedented" moment: a brand brain that learns from its designer.

## Roadmap to the 21st (freeze Fri Oct 16)
| Day | Me (CTO) | Ada (agents) | Maya (product/UX) | Oscar + Claude/Codex |
|---|---|---|---|---|
| Sun 11 | Architecture signed off; break down tasks | Context contracts and checks for the hero crew | Hero flow v0 around this story | Commit/push self-cert work; review PR #4 |
| Mon 12 | Run plan and check-registry specs for Codex | Prompt rewrites for the hero crew; golden briefs | UX for the plan, live checks and seal screens | Merge self-cert onto rc; merge PR #4 |
| Tue 13 | Loop and trace spec; review pushes | Remediation messages for each check | Final hero flow (step by step) | Build the run plan and check loop |
| Wed 14 | Go/no-go on the preview | Blind test with Rana and Diana; switch models for the hero crew | Usability pass | Build the correction-to-rule step; UI v2 hero screens |
| Thu 15 | Certified demo brand in production; Render always-on | Lock prompts | Rehearsal 1 feedback | Bug fixes |
| Fri 16 | **Code freeze** | — | Deck aligned with the demo | — |
| Sat 17–Sun 18 | Rehearsals on a phone hotspot | Re-score | — | Fixes only |
| Mon 19 | Replay mode and fallback video | — | — | — |
| Tue 20 | Go/no-go 09:00 | — | — | — |

## After VDS (November)
Roll context contracts and checks out to all 55 agents; certification per output; approved-example memory; brand gardener; run traces in the UI; Brandfetch; Canva and Figma.

## Decisions for Oscar
1. Agree the demo story above, especially the live self-correction plus learning moment.
2. Limit the loop to 2 fix passes per output in the demo, for cost and speed.
