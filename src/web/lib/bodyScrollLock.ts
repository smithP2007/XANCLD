/**
 * bodyScrollLock.ts — refcounted body-scroll lock for modal/sheet components.
 *
 * PROBLEM: BottomSheet, OnboardingSheet, ConfirmDialog, and EpisodePickerSheet
 * all set `document.body.style.overflow = "hidden"` on open and restore `""`
 * on close. If two sheets overlap (e.g. ConfirmDialog opens over BottomSheet),
 * the inner sheet's cleanup restores `""` prematurely — unlocking background
 * scroll while the outer sheet is still visible.
 *
 * SOLUTION: refcount. lock() increments; unlock() decrements; body overflow
 * is set to "hidden" while count > 0 and restored to the original value when
 * count returns to 0. We also remember the ORIGINAL overflow value (not
 * assume it was "") so we don't clobber a value set by some other library.
 */

let lockCount = 0;
let originalOverflow: string | null = null;

export function lockBodyScroll(): void {
  if (typeof document === "undefined") return;
  if (lockCount === 0) {
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount++;
}

export function unlockBodyScroll(): void {
  if (typeof document === "undefined") return;
  if (lockCount === 0) return; // defensive — never go negative
  lockCount--;
  if (lockCount === 0) {
    document.body.style.overflow = originalOverflow ?? "";
    originalOverflow = null;
  }
}

/** For tests / debugging. */
export function getLockCount(): number {
  return lockCount;
}
