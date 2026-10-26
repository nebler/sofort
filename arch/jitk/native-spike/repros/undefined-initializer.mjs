// Reduced from acorn/dist/acorn.mjs readInt's local `val` initialization.
function digit(input) {
  var code=input.charCodeAt(0), value=(void 0);
  if (code>=48) value=code-48;
  return value;
}
console.log(digit('2'));
