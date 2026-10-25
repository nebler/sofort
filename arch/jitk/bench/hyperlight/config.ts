import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
export function hyperlightConfig() {
  const build=resolve(process.env.HYPERLIGHT_BUILD_DIR??resolve(root,'build'));
  return {worker:resolve(process.env.HYPERLIGHT_WORKER??resolve(build,'target/release/r2-worker')),
    snapshot:resolve(process.env.HYPERLIGHT_SNAPSHOT??resolve(build,'snapshot'))};
}
export function testPrerequisite():string|undefined {
  const src=process.env.HYPERLIGHT_JS_SRC;
  if(!src)return 'HYPERLIGHT_JS_SRC is unset; set it to the pinned Hyperlight JS checkout and run make build';
  if(!existsSync(resolve(src,'src/hyperlight-js/Cargo.toml')))
    throw Error('HYPERLIGHT_JS_SRC must contain src/hyperlight-js/Cargo.toml');
  const {worker,snapshot}=hyperlightConfig();
  if(!existsSync(worker)||!existsSync(resolve(snapshot,'index.json')))
    throw Error('Hyperlight worker/snapshot missing; run make build or set HYPERLIGHT_WORKER and HYPERLIGHT_SNAPSHOT');
}
