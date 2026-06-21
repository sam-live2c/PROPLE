import { Link, NavLink } from "react-router-dom";
import { Search, Plus, Hexagon, Bell, User } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useAuth } from "@/src/contexts/AuthContext";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/src/lib/firebase";

export function Header({ isVisible = true }: { isVisible?: boolean }) {
  const { user, userProfile, signInWithGoogle } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      where("read", "==", false)
    );
    const unsub = onSnapshot(q, (snap) => {
      const realUnreadCount = snap.docs.filter(doc => {
        const d = doc.data();
        return d.fromUserId !== user.uid && d.userId !== d.fromUserId;
      }).length;
      setUnreadCount(realUnreadCount);
    });
    return () => unsub();
  }, [user]);
  
  const navLinks = [
    { name: "Explore", path: "/explore" },
  ];

  return (
    <header className={cn(
      "fixed top-0 inset-x-0 z-50 w-full border-b border-[rgba(255,255,255,0.05)] bg-[rgba(5,8,15,0.92)] backdrop-blur-xl transition-transform duration-300 ease-in-out",
      isVisible ? "translate-y-0" : "-translate-y-full"
    )}>
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-1.5 text-buildops-text hover:text-white transition-colors">
            <Hexagon className="h-5 w-5 text-buildops-blue" />
            <span className="font-bold tracking-tight text-xl font-mono">PROPLE</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) =>
                  cn(
                    "text-sm font-medium transition-colors hover:text-buildops-text",
                    isActive ? "text-buildops-text" : "text-buildops-text-secondary"
                  )
                }
              >
                {link.name}
              </NavLink>
            ))}
          </nav>
        </div>

          <div className="flex items-center gap-3 sm:gap-4">
          <Link to="/search" className="relative hidden w-64 lg:block group">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-buildops-text-secondary group-hover:text-buildops-text transition-colors" />
            <div className="w-full rounded-full border border-buildops-border bg-buildops-card py-2 pl-9 pr-4 text-sm text-buildops-text-secondary group-hover:border-buildops-text-secondary transition-colors text-left">
              Search problems...
            </div>
          </Link>
          
          <Link to="/search" className="lg:hidden p-1.5 text-buildops-text-secondary hover:text-buildops-text transition-colors">
            <Search className="h-5 w-5" />
          </Link>
          
          {user ? (
            <>
              <Link to="/notifications" className="p-2 text-buildops-text-secondary hover:text-buildops-text hover:bg-buildops-bg rounded-md transition-colors relative">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-buildops-blue rounded-full"></span>
                )}
              </Link>
              <Link
                to="/profile"
                className="w-8 h-8 rounded-full border border-buildops-border overflow-hidden bg-buildops-card flex items-center justify-center shrink-0"
              >
                {(() => {
                  const pfp = userProfile ? userProfile.photoURL : (user ? user.photoURL : null);
                  return pfp ? (
                    <img src={pfp} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-4 h-4 text-buildops-text-secondary" />
                  );
                })()}
              </Link>
            </>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="text-sm font-medium text-buildops-text bg-buildops-blue px-4 py-2 rounded-full hover:bg-buildops-blue/90 transition-colors cursor-pointer"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
