class Base { async park() { return 2; } }
class A extends Base { constructor() { super(); this.kind='a'; } }
class B extends Base { constructor() { super(); this.kind='b'; } }
function select(kind) {
  if(kind==='a')return {backend:new A()};
  return {backend:new B()};
}
console.log(select(process.argv[2]).backend.kind);
