import { WorkerEntrypoint } from "cloudflare:workers";

export default class CodeExecutor extends WorkerEntrypoint {
  async evaluate(__dispatchers = {}, __connectors = {}) {
    const __logs = [];
    console.log = (...a) => { __logs.push(a.map(String).join(" ")); };
    console.warn = (...a) => { __logs.push("[warn] " + a.map(String).join(" ")); };
    console.error = (...a) => { __logs.push("[error] " + a.map(String).join(" ")); };

    const __CODEMODE_BINARY_TAG = "__codemode_binary_v1__";
    function __bytesToBase64(bytes) {
      let binary = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.byteLength; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.byteLength)));
      }
      return btoa(binary);
    }
    function __base64ToBytes(b64) {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
    function __encodeCodemodeValue(value) {
      if (value instanceof Uint8Array) {
        return { [__CODEMODE_BINARY_TAG]: "Uint8Array", data: __bytesToBase64(value) };
      }
      if (value instanceof ArrayBuffer) {
        return { [__CODEMODE_BINARY_TAG]: "ArrayBuffer", data: __bytesToBase64(new Uint8Array(value)) };
      }
      if (ArrayBuffer.isView(value)) {
        return { [__CODEMODE_BINARY_TAG]: "ArrayBufferView", data: __bytesToBase64(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)) };
      }
      return value;
    }
    function __decodeCodemodeValue(value) {
      if (!value || typeof value !== "object" || !(__CODEMODE_BINARY_TAG in value) || typeof value.data !== "string") return value;
      const bytes = __base64ToBytes(value.data);
      if (value[__CODEMODE_BINARY_TAG] === "ArrayBuffer") {
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      }
      return bytes;
    }
    function __stringifyForCodemode(value) {
      return JSON.stringify(value, (_key, nested) => __encodeCodemodeValue(nested));
    }
    function __parseForCodemode(json) {
      return JSON.parse(json, (_key, nested) => __decodeCodemodeValue(nested));
    }

    const github = new Proxy({}, {
      get: (target, toolName) => {
        if (Object.prototype.hasOwnProperty.call(target, toolName)) return target[toolName];
        if (typeof toolName !== "string") return undefined;
        return async (...args) => {
          const resJson = await __dispatchers.github.call(String(toolName), __stringifyForCodemode(args));
          const data = __parseForCodemode(resJson);
          if (data.error) throw new Error(data.error);
          return data.result;
        };
      }
    });
github.local=()=>99;

    try {
      const result = await Promise.race([
        (
async () => {
const r = await github.listIssues({repo:'x'}); console.log('count',r.length); return r.length
}
)(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Execution timed out")), 1000))
      ]);
      return { result, logs: __logs };
    } catch (err) {
      return { result: undefined, error: err.message, logs: __logs };
    }
  }
}