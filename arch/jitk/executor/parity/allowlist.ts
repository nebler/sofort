// Documented backend differences (R10 #7). Each entry names one case, the
// backends that differ, the outcome they produce instead of the case's
// `expect`, the limit behind it (in the jitk-abi crate where one exists) and
// why. parity-check.ts fails on any difference not listed here, and on an
// entry whose difference no longer occurs.
import {IPC,ARENA_CLASSES} from '../abi.js';
import {LIMIT} from '../../protocol/dispatcher.js';
import type {Expect} from './cases.js';
import type {Engine} from '../engine.js';

export type Difference={
  case:string;
  backends:Engine['kind'][];
  expect:Expect;
  /** The limit: `abi <module>::<CONST>` (generated into executor/abi.ts) or another table. */
  limit:string;
  value?:number;
  reason:string;
};

export const ALLOWLIST:Difference[]=[
];
void IPC;void ARENA_CLASSES;void LIMIT;
