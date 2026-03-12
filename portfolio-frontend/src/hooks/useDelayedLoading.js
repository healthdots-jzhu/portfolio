import { useEffect, useState, useRef } from 'react';

// Returns a boolean that becomes true only if `loading` stays true for `delayMs` milliseconds.
export default function useDelayedLoading(loading, delayMs = 500) {
  const [show, setShow] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (loading) {
      // start timer
      timerRef.current = setTimeout(() => setShow(true), delayMs);
    } else {
      // stop timer and hide immediately
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setShow(false);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [loading, delayMs]);

  return show;
}
