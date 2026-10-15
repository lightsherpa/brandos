# Model, limits and cost
| Item | Value |
|---|---|
| Primary | `anthropic/claude-sonnet-5-5` (direct route; OpenRouter `anthropic/claude-sonnet-5.5`) — per `agents-plan/anthropic-model-ids.md` |
| Fallback | `anthropic/claude-sonnet-4-6` (via existing `server/src/lib/models/fallback.js`: before first token on 429/5xx/404/network/20s) |
| Not used | Opus (2× credits, no gain on read-and-cite); Haiku (citation fidelity too weak for what the CD sees) |
| Temperature | 0.2 (if the adapter rejects temperature on 5.x, omit it and set `effort: "medium"`) |
| Thinking | do NOT send `thinking.budget_tokens` (rejected after 4.6); `effort: "medium"` |
| Output | forced tool call `submit_brief` (tool_choice), `max_tokens` 8000 full / 2000 single_claim |
| Input budget | ≤60k tokens; over budget → chunk, model uses `search_sources` |
| Timeouts | 20s first token (→ fallback), 90s total full, 30s single_claim |
| Tool loop | max 6 read-tool calls per run, then forced `submit_brief` |
| Prompt caching | cache_control on system + serialized sources (reused by repair pass and single-claim runs) |

## Cost ($2 / $10 per MTok)
| Run | Input | Output | Cost |
|---|---|---|---|
| Full brief | ~40k | ~6k | ≈ $0.14 |
| Repair pass (cached input ~5–10%) | ~40k cached + 3k | ~3k | ≈ $0.04 |
| Single-claim re-draft | ~8k | ~1k | ≈ $0.03 |
| **Cap per certification** | | | **$0.30** hard (token-budget.js abort) |

Credits: route multiplier 1× (`routeCreditMultiplier`). ≈ 14 credits/full brief at the assumed 1 credit ≈ $0.01 (rate still unconfirmed by Oscar). Billed to the workspace as an internal steward cost, not to the client.
