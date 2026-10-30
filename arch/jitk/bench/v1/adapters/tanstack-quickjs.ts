import {localAdapter, provenance} from './common.ts';
import {openDriver} from './tanstack.ts';
export default localAdapter({
  name:'tanstack-quickjs',isolation:'wasm',where:'local',
  provenance:()=>provenance(['@tanstack/ai-code-mode','@tanstack/ai-isolate-quickjs','quickjs-emscripten']),
  async open({concurrency,timeoutMs}) {const {createQuickJSIsolateDriver}=await import('@tanstack/ai-isolate-quickjs');return openDriver(createQuickJSIsolateDriver(),concurrency,timeoutMs);}
});
