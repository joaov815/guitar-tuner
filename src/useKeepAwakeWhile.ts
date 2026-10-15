import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef } from 'react';

const TAG = 'tuning';
/** How long to stay awake after the last note, so pauses between strings don't let the screen sleep. */
const GRACE_MS = 10_000;

/**
 * Keeps the screen on while `active` is true. Once it turns false and stays false for
 * GRACE_MS, the screen goes back to the system's own auto-lock timer.
 */
export function useKeepAwakeWhile(active: boolean) {
  // Activate only once per hold: on the web, a second activate would replace the
  // wake lock without releasing the first, keeping the screen on for good.
  const held = useRef(false);

  useEffect(() => {
    if (active) {
      if (!held.current) {
        held.current = true;
        activateKeepAwakeAsync(TAG).catch(() => {
          held.current = false;
        });
      }
      return;
    }
    const timer = setTimeout(() => {
      if (!held.current) return;
      held.current = false;
      deactivateKeepAwake(TAG).catch(() => {});
    }, GRACE_MS);
    return () => clearTimeout(timer);
  }, [active]);

  useEffect(
    () => () => {
      if (held.current) deactivateKeepAwake(TAG).catch(() => {});
    },
    [],
  );
}
