class Backend { async park():Promise<number> { return 42; } }
async function use(backend:any) { return await backend.park(); }
console.log(await use(new Backend()));
