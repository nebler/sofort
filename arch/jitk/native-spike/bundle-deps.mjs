// Workaround trial: tree-shake each representative API, including npm dependencies.
import {build} from 'esbuild';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
process.chdir(dirname(fileURLToPath(import.meta.url)));
for(const name of process.argv.slice(2)) {
  await build({entryPoints:[`repros/${name}.ts`],outfile:`.work/bundled-deps/${name}.mjs`,bundle:true,platform:'node',format:'esm',target:'node24'});
  console.log('Bundled '+name);
}
