import {JitkBackend} from './backend.js';
import {SandboxPool} from './pool.js';
import {MicroVMExecutor} from './executor.js';
import {requireArtifact} from '../tslib/deps.ts';
const backend=new JitkBackend(requireArtifact('JITK_VMM_BINARY'),{launcher:'01-vmm',image:String(process.env.JITK_KERNEL_IMAGE)});
const pool=new SandboxPool(backend,0,2);
const ex=new MicroVMExecutor(pool,()=> 'allow',5000);
try{console.log(JSON.stringify(await ex.execute('return await math.add(1,1)',[{name:'math',fns:{add:async(...a:unknown[])=>Number(a[0])+Number(a[1])}}])));}finally{await pool.close();process.exit(0);}
