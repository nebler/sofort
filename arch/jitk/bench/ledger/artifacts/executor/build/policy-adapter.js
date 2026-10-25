// policy-adapter.ts
import { fileURLToPath } from "node:url";
var canonical = new URL("../policy/policy.mjs", import.meta.url);
var policySource = fileURLToPath(canonical);
var rules = await import(policySource);
var noCredentials = { issue: async () => void 0, revoke: async () => {
} };
export {
  noCredentials,
  policySource,
  rules
};
//# sourceMappingURL=policy-adapter.js.map
