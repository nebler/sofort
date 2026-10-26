process.once('SIGTERM',()=>{ console.log('PASS SIGTERM'); process.exit(0); });
console.log('ready');
setInterval(()=>{},1000);
