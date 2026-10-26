const modulePath = process.argv[2];
console.log(await import(modulePath));
