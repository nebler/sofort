// Supplemental diagnostic, deliberately NOT counted as a corpus program.
// Keep enough same-size objects live to cross scr_alloc's 1 MiB pre-fault
// threshold and force its optional pthread_create path on Linux musl.
interface Cell { n: number; tag: number }
const cells: Cell[] = [];
for (let i = 0; i < 400000; i++) cells.push({ n: i, tag: 1 });
let total = 0;
for (const cell of cells) total += cell.n;
console.log(cells.length, total);
