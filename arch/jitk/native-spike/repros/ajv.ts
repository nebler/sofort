import Ajv from 'ajv';
const validate = new Ajv().compile({type:'object',properties:{n:{type:'number'}},required:['n']});
console.log(validate({n:2}));
