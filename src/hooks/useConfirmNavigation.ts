import { useBlocker } from 'react-router-dom';
import { useEffect, useRef } from 'react';

export function useConfirmNavigation(isDirty: boolean) {
  const hasWarnedRef = useRef(false);

  // Handle router navigation
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => {
      if (isDirty && !hasWarnedRef.current && currentLocation.pathname !== nextLocation.pathname) {
          return true;
      }
      return false;
    }
  );

  useEffect(() => {
     if (blocker.state === 'blocked') {
        hasWarnedRef.current = true;
     }
  }, [blocker.state]);

  // Handle browser close/reload
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty && !hasWarnedRef.current) {
        hasWarnedRef.current = true; // Mark as warned for next time, though beforeunload usually handles this
        event.preventDefault();
        event.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  return blocker;
}
