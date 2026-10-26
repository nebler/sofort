// JSON schema as plain data, without a validator dependency.
const schema = {type:'object',properties:{code:{type:'string'}},required:['code'],additionalProperties:false};
console.log(JSON.stringify(schema));
