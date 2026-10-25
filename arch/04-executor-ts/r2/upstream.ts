// No package-private paths: the MIT implementation is checked into vendor/.
import * as vendored from './vendor/codemode.mjs';
export const normalizeCode:(code:string)=>string=vendored.normalizeCode;
export const sanitizeToolName:(name:string)=>string=vendored.sanitizeToolName;
export const generateTypesFromJsonSchema:(tools:Record<string,unknown>)=>string=vendored.generateTypesFromJsonSchema;
