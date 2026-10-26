#!/usr/bin/env node
// Offline QuickJS profile preparation. Builds only a separate ring image;
// kernel sources, default image and native profiles remain unchanged.
import {writeFileSync,existsSync,chmodSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {helperSource,helperHash,bootstrapSource,fileHash} from '../../executor/prepared-helpers.mjs';
const [binary,output]=process.argv.slice(2);
if(!binary||!output)throw Error('usage: node prepare-helpers.mjs REAL_BINARY NEW_SNAPSHOT_BASE');
const base=resolve(output),kernel=fileURLToPath(new URL('../../kernel/',import.meta.url));
for(const ext of ['bin','mem','regs','layout','identity'])if(existsSync(base+'.'+ext))throw Error('snapshot already exists: '+base+'.'+ext);
const bootstrap=bootstrapSource;
const checkpoint='const repair=os.snapshotCheckpoint();';
if(bootstrap.split(checkpoint).length!==2)throw Error('expected one QuickJS checkpoint');
const script=bootstrap.replace(checkpoint,helperSource+'\n'+checkpoint);
writeFileSync(base+'.bootstrap.js',script);
const target=resolve(process.env.CARGO_TARGET_DIR??dirname(base)+'/helper-kernel-target');
const env={...process.env};
// This preparer is specifically the glue-2m JS profile. Ambient native argv or
// tenant resources must not override its checkpoint/helper bootstrap.
delete env.JITK_ARGV_JSON;delete env.JITK_RESOURCES;
execFileSync('cargo',['build','--locked','--offline','--release','--target','aarch64-unknown-none','--features','transport-ring'],{
 cwd:kernel,stdio:'inherit',env:{...env,JITK_SCRIPT:script,CARGO_TARGET_DIR:target,
 RUSTFLAGS:(process.env.RUSTFLAGS??'')+' -C link-arg=--defsym=__ring_arena=0x81800000'}
});
execFileSync(process.env.OBJCOPY??'llvm-objcopy',['-O','binary',target+'/aarch64-unknown-none/release/jitk-02',base+'.bin'],{stdio:'inherit'});
execFileSync(resolve(binary),['prepare',base+'.bin',base],{stdio:'inherit'});
const identity={version:1,helperSha256:helperHash,files:Object.fromEntries(['mem','regs','layout'].map(ext=>[ext,fileHash(base+'.'+ext)]))};
writeFileSync(base+'.identity',JSON.stringify(identity,null,2)+'\n',{flag:'wx'});chmodSync(base+'.identity',0o444);
console.log(JSON.stringify({event:'prepared-helpers',base,...identity}));
