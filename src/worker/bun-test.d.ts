// Minimal ambient declaration for the "bun:test" module so `tsc --noEmit`
// typechecks worker.test.ts without pulling the full bun-types package
// (bun-types' globals collide with @cloudflare/workers-types).
// The test itself runs on the real bun runtime, which implements this API.
declare module "bun:test" {
  export const describe: (name: string, fn: () => void) => void;
  export const test: (name: string, fn: () => void | Promise<void>) => void;
  export const it: (name: string, fn: () => void | Promise<void>) => void;
  export const expect: (actual: unknown) => {
    toBe: (expected: unknown) => void;
    toEqual: (expected: unknown) => void;
    toStrictEqual: (expected: unknown) => void;
    toBeNull: () => void;
    toBeTruthy: () => void;
    toBeFalsy: () => void;
  };
}
