const shutdown = () => process.exit(0);
process.once('SIGINT',shutdown).once('SIGTERM',shutdown);
console.log('registered');
