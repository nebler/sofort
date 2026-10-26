const code = process.argv[2] || 'return 2';
console.log(new Function(code)());
