async () => {
  globalThis.__benchLeak = 'hostile';
  Object.prototype.__benchLeak = 'hostile';
  Array.prototype.__benchLeak = 'hostile';
  JSON.stringify = () => 'hostile';
  return 'polluted';
}
