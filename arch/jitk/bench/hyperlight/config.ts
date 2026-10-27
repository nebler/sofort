import {existsSync} from 'node:fs';
import {platform} from 'node:os';
import {resolve} from 'node:path';
import {artifactPath,requireArtifact} from '../../tslib/deps.ts';
// Selection: HYPERLIGHT_WORKER/HYPERLIGHT_SNAPSHOT, else outputs under an
// explicit HYPERLIGHT_BUILD_DIR, else the `make -C arch/jitk deps` cache.
export function hyperlightConfig() {
  const build=process.env.HYPERLIGHT_BUILD_DIR;
  return {worker:resolve(process.env.HYPERLIGHT_WORKER??(build?resolve(build,'target/release/r2-worker'):artifactPath('HYPERLIGHT_WORKER'))),
    snapshot:resolve(process.env.HYPERLIGHT_SNAPSHOT??(build?resolve(build,'snapshot'):artifactPath('HYPERLIGHT_SNAPSHOT')))};
}
// The only skip is off macOS: this baseline is Hypervisor.framework only.
export function testPrerequisite():string|undefined {
  if(platform()!=='darwin')return 'Hyperlight HVF baseline is macOS-only';
  const src=requireArtifact('HYPERLIGHT_JS_SRC');
  if(!existsSync(resolve(src,'src/hyperlight-js/Cargo.toml')))
    throw Error('HYPERLIGHT_JS_SRC must contain src/hyperlight-js/Cargo.toml');
  const {worker,snapshot}=hyperlightConfig();
  if(!existsSync(worker)||!existsSync(resolve(snapshot,'index.json')))
    throw Error('Hyperlight worker/snapshot missing ('+worker+', '+snapshot+'); run `make -C arch/jitk deps` or set HYPERLIGHT_WORKER and HYPERLIGHT_SNAPSHOT');
}
