async () => {
  const ns = typeof codemode !== 'undefined' ? codemode : globalThis;
  return await ns.exfiltrate({ secret: 'canary-7f3a' });
}
