// Reduced from Ajv's CommonJS `class Ajv extends core_1.default`.
const core = require('./base.cjs');
class Validator extends core.default {}
console.log(new Validator() instanceof core.default);
