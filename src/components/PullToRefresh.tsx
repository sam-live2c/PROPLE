import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const stateRef = useRef({
    pulling: false,
    pullDistance: 0,
    startY: 0,
    startX: 0,
    refreshing: false,
    isSwipeCanceled: false
  });
  
  const threshold = 80; // Minimum pull distance to activate refresh

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // Only initiate pull-to-refresh if we're at the absolute top of the page
      if (window.scrollY === 0 && !stateRef.current.refreshing) {
        stateRef.current.startY = e.touches[0].clientY;
        stateRef.current.startX = e.touches[0].clientX;
        stateRef.current.pulling = true;
        stateRef.current.isSwipeCanceled = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!stateRef.current.pulling || window.scrollY > 0) return;
      if (stateRef.current.isSwipeCanceled) return;

      const y = e.touches[0].clientY;
      const x = e.touches[0].clientX;
      const distanceY = y - stateRef.current.startY;
      const distanceX = Math.abs(x - stateRef.current.startX);
      
      // If moving horizontally more than vertically, or scrolling up, cancel the pull action
      if ((distanceX > Math.abs(distanceY) && distanceX > 10) || distanceY < 0) {
        stateRef.current.isSwipeCanceled = true;
        return;
      }
      
      // Add a deadzone of 20px before starting to show the UI
      if (distanceY > 20) {
        // Prevent default scroll behavior when pulling down at the top
        if (e.cancelable) {
            e.preventDefault();
        }
        const pullAmount = distanceY - 20;
        const newDistance = Math.min(pullAmount * 0.4, threshold + 20); // apply resistance
        stateRef.current.pullDistance = newDistance;
        setPullDistance(newDistance);
      }
    };

    const handleTouchEnd = () => {
      if (!stateRef.current.pulling) return;
      stateRef.current.pulling = false;
      
      if (stateRef.current.pullDistance >= threshold && !stateRef.current.isSwipeCanceled) {
        stateRef.current.refreshing = true;
        setRefreshing(true);
        // Soft refresh without white flash
        setTimeout(() => {
            setRefreshKey(prev => prev + 1);
            
            setTimeout(() => {
                stateRef.current.refreshing = false;
                stateRef.current.pullDistance = 0;
                setRefreshing(false);
                setPullDistance(0);
            }, 500);
        }, 200);
      } else {
        stateRef.current.pullDistance = 0;
        setPullDistance(0);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const yTransform = refreshing ? threshold : pullDistance;
  const isPulling = stateRef.current.pulling;

  return (
    <div className="relative min-h-screen w-full">
      {/* Floating Animated Loader */}
      <div 
        className="fixed top-20 left-0 right-0 flex justify-center z-[100] pointer-events-none transition-opacity duration-300"
        style={{ 
          transform: `translateY(${yTransform > 0 ? yTransform - 40 : -100}px)`,
          transition: isPulling ? 'none' : 'transform 0.2s ease-out',
          opacity: yTransform > 0 ? 1 : 0
        }}
      >
        <div className="bg-buildops-card border border-buildops-border rounded-full p-2 shadow-lg flex items-center justify-center">
            <Loader2 className={`w-6 h-6 text-buildops-blue ${refreshing ? 'animate-spin [animation-duration:400ms]' : ''}`} 
                     style={{ transform: refreshing ? 'none' : `rotate(${pullDistance * 4}deg)` }} />
        </div>
      </div>
      
      {/* Content wrapper */}
      <div key={refreshKey} className="relative z-10 bg-buildops-bg">
        {children}
      </div>
    </div>
  );
}
