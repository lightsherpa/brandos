# Correction → rule learning
Flow: designer edits/annotates an output at the human gate → `correction` stored → Rule Miner (model) proposes `candidate_rule` → validation (deterministic replay + regression) → Steward/CD approves → BIO rule (new BIO minor version) → compiled into check registry (+ context slices) → next run obeys.

## Schemas
```json
{"$id":"correction.v0","type":"object","required":["correction_id","run_id","output_id","agent_id","designer_id","kind","before","after","ts"],
 "properties":{"correction_id":{"type":"string"},"run_id":{"type":"string"},"output_id":{"type":"string"},"agent_id":{"type":"string"},"designer_id":{"type":"string"},
  "kind":{"enum":["text_edit","word_ban","replace","tone_note","visual_note","reject"]},
  "before":{"type":"string"},"after":{"type":"string"},"location":{"type":"string"},"comment":{"type":"string","maxLength":500},"ts":{"type":"string"}}}
```
```json
{"$id":"candidate_rule.v0","type":"object","required":["rule_id","source_corrections","type","scope","statement","enforcement","examples","status"],
 "properties":{"rule_id":{"type":"string"},"source_corrections":{"type":"array","items":{"type":"string"}},
  "type":{"enum":["forbidden_word","preferred_term","pattern_ban","style_rule","visual_rule","example_good","example_bad"]},
  "scope":{"type":"object","properties":{"departments":{"type":"array","items":{"type":"string"}},"agents":{"type":"array","items":{"type":"string"}},"languages":{"type":"array","items":{"type":"string"}},"channels":{"type":"array","items":{"type":"string"}}}},
  "statement":{"type":"string","maxLength":200,"description":"human-readable, shown in BIO"},
  "enforcement":{"type":"object","required":["mode"],"properties":{"mode":{"enum":["deterministic","judge","context_only"]},
    "terms":{"type":"array","items":{"type":"string"}},"regex":{"type":"string"},"replacement_hint":{"type":"string"},"judge_rubric":{"type":"string"},"palette_hex":{"type":"array","items":{"type":"string"}}}},
  "examples":{"type":"object","properties":{"bad":{"type":"array","items":{"type":"string"}},"good":{"type":"array","items":{"type":"string"}}}},
  "conflicts_with":{"type":"array","items":{"type":"string"}},
  "validation":{"type":"object","properties":{"replay_caught_original":{"type":"boolean"},"false_positive_rate":{"type":"number"},"regression_runs":{"type":"integer"},"golden_score_delta":{"type":"number"}}},
  "status":{"enum":["proposed","validated","approved","rejected","retired"]},"approved_by":{"type":"string"},"bio_version":{"type":"integer"}}}
```
## Rule Miner prompt (Sonnet 5.5)
```
You turn a designer's correction into at most ONE reusable brand rule, or none.
Input: correction (before/after/comment), agent contract, current BIO rules (id, statement, enforcement), brand voice slice.
1. Decide if this is a reusable preference (would apply to future outputs) or a one-off fix for this brief. If one-off, return {"rule":null,"reason":"..."}.
2. Prefer the most mechanical enforcement that captures it: forbidden_word / preferred_term / pattern_ban (deterministic) > visual_rule with palette/ratio (deterministic) > style_rule (judge rubric, ≤2 sentences) > example_good/bad (context only).
3. Scope narrowly: the channels/languages/agents the evidence supports. Never generalise one correction to all languages.
4. Check conflicts with existing rules; list conflicting rule ids instead of overriding them.
5. Write statement in the brand's terms ("We say 'filtro', never 'drip'"). Include the correction as bad/good example.
Return candidate_rule JSON only.
```
## Validation (automatic, before a human sees it)
1. **Replay:** run the new check on the original `before` → must FAIL; on `after` → must PASS.
2. **False positives:** run on the last 50 certified outputs of the brand → FP rate ≤5% (deterministic) / ≤10% (judge). Show offending examples.
3. **Conflicts:** none unresolved with active rules.
4. **Regression (optional, prod):** golden briefs for the brand, score delta ≥0.
→ status `validated` → card to Steward/Creative Director: statement, evidence, FP examples → Approve / Edit / Reject.
## Promotion
Approve → write to `bio.rules[]` (new BIO version, provenance = correction ids + approver) → compiler: deterministic rules extend D-FORBID / D-REFUSAL term lists or create `R-<id>` checks; style rules become judge rubric lines in J-VOICE; examples go to `bio.voice.examples` / pgvector. Context contracts automatically include rules whose scope matches the agent.
## Demo (Oct 21, 1 step)
CD replaces "drip" with "filtro" in a caption → Rule Miner proposes forbidden_word {terms:["drip"],replacement_hint:"filtro",scope:{languages:["es"],departments:["Copy"]}} → replay passes (shown) → CD clicks Approve → re-run a16 → D-FORBID catches "drip" in pass 0 if produced, fix in pass 1, or it's simply absent because the rule is in context. Pre-approve in rehearsal on a copy of the brand to avoid live DB risk; demo on a fresh brand version.
## Brand gardener (post-VDS, weekly)
Flags rules with 0 hits in 90 days, rules with FP complaints, conflicting rules, BIO fields older than N months, agents with falling scores.
