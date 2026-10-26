interface OptionalMethod {arm?(n:number):Promise<void>}
class Owner implements OptionalMethod {value=0;async arm(n:number):Promise<void>{this.value=n;console.log(this.value);}}
const owner:OptionalMethod=new Owner();
await owner.arm!(7);
