// Compile-only proof that generated namespace declarations preserve input and
// output types and don't collide across providers with equal method names.
async function proveGeneratedTypes() {
  const issues=await github.listIssues({repo:'x'});
  const n:number=issues[0]!.id;
  await gitlab.listIssues({repo:'y'});
  // @ts-expect-error generated input requires a string
  await github.listIssues({repo:42});
  // @ts-expect-error generated output id is a number
  const s:string=issues[0]!.id;
  return n;
}
void proveGeneratedTypes;
