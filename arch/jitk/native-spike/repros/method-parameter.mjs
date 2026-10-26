class Fake {
  constructor() { this.reap = undefined; }
  async park() { return {exited:new Promise(resolve=>this.reap=resolve)}; }
}
class Pool {
  constructor(backend) { this.backend=backend; }
  async acquire() { return await this.backend.park(); }
}
const fake = new Fake();
const pool = new Pool(fake);
console.log((await pool.acquire()).exited !== undefined);
