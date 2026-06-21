import { useEffect, useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { useAuth } from "../../contexts/AuthContext";
import { motion } from "motion/react";

export function Layout() {
  const { userProfile, loading } = useAuth();
  const location = useLocation();
  const [viewportHeight, setViewportHeight] = useState('100dvh');
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!window.visualViewport) return;
    
    const updateViewport = () => {
      if (window.visualViewport) {
        setViewportHeight(`${window.visualViewport.height}px`);
        // On mobile devices, when the virtual keyboard is shown, visualViewport.height 
        // decreases while window.innerHeight might stay the same (or change depending on the OS/Browser).
        // By also checking screen.height we get a more robust relative measure across some viewports.
        const vh = window.innerHeight;
        // screen.height is unaffected by keyboard. Use it as a more stable reference.
        const isKb = window.visualViewport.height < window.screen.height * 0.75 || window.visualViewport.height < vh * 0.85;
        setIsKeyboardOpen(isKb);
      }
    };
    
    window.visualViewport.addEventListener('resize', updateViewport);
    window.visualViewport.addEventListener('scroll', updateViewport);
    updateViewport();
    
    return () => {
      if (window.visualViewport) {
         window.visualViewport.removeEventListener('resize', updateViewport);
         window.visualViewport.removeEventListener('scroll', updateViewport);
      }
    };
  }, []);

  useEffect(() => {
    let lastScrollY = window.pageYOffset || document.documentElement.scrollTop;
    let ticking = false;

    const updateScrollDirection = () => {
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;

      // Force visible at the top (under 10px from top) to ensure standard header resting state
      if (scrollY <= 10) {
        setIsVisible(true);
        lastScrollY = scrollY;
        ticking = false;
        return;
      }

      const threshold = 10;
      const diff = scrollY - lastScrollY;

      if (Math.abs(diff) >= threshold) {
        if (diff > 0) {
          // Scrolling down - hide header and navigation
          setIsVisible(false);
        } else {
          // Scrolling up - show header and navigation
          setIsVisible(true);
        }
        lastScrollY = scrollY;
      }
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScrollDirection);
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Ensure elements become visible instantly when changing pages
  useEffect(() => {
    setIsVisible(true);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-buildops-bg flex items-center justify-center">
        <motion.h1
          animate={{
            backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            backgroundImage: "linear-gradient(90deg, #080A0F 0%, #080A0F 35%, #3B82F6 45%, #22C55E 55%, #080A0F 65%, #080A0F 100%)",
            backgroundSize: "400% 100%",
          }}
          className="text-4xl md:text-5xl font-black text-transparent bg-clip-text tracking-tighter italic pr-2"
        >
          PROPLE
        </motion.h1>
      </div>
    );
  }

  const needsOnboarding = userProfile && userProfile.onboardingCompleted === false;

  if (needsOnboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  if (!needsOnboarding && location.pathname === '/onboarding') {
    return <Navigate to="/explore" replace />;
  }

  const isSettingsOrDashboard = location.pathname.startsWith('/settings');

  const hideHeader = location.pathname === '/onboarding' || location.pathname === '/search' || location.pathname === '/saved' || location.pathname.startsWith('/settings') || location.pathname === '/notifications' || location.pathname.startsWith('/problems') || location.pathname.includes('/new') || location.pathname.includes('/submit') || location.pathname.startsWith('/profile') || location.pathname === '/privacy-policy' || location.pathname === '/terms' || location.pathname === '/user-guidance';

  return (
    <div 
      className={`bg-buildops-bg flex flex-col ${!isKeyboardOpen ? 'pb-16 md:pb-0' : 'pb-4'} ${!hideHeader ? 'pt-14' : ''}`}
      style={{ minHeight: viewportHeight }}
    >
      {!hideHeader && <Header isVisible={isVisible} />}
      <main className={`flex-1 w-full mx-auto flex flex-col ${isSettingsOrDashboard ? '' : 'max-w-2xl sm:border-x sm:border-buildops-border/50'}`}>
        <Outlet />
      </main>
      {location.pathname !== '/onboarding' && !isKeyboardOpen && <BottomNav isVisible={isVisible} />}
    </div>
  );
}
