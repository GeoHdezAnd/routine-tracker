import { useEffect } from "react";

let lockCount = 0;
let savedScrollY = 0;

/**
 * Locks page scroll while a full-screen modal/sheet is mounted. Beyond hiding
 * overflow, this pins the body with `position: fixed` and restores the scroll
 * offset on unlock — plain `overflow: hidden` doesn't stop touch scroll from
 * bleeding through a `fixed inset-0` overlay on iOS Safari, which is what let
 * the background list scroll behind the sheet and jam up in production.
 * Reference-counted so stacked modals don't unlock the page while one is still open.
 *
 * Pass `enabled` for components that stay mounted and toggle visibility via a
 * prop (e.g. `ConfirmDialog`'s `open`) instead of being mounted/unmounted —
 * the lock must track that prop, not just mount/unmount.
 */
export function useLockBodyScroll(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    if (lockCount === 0) {
      savedScrollY = window.scrollY;
      document.body.classList.add("modal-open");
      document.body.style.position = "fixed";
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.width = "100%";
    }
    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.body.classList.remove("modal-open");
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        window.scrollTo(0, savedScrollY);
      }
    };
  }, [enabled]);
}
