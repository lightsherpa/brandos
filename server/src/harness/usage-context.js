// Attribution for api_usage rows written during a task (run id, workspace,
// brand, actor). Set once per task with runWithUsage(); read by llm.js and
// images.js so every text and image call is attributed to the task's run.
import { AsyncLocalStorage } from "node:async_hooks";
const store = new AsyncLocalStorage();
export const runWithUsage = (ctx, fn) => store.run(ctx, fn);
export const usageContext = () => store.getStore() || {};
