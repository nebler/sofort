function digit(input) {
  var code=input.charCodeAt(0), value=0;
  if (code>=48) value=code-48;
  return value;
}
console.log(digit('2'));
