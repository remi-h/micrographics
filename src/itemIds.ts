import type { CanvasItem } from './types';

// Canvas item ids.
//
// Every operation in the editor — select, move, scale, delete, persist — finds
// its item by id, and React keys the canvas and the layer list by id too, so
// two items sharing one id is not a cosmetic problem: the wrong item moves or
// disappears. Ids used to be `${kind}-${Date.now()}`, which collides whenever
// two items are created inside the same millisecond (a held-down paste, a fast
// double-click, an automated test, a duplicate right after a paste).
//
// An id here is `${kind}-${sessionToken}-${sequence}`:
//
//   - `sequence` is a module-level counter, so two ids minted in the same tick
//     — indeed in the same session at all — always differ. No clock involved.
//   - `sessionToken` is random, drawn once when this module is first
//     evaluated, so a counter that restarts at 1 on the next page load cannot
//     re-mint an id that a *restored* item from an earlier session already
//     holds: that item's id carries the earlier session's token. The same
//     property keeps two tabs of the editor apart.
//   - `kind` is only there to keep ids readable while debugging; uniqueness
//     does not depend on it. It does, however, mean a generated id can never
//     equal a template id, since templates hardcode ids prefixed with their
//     template number (`001-tag`, `007-pin-01`, `008-reg-tl`) and neither
//     `symbol` nor `text` is a template number.
//
// Ids are opaque strings, stable once assigned: nothing parses them, and
// persistence round-trips them as-is.

// 96 bits of randomness: far more than enough that two sessions never draw the
// same token, while keeping the id short enough to read in a debugger.
const TOKEN_BYTES = 12;

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// `crypto.randomUUID` only exists in a secure context, and jsdom (the Jest
// environment) does not implement it at all, so it cannot be the only source.
// `crypto.getRandomValues` is the wider fallback — jsdom has it — and the last
// resort covers an environment with no Web Crypto whatsoever. Uniqueness of a
// single session's ids never rests on this value, only the separation between
// one session and the next, so a weaker source degrades rather than breaks.
function randomToken(): string {
  const webCrypto: Crypto | undefined = globalThis.crypto;

  if (webCrypto) {
    if (typeof webCrypto.randomUUID === 'function') {
      return webCrypto.randomUUID().replace(/-/g, '');
    }
    if (typeof webCrypto.getRandomValues === 'function') {
      return hex(webCrypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
    }
  }

  // Math.random plus the clock: two sessions a millisecond apart still differ.
  let token = Date.now().toString(36);
  while (token.length < TOKEN_BYTES * 2) token += Math.random().toString(36).slice(2);
  return token.slice(0, TOKEN_BYTES * 2);
}

const sessionToken = randomToken();
let sequence = 0;

/** Mints an id no other canvas item can hold. See the note at the top of this file. */
export function createItemId(kind: CanvasItem['kind']): string {
  sequence += 1;
  return `${kind}-${sessionToken}-${sequence.toString(36)}`;
}

/**
 * Mints a group id, from the same counter as item ids so a group id can never
 * equal an item id either. Group ids are compared, never parsed, and are
 * round-tripped by persistence exactly as item ids are.
 */
export function createGroupId(): string {
  sequence += 1;
  return `group-${sessionToken}-${sequence.toString(36)}`;
}
