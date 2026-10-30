import {localAdapter, provenance} from './common.ts';
import {openDriver} from './tanstack.ts';
export default localAdapter({
  name:'tanstack-isolated-vm',isolation:'v8-isolate',where:'local',
  provenance:()=>provenance(['@tanstack/ai-code-mode','@tanstack/ai-isolate-node','isolated-vm']),
  async open({concurrency,timeoutMs}) {const {createNodeIsolateDriver}=await import(String('@tanstack/ai-isolate-node'));return openDriver(createNodeIsolateDriver(),concurrency,timeoutMs);}
});
