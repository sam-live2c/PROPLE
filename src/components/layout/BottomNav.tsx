import { Home, Compass, PlusSquare, User, LayoutDashboard } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/src/lib/utils";

export function BottomNav({ isVisible = true }: { isVisible?: boolean }) {
  const navItems = [
    { icon: Home, path: "/explore", label: "Feed" },
    { icon: PlusSquare, path: "/problems/new", label: "Post" },
    { icon: User, path: "/profile", label: "Profile" },
  ];

  return (
    <nav
      id="bottom-nav"
      className={cn(
        "md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0A0D12]/70 backdrop-blur-2xl border-t border-[rgba(255,255,255,0.05)] px-6 py-3 flex justify-between items-center pb-safe transition-transform duration-300 ease-in-out",
        isVisible ? "translate-y-0" : "translate-y-full"
      )}
    >
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300",
              isActive 
                ? "text-white bg-[rgba(255,255,255,0.08)] shadow-[0_0_20px_rgba(255,255,255,0.05)]" 
                : "text-buildops-text-secondary hover:text-buildops-text hover:bg-[rgba(255,255,255,0.03)]"
            )
          }
        >
          <item.icon className="w-[22px] h-[22px]" />
        </NavLink>
      ))}
    </nav>
  );
}
