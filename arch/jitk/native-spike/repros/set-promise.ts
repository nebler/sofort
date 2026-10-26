const pending = new Set<Promise<void>>();
const task = Promise.resolve();
pending.add(task);
await Promise.all([...pending]);
console.log(pending.size);
