// Typed port of executor/policy/policy.mjs; differential owner tests in test.mjs.
import * as rules from './policy.js';
export {rules};
export type {Tool,Issuer,PolicyConfig} from './types.js';
export const noCredentials={issue:async():Promise<any>=>null,revoke:async():Promise<void>=>{}};

export const policySource=new URL('./policy.mjs',import.meta.url).pathname;
