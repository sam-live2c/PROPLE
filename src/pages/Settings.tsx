import { useEffect, useState, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  User,
  Bell,
  Shield,
  Paintbrush,
  Database,
  ChevronRight,
  ArrowLeft,
  ChevronDown,
  Check,
  Layout,
  Search,
  Zap,
  Code,
  LifeBuoy,
  Monitor,
  ToggleLeft,
  ToggleRight,
  Smartphone,
  Laptop,
  Box,
  Activity,
  Lock,
  Key,
  Globe,
  Search as SearchIcon,
  BookOpen,
  Award,
  CheckCircle2,
  AlertTriangle,
  Bookmark,
  Heart,
  MessageSquare,
  Share2,
  Upload,
  Clock,
  Trash2,
  Scale,
} from "lucide-react";
import { useAuth } from "@/src/contexts/AuthContext";
import { useSettings } from "@/src/contexts/SettingsContext";
import { useNavigate, useParams, Link, useLocation } from "react-router-dom";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "@/src/lib/firebase";
import { updateProfile, linkWithPopup, GoogleAuthProvider } from "firebase/auth";
import { generateSearchData } from "@/src/lib/search";
import { TrashSettings } from "@/src/components/TrashSettings";
import { toast } from "sonner";
import { useConfirmNavigation } from "@/src/hooks/useConfirmNavigation";
import { ConfirmNavigationDialog } from "@/src/components/ConfirmNavigationDialog";
import { SavedCardSkeleton } from "@/src/components/SkeletonLoader";
import { renderTextWithMentions } from "@/src/lib/renderUtils";
import { ProblemCard } from "@/src/components/ProblemCard";
import { ModerationPanel } from "@/src/components/ModerationPanel";

// Custom Toggle Component
function Toggle({ checked, onChange, label, description }: any) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex-1 pr-4">
        <div className="font-medium text-buildops-text text-[15px]">
          {label}
        </div>
        {description && (
          <div className="text-[13px] text-buildops-text-secondary mt-0.5 leading-snug">
            {description}
          </div>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-[20px] w-[36px] shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked
            ? "bg-buildops-blue"
            : "bg-transparent border-[rgba(255,255,255,0.2)]"
        }`}
        style={{ borderWidth: checked ? 0 : 1 }}
      >
        <span
          className={`pointer-events-none inline-block h-[16px] w-[16px] transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-[8px]" : "translate-x-[-8px] bg-white/50"
          }`}
        />
      </button>
    </div>
  );
}

// Select Component
function Select({ value, onChange, options, label, description }: any) {
  return (
    <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex-1">
        <div className="font-medium text-buildops-text text-[15px]">
          {label}
        </div>
        {description && (
          <div className="text-[13px] text-buildops-text-secondary mt-0.5 leading-snug">
            {description}
          </div>
        )}
      </div>
      <div className="relative w-full sm:w-auto min-w-[140px]">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-lg pl-3 pr-8 py-2 text-sm text-buildops-text focus:outline-none focus:border-buildops-blue appearance-none cursor-pointer font-medium"
        >
          {options.map((opt: any) => (
            <option
              key={opt.value}
              value={opt.value}
              className="bg-buildops-bg text-buildops-text font-medium"
            >
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-buildops-text-secondary pointer-events-none" />
      </div>
    </div>
  );
}

function SectionCard({ children, id }: any) {
  return (
    <div id={id} className="mb-0">
      <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-[18px] px-4 flex flex-col divide-y divide-[rgba(255,255,255,0.05)]">
        {children}
      </div>
    </div>
  );
}

const getNavGroups = (role?: string) => {
  const base = [
    {
      title: "Personal",
      links: [
        { id: "profile", label: "Profile", icon: User },
        { id: "account", label: "Account", icon: Lock },
      ],
    },
    {
      title: "Experience",
      links: [
        { id: "experience", label: "Experience", icon: Paintbrush },
        { id: "content", label: "Content & Feed", icon: Layout },
        { id: "activity", label: "My Activity", icon: Activity },
      ],
    },
    {
      title: "Security",
      links: [
        { id: "notifications", label: "Notifications", icon: Bell },
        { id: "privacy", label: "Privacy & Safety", icon: Shield },
      ],
    },
    {
      title: "Personalized",
      links: [
        { id: "developer", label: "Developer", icon: Code },
        { id: "guidance", label: "User Guidance", icon: BookOpen, to: "/user-guidance" },
        { id: "privacy-policy", label: "Privacy & Policy", icon: Shield, to: "/privacy-policy" },
        { id: "terms", label: "Terms and conditions", icon: Scale, to: "/terms" },
      ],
    },
  ];

  if (role === "admin") {
    base.push({
      title: "Administration",
      links: [
        { id: "moderation", label: "Moderation Panel", icon: Shield },
      ],
    });
  }

  return base;
};

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const MAX_WIDTH = 200;
        const MAX_HEIGHT = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
};

export function Settings() {
  const { tab } = useParams();
  const locationPath = useLocation();
  const activeTab = tab || "control-center";
  const { user, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [dbUser, setDbUser] = useState<any>(null);

  const currentNavGroups = getNavGroups(userProfile?.role);

  const initialDisplayName = dbUser?.displayName || user?.displayName || "";
  const initialHandle =
    dbUser?.handle || (user as any)?.handle || user?.email?.split("@")[0] || "";
  const initialLocation = dbUser?.location || (user as any)?.location || "";
  const initialGender =
    dbUser?.gender || (user as any)?.gender || "Prefer not to say";
  const initialBio = dbUser?.bio || (user as any)?.bio || "";
  const initialPhotoURL = dbUser 
    ? (dbUser.photoURL !== undefined ? dbUser.photoURL : (user?.photoURL || null)) 
    : (user?.photoURL || null);
  const initialLocationPrivate = dbUser?.locationPrivate || false;
  const initialGenderPrivate = dbUser?.genderPrivate || false;

  const { settings, updateSetting } = useSettings();
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [userLocation, setUserLocation] = useState("");
  const [gender, setGender] = useState("Prefer not to say");
  const [bio, setBio] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [locationPrivate, setLocationPrivate] = useState(false);
  const [genderPrivate, setGenderPrivate] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  const handleLinkGoogle = async () => {
    if (!auth.currentUser) return;
    setIsLinking(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await linkWithPopup(auth.currentUser, provider);
      const linkedUser = result.user;
      
      const userRef = doc(db, "users", linkedUser.uid);
      await updateDoc(userRef, {
        email: linkedUser.email || "",
        displayName: linkedUser.displayName || dbUser?.displayName || "Anonymous Explorer",
        photoURL: linkedUser.photoURL || dbUser?.photoURL || null,
        updatedAt: serverTimestamp(),
      });
      
      const snap = await getDoc(userRef);
      if (snap.exists()) setDbUser(snap.data());

      toast.success("Account successfully verified and linked with Google!");
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        console.log("Authentication popup closed by user.");
      } else if (error.code === 'auth/credential-already-in-use') {
        toast.error("This Google account is already linked to another user.");
      } else {
        console.error("Error linking account with Google", error);
        toast.error("Unable to link Google account. Please try again.");
      }
    } finally {
      setIsLinking(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState("");

  // --- Settings Search Active Overlay Logic ---
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("settings_search_history");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const handleClearHistory = () => {
    setSearchHistory([]);
    try {
      localStorage.setItem("settings_search_history", JSON.stringify([]));
    } catch (e) {
      console.error(e);
    }
  };

  const addToHistory = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearchHistory((prev) => {
      const filtered = prev.filter(
        (item) => item.toLowerCase() !== trimmed.toLowerCase(),
      );
      const updated = [trimmed, ...filtered].slice(0, 10);
      try {
        localStorage.setItem(
          "settings_search_history",
          JSON.stringify(updated),
        );
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  const searchableSettings = [
    {
      id: "profile-name",
      tab: "profile",
      category: "Personal",
      title: "Public Profile - Display Name",
      description:
        "Update your public display name shown on your profile and posts.",
      keywords: ["name", "handle", "profile", "display name", "personal"],
      iconName: "User",
    },
    {
      id: "profile-username",
      tab: "profile",
      category: "Personal",
      title: "Username & Handle",
      description:
        "Change your unique @handle. Subject to 30-minute grace period rules.",
      keywords: ["username", "handle", "url", "id", "personal"],
      iconName: "Lock",
    },
    {
      id: "profile-bio",
      tab: "profile",
      category: "Personal",
      title: "Bio Details",
      description: "Briefly describe yourself with character count metrics.",
      keywords: ["bio", "about", "status", "description", "personal"],
      iconName: "User",
    },
    {
      id: "profile-location",
      tab: "profile",
      category: "Personal",
      title: "Location settings",
      description: "Set your physical location and toggle privacy visibility.",
      keywords: ["location", "country", "city", "privacy", "map"],
      iconName: "Globe",
    },
    {
      id: "profile-avatar",
      tab: "profile",
      category: "Personal",
      title: "Avatar & Profile Photo",
      description: "Upload and crop your personalized profile picture.",
      keywords: ["photo", "avatar", "image", "upload", "pic"],
      iconName: "User",
    },
    {
      id: "account-main",
      tab: "account",
      category: "Personal",
      title: "Account Settings",
      description: "Manage your registered email and active session keys.",
      keywords: ["account", "email", "session", "logout", "danger"],
      iconName: "Lock",
    },
    {
      id: "experience-theme",
      tab: "experience",
      category: "Experience",
      title: "Visual Theme & Mode",
      description:
        "Toggle light, dark, system appearance, and core dark themes.",
      keywords: [
        "experience",
        "theme",
        "dark mode",
        "light mode",
        "appearance",
      ],
      iconName: "Paintbrush",
    },
    {
      id: "experience-accent",
      tab: "experience",
      category: "Experience",
      title: "Accent & Layout Colors",
      description:
        "Select brand accent markers (Blue, Green, Rose, Purple, Amber).",
      keywords: ["color", "accent", "experience", "style", "ui"],
      iconName: "Paintbrush",
    },
    {
      id: "content-feed",
      tab: "content",
      category: "Experience",
      title: "Content & Feed Layouts",
      description:
        "Customize post feeds, card sizing, compact density levels, and layouts.",
      keywords: [
        "content",
        "feed",
        "layout",
        "grid",
        "card",
        "density",
      ],
      iconName: "Layout",
    },
    {
      id: "activity-history",
      tab: "activity",
      category: "Experience",
      title: "My Activity - Engagement Logs",
      description:
        "Browse historical logs of saved, liked, commented, or shared posts.",
      keywords: [
        "activity",
        "saves",
        "likes",
        "comments",
        "engagement",
        "history",
      ],
      iconName: "Activity",
    },
    {
      id: "notifications-push",
      tab: "notifications",
      category: "Security",
      title: "Activity & Push Alerts",
      description:
        "Tune notification bells, sound triggers, and browser alerts.",
      keywords: ["notifications", "push", "alerts", "bell", "security"],
      iconName: "Bell",
    },
    {
      id: "privacy-safety",
      tab: "privacy",
      category: "Security",
      title: "Privacy & Visibility Safety",
      description:
        "Adjust findability status and discoverable parameters on search engines.",
      keywords: [
        "privacy",
        "safety",
        "shield",
        "private",
        "hidden",
        "security",
      ],
      iconName: "Shield",
    },
    {
      id: "developer-mode",
      tab: "developer",
      category: "Personalized",
      title: "Developer Tools",
      description:
        "Access live tokens, sandbox configurations, and telemetry hooks.",
      keywords: ["developer", "code", "token", "sandbox", "api", "personalized"],
      iconName: "Code",
    },
    {
      id: "guidance-rules",
      tab: "guidance",
      category: "Personalized",
      title: "User Guidance & Platform Rules",
      description:
        "Review community standards, rules, trust vectors, and guidelines.",
      keywords: ["guidance", "faq", "rules", "help", "support", "reputation"],
      iconName: "BookOpen",
    },
    {
      id: "trash-bin",
      tab: "activity",
      category: "Experience",
      title: "Review Trash Bin",
      description: "Safely restore or permanently purge soft-deleted records.",
      keywords: ["trash", "deleted", "restore", "recycle", "advanced"],
      iconName: "Database",
    },
  ];

  // Helper function to return icon component dynamically
  const getSearchIconComponent = (iconName: string) => {
    switch (iconName) {
      case "User":
        return User;
      case "Lock":
        return Lock;
      case "Globe":
        return Globe;
      case "Paintbrush":
        return Paintbrush;
      case "Layout":
        return Layout;
      case "Activity":
        return Activity;
      case "Bell":
        return Bell;
      case "Shield":
        return Shield;
      case "Code":
        return Code;
      case "BookOpen":
        return BookOpen;
      case "Database":
        return Database;
      default:
        return SearchIcon;
    }
  };

  const queryLower = searchQuery.toLowerCase().trim();
  const matchedSearchResults = queryLower
    ? searchableSettings.filter(
        (item) =>
          item.title.toLowerCase().includes(queryLower) ||
          item.description.toLowerCase().includes(queryLower) ||
          item.keywords.some((kw) => kw.toLowerCase().includes(queryLower)) ||
          item.category.toLowerCase().includes(queryLower),
      )
    : [];

  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Username eligibility helpers & ticker
  const [timeTicker, setTimeTicker] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeTicker((prev) => prev + 1);
    }, 10000); // stable ticking every 10 seconds is fine
    return () => clearInterval(interval);
  }, []);

  const getAccountCreationDate = (): Date => {
    if (dbUser?.createdAt) {
      if (typeof dbUser.createdAt.toDate === "function") {
        return dbUser.createdAt.toDate();
      }
      if (dbUser.createdAt.seconds) {
        return new Date(dbUser.createdAt.seconds * 1000);
      }
    }
    if (auth.currentUser?.metadata?.creationTime) {
      return new Date(auth.currentUser.metadata.creationTime);
    }
    return new Date();
  };

  const getUsernameLastChangedDate = (): Date | null => {
    if (dbUser?.usernameLastChangedAt) {
      if (typeof dbUser.usernameLastChangedAt.toDate === "function") {
        return dbUser.usernameLastChangedAt.toDate();
      }
      if (dbUser.usernameLastChangedAt.seconds) {
        return new Date(dbUser.usernameLastChangedAt.seconds * 1000);
      }
    }
    return null;
  };

  const getUsernameBlockStartDate = (): Date | null => {
    if (dbUser?.usernameBlockStartAt) {
      if (typeof dbUser.usernameBlockStartAt.toDate === "function") {
        return dbUser.usernameBlockStartAt.toDate();
      }
      if (dbUser.usernameBlockStartAt.seconds) {
        return new Date(dbUser.usernameBlockStartAt.seconds * 1000);
      }
    }
    // Fall back to usernameLastChangedAt for backwards compatibility
    return getUsernameLastChangedDate();
  };

  const eligibility = (() => {
    const now = new Date();
    const blockStart = getUsernameBlockStartDate();

    if (!blockStart) {
      return {
        allowed: true,
        reason: "never_changed" as const,
        remainingText: "",
        helperText: "Changing your username starts a 30-minute grace period.",
      };
    }

    const thirtyMinutesMs = 30 * 60 * 1000;
    const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000;
    const elapsedMs = now.getTime() - blockStart.getTime();

    if (elapsedMs < thirtyMinutesMs) {
      const remainingMs = thirtyMinutesMs - elapsedMs;
      const min = Math.max(0, Math.floor(remainingMs / (60 * 1000)));
      const sec = Math.max(0, Math.floor((remainingMs % (60 * 1000)) / 1000));
      return {
        allowed: true,
        reason: "grace_period" as const,
        remainingText: `${min}m ${sec}s`,
        helperText: `Grace period active: ${min}m ${sec}s left.`,
      };
    } else if (elapsedMs < thirtyMinutesMs + fifteenDaysMs) {
      const remainingMs = (thirtyMinutesMs + fifteenDaysMs) - elapsedMs;
      const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
      const hours = Math.floor(
        (remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000),
      );
      const minutes = Math.floor(
        (remainingMs % (60 * 60 * 1000)) / (60 * 1000),
      );

      const parts: string[] = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      parts.push(`${minutes}m`);

      const remainingStr = parts.join(" ");

      return {
        allowed: false,
        reason: "on_cooldown" as const,
        remainingText: remainingStr,
        helperText: `Cooldown active: Try again in ${remainingStr}.`,
      };
    } else {
      return {
        allowed: true,
        reason: "cooldown_over" as const,
        remainingText: "",
        helperText: "Changing your username starts a 30-minute grace period.",
      };
    }
  })();

  const [activitySubTab, setActivitySubTab] = useState<
    "saves" | "likes" | "comments" | "shares"
  >("saves");
  const [activityPosts, setActivityPosts] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityView, setActivityView] = useState<
    "menu" | "saves" | "likes" | "comments" | "shares" | "trash"
  >("menu");
  const [activityFilter, setActivityFilter] = useState<
    "recent" | "myposts" | "others"
  >("recent");

  useEffect(() => {
    if (locationPath.state?.view) {
      setActivityView(locationPath.state.view);
      window.history.replaceState(null, "");
    } else {
      setActivityView("menu");
    }
    setActivityFilter("recent");
  }, [activeTab, locationPath.state]);

  useEffect(() => {
    if (activeTab === "trash") {
      navigate("/settings/activity", {
        replace: true,
        state: { view: "trash" },
      });
    }
  }, [activeTab, navigate]);

  const filteredPosts = activityPosts.filter((post) => {
    if (activityFilter === "myposts") {
      return post.authorId === user?.uid;
    }
    if (activityFilter === "others") {
      return post.authorId !== user?.uid;
    }
    return true;
  });

  useEffect(() => {
    if (activeTab !== "activity" || !user) return;

    const fetchActivity = async () => {
      setActivityLoading(true);
      try {
        let postIds: string[] = [];

        if (activitySubTab === "saves") {
          const q = query(
            collection(db, "saves"),
            where("userId", "==", user.uid),
          );
          const snap = await getDocs(q);
          postIds = snap.docs.map((d) => d.data().postId);
        } else if (activitySubTab === "likes") {
          const q = query(
            collection(db, "likes"),
            where("userId", "==", user.uid),
          );
          const snap = await getDocs(q);
          postIds = snap.docs.map((d) => d.data().postId);
        } else if (activitySubTab === "shares") {
          const q = query(
            collection(db, "shares"),
            where("userId", "==", user.uid),
          );
          const snap = await getDocs(q);
          postIds = snap.docs.map((d) => d.data().postId);
        } else if (activitySubTab === "comments") {
          const q = query(
            collection(db, "comments"),
            where("authorId", "==", user.uid),
          );
          const snap = await getDocs(q);
          postIds = snap.docs.map((d) => d.data().postId);
        }

        const uniqueIds = [...new Set(postIds)].filter(Boolean);
        const postsData: any[] = [];

        for (const pid of uniqueIds) {
          const pDoc = await getDoc(doc(db, "posts", pid));
          if (pDoc.exists()) {
            postsData.push({ id: pDoc.id, ...pDoc.data() });
          }
        }

        postsData.sort((a, b) => {
          const timeA = a.createdAt?.toMillis
            ? a.createdAt.toMillis()
            : a.createdAt
              ? new Date(a.createdAt).getTime()
              : 0;
          const timeB = b.createdAt?.toMillis
            ? b.createdAt.toMillis()
            : b.createdAt
              ? new Date(b.createdAt).getTime()
              : 0;
          return timeB - timeA;
        });

        setActivityPosts(postsData);
      } catch (err) {
        console.error("Error fetching activity:", err);
      } finally {
        setActivityLoading(false);
      }
    };

    fetchActivity();
  }, [user, activitySubTab, activeTab]);

  useEffect(() => {
    if (user) {
      setDisplayName(initialDisplayName);
      setHandle(initialHandle);
      setUserLocation(initialLocation);
      setGender(initialGender);
      setBio(initialBio);
      setSelectedPhoto(initialPhotoURL);
      setLocationPrivate(initialLocationPrivate);
      setGenderPrivate(initialGenderPrivate);
    }
  }, [dbUser, user]);

  const hasChanges =
    displayName !== initialDisplayName ||
    handle !== initialHandle ||
    userLocation !== initialLocation ||
    gender !== initialGender ||
    bio !== initialBio ||
    selectedPhoto !== initialPhotoURL ||
    locationPrivate !== initialLocationPrivate ||
    genderPrivate !== initialGenderPrivate;

  const blocker = useConfirmNavigation(hasChanges);

  useEffect(() => {
    if (user) {
      getDoc(doc(db, "users", user.uid)).then((snap: any) => {
        if (snap.exists()) setDbUser(snap.data());
      });
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user || user.isAnonymous) {
      toast.error("Guest users cannot edit profile settings.");
      return;
    }
    if (!handle.trim()) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const newHandle = handle.trim();

      if (newHandle !== initialHandle) {
        if (newHandle.length < 3 || newHandle.length > 20) {
          toast.error("Username must be between 3 and 20 characters");
          setIsSaving(false);
          return;
        }
        if (!/^[a-zA-Z0-9.,_\-]+$/.test(newHandle)) {
          toast.error(
            "Only letters, numbers, and .,_,- characters allowed in username",
          );
          setIsSaving(false);
          return;
        }

        if (!eligibility.allowed) {
          toast.error(eligibility.helperText);
          setIsSaving(false);
          return;
        }

        // Check uniqueness in Firestore
        const q = query(
          collection(db, "users"),
          where("handle", "==", newHandle),
        );
        const querySnapshot = await getDocs(q);
        const otherUsers = querySnapshot.docs.filter((d) => d.id !== user?.uid);
        if (otherUsers.length > 0) {
          toast.error("This username is already taken");
          setIsSaving(false);
          return;
        }
      }

      const searchData = generateSearchData({
        authorName: displayName.trim(),
        authorHandle: newHandle,
        tags: dbUser?.interests || [],
        body: bio.trim(), // bio is like a description
      });

      if (auth.currentUser) {
        // Firebase Authentication lacks space for long Base64 strings in the photoURL property (limit of 2,048 characters).
        // Since we are already storing the full photoURL in Firestore, we can set it to null or only keep standard short URLs in Firebase Auth.
        const photoForAuth = selectedPhoto && selectedPhoto.length > 2000 ? null : selectedPhoto;
        await updateProfile(auth.currentUser, {
          displayName: displayName.trim(),
          photoURL: photoForAuth,
        });
      }

      const updatePayload: any = {
        displayName: displayName.trim(),
        handle: newHandle,
        location: userLocation.trim(),
        gender: gender,
        bio: bio.trim(),
        photoURL: selectedPhoto,
        locationPrivate: locationPrivate,
        genderPrivate: genderPrivate,
        search: searchData,
      };

      if (newHandle !== initialHandle) {
        const uNow = new Date();
        updatePayload.usernameLastChangedAt = uNow;
        const blockStart = getUsernameBlockStartDate();
        const thirtyMinutesMs = 30 * 60 * 1000;
        const isCurrentlyGracePeriod = blockStart && (uNow.getTime() - blockStart.getTime() < thirtyMinutesMs);
        if (!isCurrentlyGracePeriod) {
          updatePayload.usernameBlockStartAt = uNow;
        }
      }

      await setDoc(doc(db, "users", user.uid), updatePayload, { merge: true });

      setDbUser((prev: any) => {
        const uNow = new Date();
        const nextState = {
          ...prev,
          displayName: displayName.trim(),
          handle: newHandle,
          location: userLocation.trim(),
          gender: gender,
          bio: bio.trim(),
          photoURL: selectedPhoto,
          locationPrivate: locationPrivate,
          genderPrivate: genderPrivate,
          search: searchData,
        };
        if (newHandle !== initialHandle) {
          nextState.usernameLastChangedAt = uNow;
          const blockStart = getUsernameBlockStartDate();
          const thirtyMinutesMs = 30 * 60 * 1000;
          const isCurrentlyGracePeriod = blockStart && (uNow.getTime() - blockStart.getTime() < thirtyMinutesMs);
          if (!isCurrentlyGracePeriod) {
            nextState.usernameBlockStartAt = uNow;
          }
        }
        return nextState;
      });

      setSaveSuccess(true);
      toast.success("Profile saved");
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      console.error("Failed to update profile error:", err);
      toast.error(`Failed to update profile: ${err?.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const scrollToSection = (id: string) => {
    // Only scroll if we are on desktop where all sections are visible
    if (window.innerWidth >= 768) {
      const el = document.getElementById(`settings-${id}`);
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    }
  };

  useEffect(() => {
    if (tab) {
      setTimeout(() => scrollToSection(tab), 100);
      if (window.innerWidth < 768) {
        window.scrollTo(0, 0);
      }
    } else {
      if (window.innerWidth < 768) {
        window.scrollTo(0, 0);
      }
    }
  }, [tab]);

  const getTabDescription = (tabId: string) => {
    switch (tabId) {
      case "profile":
        return "Edit your public identity";
      case "account":
        return "Manage your email and data";
      case "experience":
        return "Customize app theme and layout";
      case "content":
        return "Tune your feed preferences";
      case "activity":
        return "Review your likes, saves, comments, and shares";
      case "notifications":
        return "Control your activity alerts";
      case "privacy":
        return "Adjust public visibility and safety";
      case "developer":
        return "Access experimental tools";
      case "guidance":
        return "Platform rules and reputation";
      case "trash":
        return "Review deleted items";
      default:
        return "Customize your experience";
    }
  };

  const isMobileMenu = !tab || tab === "control-center";

  const allLinks = currentNavGroups.flatMap((g) => g.links);
  const currentLink = allLinks.find((l) => l.id === activeTab);
  const ActiveIcon = currentLink?.icon;

  return (
    <div className="flex flex-col md:flex-row flex-1 w-full bg-[#0A0D12] text-buildops-text">
      {/* Settings Navigation Sidebar */}
      <div
        className={`w-full md:w-[320px] shrink-0 border-r border-[rgba(255,255,255,0.05)] bg-[#0A0D12] md:sticky md:top-0 md:h-screen md:overflow-y-auto no-scrollbar ${!isMobileMenu ? "hidden md:block" : "block"}`}
      >
        <div className="md:hidden sticky top-0 bg-[#0A0D12]/95 backdrop-blur-xl z-20 px-4 h-14 border-b border-[rgba(255,255,255,0.05)] flex items-center gap-3">
          <Link
            to="/"
            className="p-1 -ml-1 text-buildops-text-secondary hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-[20px] font-bold text-white tracking-tight">
            Settings
          </h1>
        </div>

        <div className="p-4 w-full pb-20 md:pb-4">
          <div className="hidden md:block mb-8 mt-2 px-2">
            <h1 className="text-[24px] font-bold text-white tracking-tight">
              Settings
            </h1>
            <p className="text-[14px] text-buildops-text-secondary mt-1">
              Customize your experience
            </p>
          </div>

          <div
            className="relative mb-8 px-2 md:hidden cursor-pointer"
            onClick={() => setIsSearchActive(true)}
          >
            <SearchIcon className="w-4 h-4 absolute left-6 top-1/2 -translate-y-1/2 text-buildops-text-secondary pointer-events-none" />
            <input
              type="text"
              readOnly
              placeholder="Search settings..."
              className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-[14px] pl-10 pr-4 py-3 text-[15px] outline-none cursor-pointer text-white placeholder-buildops-text-secondary/70 pointer-events-none"
            />
          </div>

          <div className="space-y-6">
            {currentNavGroups.map((group) => (
              <div key={group.title}>
                <h3 className="text-[12px] uppercase tracking-widest text-[#6c7283] mb-3 px-3 font-semibold">
                  {group.title}
                </h3>
                <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-[18px] overflow-hidden flex flex-col divide-y divide-[rgba(255,255,255,0.03)]">
                  {group.links.map((link) => {
                    const isActive = activeTab === link.id;
                    return (
                      <Link
                        key={link.id}
                        to={link.to || `/settings/${link.id}`}
                        className={`flex items-center gap-4 px-4 py-3.5 hover:bg-[rgba(255,255,255,0.03)] transition-colors ${isActive ? "bg-[rgba(255,255,255,0.04)] md:bg-[rgba(255,255,255,0.06)]" : ""}`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${isActive ? "bg-white/10 border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.05)]" : "bg-white/5 border-white/5"}`}
                        >
                          <link.icon
                            className={`w-[18px] h-[18px] ${isActive ? "text-white" : "text-buildops-text-secondary"}`}
                          />
                        </div>
                        <span
                          className={`text-[16px] font-medium flex-1 ${isActive ? "text-white" : "text-buildops-text-secondary"}`}
                        >
                          {link.label}
                        </span>
                        <ChevronRight className="w-5 h-5 text-buildops-text-secondary opacity-40 shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div
        className={`flex-1 bg-[#0A0D12] ${isMobileMenu ? "hidden md:block" : "block"}`}
      >
        <div className="border-b border-[rgba(255,255,255,0.05)] px-4 md:px-10 flex items-center justify-between gap-4 sticky top-0 bg-[#0A0D12]/95 backdrop-blur-xl z-10 w-full min-h-[56px] py-2 md:py-3 md:min-h-[72px]">
          <div className="flex items-center gap-3">
            <div>
              {activeTab === "activity" && activityView !== "menu" ? (
                <button
                  onClick={() => setActivityView("menu")}
                  className="p-1 -ml-1 text-buildops-text-secondary hover:text-white transition-colors inline-block focus:outline-none"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              ) : (
                <Link
                  to="/settings"
                  className="p-1 -ml-1 text-buildops-text-secondary hover:text-white transition-colors inline-block focus:outline-none"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Link>
              )}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                {false && ActiveIcon && activeTab !== "control-center" && (
                  <div className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.03)] flex items-center justify-center border border-[rgba(255,255,255,0.05)] shadow-[0_0_15px_rgba(255,255,255,0.02)]">
                    <ActiveIcon className="w-4 h-4 text-white" />
                  </div>
                )}
                <h1 className="text-[18px] md:text-[20px] font-bold tracking-tight text-white capitalize">
                  {activeTab === "activity" && activityView !== "menu"
                    ? activityView === "trash"
                      ? "Trash Bin"
                      : `${activityView === "saves" ? "Saved" : activityView === "likes" ? "Liked" : activityView === "comments" ? "Commented" : "Shared"} Posts`
                    : activeTab === "control-center"
                      ? "Control Center"
                      : currentLink?.label || activeTab.replace("-", " ")}
                </h1>
              </div>
              {null}
            </div>
          </div>
          <div
            className="relative max-w-sm w-full hidden sm:block cursor-pointer"
            onClick={() => setIsSearchActive(true)}
          >
            <SearchIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-buildops-text-secondary pointer-events-none" />
            <input
              type="text"
              readOnly
              placeholder="Search settings..."
              className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-[14px] pl-10 pr-4 py-2 text-[14px] outline-none cursor-pointer text-white placeholder-buildops-text-secondary/70 pointer-events-none"
            />
          </div>
        </div>

        <div className={`${activeTab === "activity" && activityView !== "menu" ? "max-w-4xl p-0 md:p-0" : "max-w-3xl p-4 md:p-10"} mx-auto space-y-8 pb-32`}>
          {/* Profile */}
          <div
            className={
              activeTab === "profile" || isMobileMenu
                ? "block"
                : "hidden md:block"
            }
          >
            <SectionCard
              id="settings-profile"
              title="Public Profile"
              icon={User}
            >
              <div className="py-2 space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                  <div
                    onClick={() => setShowPhotoModal(true)}
                    className="relative w-22 h-22 rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] flex items-center justify-center overflow-hidden shrink-0 cursor-pointer group"
                  >
                    {selectedPhoto ? (
                      <img
                        src={selectedPhoto}
                        alt="Avatar"
                        className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                      />
                    ) : (
                      <User className="w-8 h-8 text-buildops-text-secondary group-hover:text-white transition-colors" />
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Upload className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-1">
                    <h3 className="text-[15px] font-medium text-white">
                      Profile Picture
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-sm">
                      <button
                        type="button"
                        onClick={() => setShowPhotoModal(true)}
                        className="text-buildops-blue hover:text-blue-400 font-semibold transition-colors bg-transparent border-none p-0 cursor-pointer"
                      >
                        Change Photo
                      </button>
                      {selectedPhoto && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPhoto(null);
                            toast.success(
                              "Profile photo cleared. Save profile to apply changes.",
                            );
                          }}
                          className="text-rose-500 hover:text-rose-400 font-semibold transition-colors bg-transparent border-none p-0 cursor-pointer"
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-[rgba(255,255,255,0.05)] text-white">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[14px] font-medium text-buildops-text-secondary">
                          Name
                        </label>
                        <span className="text-[11px] font-mono text-buildops-text-secondary/60">
                          {displayName.length}/50
                        </span>
                      </div>
                      <input
                        type="text"
                        className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-[14px] px-4 py-2.5 text-[15px] outline-none focus:border-white/20 transition-all font-medium placeholder-buildops-text-secondary/50 text-white"
                        placeholder="e.g., Jane Doe"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        maxLength={50}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <label className="block text-[14px] font-medium text-buildops-text-secondary mb-0">
                            Username
                          </label>
                          {handle.trim() !== initialHandle && !eligibility.allowed && (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-[#1E1215] border-rose-955/40 text-rose-450"
                            >
                              Locked
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-buildops-text-secondary/60">
                          {handle.length}/20
                        </span>
                      </div>
                      <div className="flex bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.05)] rounded-[14px] overflow-hidden focus-within:border-white/20 transition-all h-[46px] items-center">
                        <span className="h-full py-2.5 pl-4 pr-1 text-buildops-text-secondary text-[15px] flex items-center bg-[rgba(255,255,255,0.02)] font-medium select-none">
                          buildops.co/
                        </span>
                        <input
                          type="text"
                          className={`w-full bg-transparent py-2.5 px-2 text-[15px] outline-none font-medium text-white ${!eligibility.allowed && handle.trim() !== initialHandle ? "text-rose-450" : ""}`}
                          value={handle}
                          onChange={(e) =>
                            setHandle(e.target.value.replace(/\s+/g, ""))
                          }
                          maxLength={20}
                        />
                      </div>
                      <div
                        className={`mt-2 text-[12px] leading-relaxed flex items-start gap-1.5 ${!eligibility.allowed && handle.trim() !== initialHandle ? "text-rose-400" : eligibility.reason === "grace_period" ? "text-buildops-blue font-medium" : "text-buildops-text-secondary"}`}
                      >
                        {eligibility.allowed ? (
                          eligibility.reason === "grace_period" ? (
                            <>
                              <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-buildops-blue" />
                              <span>
                                Within the 30-minute grace period. You can
                                change your username as many times as you like (
                                {eligibility.remainingText} left).
                              </span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-buildops-text-secondary" />
                              <span>
                                Username changes are limited to once every 15
                                days after the 30-minute grace period has
                                expired.
                              </span>
                            </>
                          )
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                            <span>{eligibility.helperText}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[14px] font-medium text-buildops-text-secondary">
                        Bio
                      </label>
                      <span className="text-[11px] font-mono text-buildops-text-secondary/60">
                        {bio.length}/160
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g., Systems Builder"
                      className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-[14px] px-4 py-2.5 text-[15px] outline-none focus:border-white/20 transition-all font-medium placeholder-buildops-text-secondary/50"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      maxLength={160}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[14px] font-medium text-buildops-text-secondary">
                          Location
                        </label>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-mono text-buildops-text-secondary/60">
                            {userLocation.length}/50
                          </span>
                          <button
                            type="button"
                            onClick={() => setLocationPrivate(!locationPrivate)}
                            className={
                              "flex items-center gap-1 text-[11px] font-bold transition-all px-2.5 py-0.5 rounded-full border " +
                              (locationPrivate
                                ? "bg-[#1E1215] border-rose-950/40 text-rose-450"
                                : "bg-[#0E1525] border-blue-955/40 text-buildops-blue")
                            }
                          >
                            {locationPrivate ? (
                              <Lock className="w-3 h-3" />
                            ) : (
                              <Globe className="w-3 h-3" />
                            )}
                            {locationPrivate ? "Private" : "Public"}
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g., USA"
                        className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-[14px] px-4 py-2.5 text-[15px] outline-none focus:border-white/20 transition-all font-medium placeholder-buildops-text-secondary/50"
                        value={userLocation}
                        onChange={(e) => setUserLocation(e.target.value)}
                        maxLength={50}
                      />
                    </div>
                    <div className="sm:w-1/3">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[14px] font-medium text-buildops-text-secondary">
                          Gender
                        </label>
                        <button
                          type="button"
                          onClick={() => setGenderPrivate(!genderPrivate)}
                          className={
                            "flex items-center gap-1 text-[11px] font-bold transition-all px-2.5 py-0.5 rounded-full border " +
                            (genderPrivate
                              ? "bg-[#1E1215] border-rose-950/40 text-rose-450"
                              : "bg-[#0E1525] border-blue-955/40 text-buildops-blue")
                          }
                        >
                          {genderPrivate ? (
                            <Lock className="w-3 h-3" />
                          ) : (
                            <Globe className="w-3 h-3" />
                          )}
                          {genderPrivate ? "Private" : "Public"}
                        </button>
                      </div>
                      <div className="relative">
                        <select
                          className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-[14px] pl-4 pr-8 py-2.5 text-[15px] outline-none focus:border-white/20 appearance-none font-medium text-white"
                          value={gender}
                          onChange={(e) => setGender(e.target.value)}
                        >
                          <option
                            value="Prefer not to say"
                            className="bg-[#0A0D12]"
                          >
                            Prefer not to say
                          </option>
                          <option value="Male" className="bg-[#0A0D12]">
                            Male
                          </option>
                          <option value="Female" className="bg-[#0A0D12]">
                            Female
                          </option>
                          <option value="Other" className="bg-[#0A0D12]">
                            Other
                          </option>
                        </select>
                        <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-buildops-text-secondary pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 flex justify-end">
                  <button
                    disabled={!hasChanges || isSaving}
                    onClick={handleSaveProfile}
                    className="px-6 py-2.5 bg-white hover:bg-gray-200 text-[#0A0D12] font-semibold rounded-[12px] text-[14px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving
                      ? "Saving..."
                      : saveSuccess
                        ? "Saved!"
                        : "Save Profile"}
                  </button>
                </div>
              </div>
            </SectionCard>
          </div>

          {showPhotoModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
              <div className="bg-[#0B0F19] border border-[rgba(255,255,255,0.08)] rounded-[20px] max-w-sm w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center p-6 border-b border-[rgba(255,255,255,0.05)] text-center">
                  <div className="w-16 h-16 rounded-full bg-buildops-blue/10 flex items-center justify-center mb-3">
                    <User className="w-8 h-8 text-buildops-blue" />
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    Change Avatar
                  </h3>
                  <p className="text-sm text-buildops-text-secondary mt-1">
                    Upload a custom profile photo or clear the current one.
                  </p>
                </div>
                <div className="flex flex-col divide-y divide-[rgba(255,255,255,0.05)]">
                  <button
                    onClick={() => {
                      fileInputRef.current?.click();
                      setShowPhotoModal(false);
                    }}
                    className="w-full py-4 text-center text-sm font-bold text-buildops-blue hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors focus:outline-none"
                  >
                    Upload Photo
                  </button>
                  {selectedPhoto && (
                    <button
                      onClick={() => {
                        setSelectedPhoto(null);
                        setShowPhotoModal(false);
                        toast.success(
                          "Profile photo cleared. Save profile to apply changes.",
                        );
                      }}
                      className="w-full py-4 text-center text-sm font-bold text-rose-500 hover:bg-rose-500/5 active:bg-rose-500/10 transition-colors focus:outline-none"
                    >
                      Remove Current Photo
                    </button>
                  )}
                  <button
                    onClick={() => setShowPhotoModal(false)}
                    className="w-full py-4 text-center text-sm font-medium text-buildops-text hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors focus:outline-none"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              try {
                const compressed = await compressImage(file);
                setSelectedPhoto(compressed);
                toast.success("Photo selected. Save profile to apply changes.");
              } catch (err) {
                toast.error("Failed to process image. Please try another one.");
              }
            }}
            className="hidden"
          />

          {/* Experience */}
          <div
            className={
              activeTab === "experience" || isMobileMenu
                ? "block"
                : "hidden md:block"
            }
          >
            <SectionCard
              id="settings-experience"
              title="Experience"
              icon={Paintbrush}
            >
              <Select
                label="Theme"
                description="Select your preferred application theme."
                value={settings.theme}
                onChange={(val: any) => updateSetting("theme", val)}
                options={[
                  { label: "Dark", value: "dark" },
                  { label: "AMOLED", value: "amoled" },
                  { label: "System", value: "system" },
                ]}
              />
              <Select
                label="Feed Density"
                description="How much information to display per post."
                value={settings.feedDensity}
                onChange={(val: any) => updateSetting("feedDensity", val)}
                options={[
                  { label: "Compact", value: "compact" },
                  { label: "Comfortable", value: "comfortable" },
                  { label: "Expanded", value: "expanded" },
                ]}
              />
              <Select
                label="Comment Thread Style"
                description="Visual rendering layout for deep discussions."
                value={settings.threadStyle}
                onChange={(val: any) => updateSetting("threadStyle", val)}
                options={[
                  { label: "Compact Threads", value: "compact" },
                  { label: "Expanded Threads", value: "expanded" },
                ]}
              />
              <Toggle
                label="Workspace Mode"
                description="Hide casual thoughts and streamline your feed layout to enjoy a peaceful, distraction-free reading experience."
                checked={settings.workspaceMode}
                onChange={(val: any) => updateSetting("workspaceMode", val)}
              />
              <Toggle
                label="Reduced Motion"
                description="Minimize UI animations and transition effects."
                checked={settings.reducedMotion}
                onChange={(val: any) => updateSetting("reducedMotion", val)}
              />
            </SectionCard>
          </div>

          {/* My Activity */}
          <div
            className={
              activeTab === "activity" || isMobileMenu
                ? "block"
                : "hidden md:block"
            }
          >
            {activityView === "menu" ? (
              <SectionCard id="settings-activity">
                <div className="py-1 flex flex-col w-full text-left divide-y divide-[rgba(255,255,255,0.05)] animate-in fade-in duration-300">
                  <button
                    onClick={() => {
                      setActivityView("saves");
                      setActivitySubTab("saves");
                      setActivityFilter("recent");
                    }}
                    className="flex items-center justify-between py-4 group text-left focus:outline-none w-full"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-[12px] bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] text-[#98A2B3] group-hover:text-white group-hover:border-white/10 group-hover:bg-[rgba(255,255,255,0.05)] transition-all">
                        <Bookmark className="w-[18px] h-[18px]" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[15px] font-semibold text-white group-hover:text-white transition-colors">
                          Saves
                        </span>
                        <span className="text-[13px] text-[#98A2B3]">
                          Review your bookmarked and saved posts
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#98A2B3] opacity-40 group-hover:opacity-100 transition-opacity" />
                  </button>

                  <button
                    onClick={() => {
                      setActivityView("likes");
                      setActivitySubTab("likes");
                      setActivityFilter("recent");
                    }}
                    className="flex items-center justify-between py-4 group text-left focus:outline-none w-full"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-[12px] bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] text-[#98A2B3] group-hover:text-white group-hover:border-white/10 group-hover:bg-[rgba(255,255,255,0.05)] transition-all">
                        <Heart className="w-[18px] h-[18px]" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[15px] font-semibold text-white group-hover:text-white transition-colors">
                          Likes
                        </span>
                        <span className="text-[13px] text-[#98A2B3]">
                          Posts you have upvoted or liked
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#98A2B3] opacity-40 group-hover:opacity-100 transition-opacity" />
                  </button>

                  <button
                    onClick={() => {
                      setActivityView("comments");
                      setActivitySubTab("comments");
                      setActivityFilter("recent");
                    }}
                    className="flex items-center justify-between py-4 group text-left focus:outline-none w-full"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-[12px] bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] text-[#98A2B3] group-hover:text-white group-hover:border-white/10 group-hover:bg-[rgba(255,255,255,0.05)] transition-all">
                        <MessageSquare className="w-[18px] h-[18px]" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[15px] font-semibold text-white group-hover:text-white transition-colors">
                          Comments
                        </span>
                        <span className="text-[13px] text-[#98A2B3]">
                          Posts you have commented on or solved
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#98A2B3] opacity-40 group-hover:opacity-100 transition-opacity" />
                  </button>

                  <button
                    onClick={() => {
                      setActivityView("shares");
                      setActivitySubTab("shares");
                      setActivityFilter("recent");
                    }}
                    className="flex items-center justify-between py-4 group text-left focus:outline-none w-full"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-[12px] bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] text-[#98A2B3] group-hover:text-white group-hover:border-white/10 group-hover:bg-[rgba(255,255,255,0.05)] transition-all">
                        <Share2 className="w-[18px] h-[18px]" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[15px] font-semibold text-white group-hover:text-white transition-colors">
                          Shares
                        </span>
                        <span className="text-[13px] text-[#98A2B3]">
                          Posts you have shared copy or links
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#98A2B3] opacity-40 group-hover:opacity-100 transition-opacity" />
                  </button>

                  <button
                    onClick={() => {
                      setActivityView("trash");
                    }}
                    className="flex items-center justify-between py-4 group text-left focus:outline-none w-full border-t border-[rgba(255,255,255,0.05)]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-[12px] bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] text-[#98A2B3] group-hover:text-white group-hover:border-white/10 group-hover:bg-[rgba(255,255,255,0.05)] transition-all">
                        <Trash2 className="w-[18px] h-[18px]" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[15px] font-semibold text-white group-hover:text-white transition-colors">
                          Trash
                        </span>
                        <span className="text-[13px] text-[#98A2B3]">
                          Review, restore, or permanently purge deleted posts
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#98A2B3] opacity-40 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              </SectionCard>
            ) : activityView === "trash" ? (
              <div className="animate-in fade-in duration-300">
                <TrashSettings />
              </div>
            ) : (
              <div className="flex flex-col w-full text-left animate-in fade-in duration-300">
                {/* Filters */}
                <div className="flex items-center gap-2 mb-6 overflow-x-auto no-scrollbar py-0.5 px-4">
                  {(["recent", "myposts", "others"] as const).map((f) => {
                    const label =
                      f === "recent"
                        ? "Recently Saved"
                        : f === "myposts"
                          ? "My Posts"
                          : "Others' Posts";
                    // Custom label based on active view:
                    let customLabel = label;
                    if (f === "recent") {
                      if (activityView === "saves")
                        customLabel = "Recently Saved";
                      else if (activityView === "likes")
                        customLabel = "Recently Liked";
                      else if (activityView === "comments")
                        customLabel = "Recently Commented";
                      else if (activityView === "shares")
                        customLabel = "Recently Shared";
                    }
                    const isActive = activityFilter === f;
                    return (
                      <button
                        key={f}
                        onClick={() => setActivityFilter(f)}
                        className={`px-4 py-2 text-[13px] font-semibold rounded-[12px] border transition-all whitespace-nowrap focus:outline-none ${
                          isActive
                            ? "bg-white text-[#0A0D12] border-white shadow-[0_2px_8px_rgba(255,255,255,0.1)]"
                            : "bg-[rgba(255,255,255,0.01)] border-[rgba(255,255,255,0.05)] text-buildops-text-secondary hover:text-white hover:border-white/10"
                        }`}
                      >
                        {customLabel}
                      </button>
                    );
                  })}
                </div>

                {/* List Area */}
                <div className="w-full">
                  {activityLoading ? (
                    <div className="space-y-4 py-2 px-4">
                      <SavedCardSkeleton />
                      <SavedCardSkeleton />
                      <SavedCardSkeleton />
                    </div>
                  ) : filteredPosts.length === 0 ? (
                    <div className="text-center py-16 border border-dashed border-[rgba(255,255,255,0.05)] rounded-[20px] bg-[rgba(255,255,255,0.01)] mx-4">
                      <Activity className="w-10 h-10 text-buildops-text-secondary opacity-20 mx-auto mb-3" />
                      <h3 className="text-base font-bold text-white mb-1">
                        No posts found
                      </h3>
                      <p className="text-[13px] text-buildops-text-secondary max-w-xs mx-auto px-4">
                        {activityView === "saves" &&
                          "Posts you save will appear here."}
                        {activityView === "likes" &&
                          "Posts you upvote or like will appear here."}
                        {activityView === "comments" &&
                          "Posts you comment on or solve will appear here."}
                        {activityView === "shares" &&
                          "Posts you share will appear here."}
                      </p>
                    </div>
                  ) : (
                    <div className="w-full max-w-4xl mx-auto divide-y divide-buildops-border">
                      {filteredPosts.map((post) => (
                        <ProblemCard key={post.id} post={post} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Content & Feed */}
          <div
            className={
              activeTab === "content" || isMobileMenu
                ? "block"
                : "hidden md:block"
            }
          >
            <SectionCard
              id="settings-content"
              title="Content & Feed Preferences"
              icon={Layout}
            >
              <Toggle
                label="Home Feed Filter"
                description="Mute low-quality posts, repetitive content, or off-topic spam for a cleaner and more comfortable experience."
                checked={settings.hideLowQuality}
                onChange={(val: any) => updateSetting("hideLowQuality", val)}
              />
              <Toggle
                label="Show Cozy Thoughts"
                description="Display personal thoughts, micro-posts, and member updates alongside project showcases on your main feed."
                checked={settings.showThoughts}
                onChange={(val: any) => updateSetting("showThoughts", val)}
              />

              <div className="py-4">
                <div className="font-medium text-white text-[15px] mb-3">
                  Favorite Topics
                </div>
                <div className="flex flex-wrap gap-2">
                  {["AI", "Hardware", "Systems", "Cybersecurity", "DevOps"].map(
                    (domain) => {
                      const isActive =
                        settings.preferredDomains?.includes(domain);
                      return (
                        <span
                          key={domain}
                          onClick={() => {
                            const newDomains = isActive
                              ? settings.preferredDomains.filter(
                                  (d) => d !== domain,
                                )
                              : [...(settings.preferredDomains || []), domain];
                            updateSetting("preferredDomains", newDomains);
                          }}
                          className={`px-3.5 py-1.5 border rounded-[12px] text-[13px] font-medium cursor-pointer transition-colors ${isActive ? "bg-buildops-blue/20 border-buildops-blue text-buildops-blue shadow-[0_0_10px_rgba(59,130,246,0.15)]" : "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.05)] text-buildops-text-secondary hover:border-white/20 hover:text-white"}`}
                        >
                          {domain}
                        </span>
                      );
                    },
                  )}
                </div>
              </div>

              <div className="py-4">
                <div className="font-medium text-white text-[15px] mb-3">
                  Content Complexity Level
                </div>
                <div className="flex flex-wrap gap-2">
                  {["Beginner", "Intermediate", "Hard"].map((diff) => {
                    const isActive =
                      settings.preferredDifficulty?.includes(diff);
                    return (
                      <span
                        key={diff}
                        onClick={() => {
                          const newDiff = isActive
                            ? settings.preferredDifficulty.filter(
                                (d) => d !== diff,
                              )
                            : [...(settings.preferredDifficulty || []), diff];
                          updateSetting("preferredDifficulty", newDiff);
                        }}
                        className={`px-3.5 py-1.5 border rounded-[12px] text-[13px] font-medium cursor-pointer transition-colors ${isActive ? "bg-buildops-green/20 border-buildops-green text-buildops-green shadow-[0_0_10px_rgba(34,197,94,0.15)]" : "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.05)] text-buildops-text-secondary hover:border-white/20 hover:text-white"}`}
                      >
                        {diff}
                      </span>
                    );
                  })}
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Notifications */}
          <div
            className={
              activeTab === "notifications" || isMobileMenu
                ? "block"
                : "hidden md:block"
            }
          >
            <SectionCard
              id="settings-notifications"
              title="Notifications"
              icon={Bell}
            >
              <div className="py-2 border-b border-[rgba(255,255,255,0.05)]">
                <h3 className="text-[12px] font-bold text-buildops-text-secondary uppercase tracking-widest mb-3">
                  Activity
                </h3>
                <Toggle
                  label="Likes & Mentions"
                  checked={settings.notifications.likes}
                  onChange={(val: boolean) =>
                    updateSetting("notifications", {
                      ...settings.notifications,
                      likes: val,
                    })
                  }
                />
                <Toggle
                  label="New Replies"
                  checked={settings.notifications.replies}
                  onChange={(val: boolean) =>
                    updateSetting("notifications", {
                      ...settings.notifications,
                      replies: val,
                    })
                  }
                />
                <Toggle
                  label="New Followers"
                  checked={settings.notifications.followers}
                  onChange={(val: boolean) =>
                    updateSetting("notifications", {
                      ...settings.notifications,
                      followers: val,
                    })
                  }
                />
              </div>
              <div className="py-2 border-b border-transparent">
                <h3 className="text-[12px] font-bold text-buildops-text-secondary uppercase tracking-widest mb-3 mt-4">
                  Post Activity
                </h3>
                <Toggle
                  label="New Solutions"
                  checked={settings.notifications.solutions}
                  onChange={(val: boolean) =>
                    updateSetting("notifications", {
                      ...settings.notifications,
                      solutions: val,
                    })
                  }
                />
                <Toggle
                  label="Status Changes"
                  checked={settings.notifications.statusChanges}
                  onChange={(val: boolean) =>
                    updateSetting("notifications", {
                      ...settings.notifications,
                      statusChanges: val,
                    })
                  }
                />
              </div>
            </SectionCard>
          </div>

          {/* Privacy & Safety */}
          <div
            className={
              activeTab === "privacy" || isMobileMenu
                ? "block"
                : "hidden md:block"
            }
          >
            <SectionCard
              id="settings-privacy"
              title="Privacy & Safety"
              icon={Shield}
            >
              <Toggle
                label="Public Profile"
                description="Allow your profile to be discoverable by search engines."
                checked={settings.publicProfile}
                onChange={(val: any) => updateSetting("publicProfile", val)}
              />
              <Toggle
                label="Show Online Status"
                description="Let other builders see when you are active."
                checked={settings.showOnlineStatus}
                onChange={(val: any) => updateSetting("showOnlineStatus", val)}
              />
              <Toggle
                label="Allow Direct Messages"
                description="Receive messages from people you don't follow."
                checked={settings.allowDirectMessages}
                onChange={(val: any) =>
                  updateSetting("allowDirectMessages", val)
                }
              />
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-medium text-white text-[15px]">
                    Blocked Users
                  </div>
                  <div className="text-[13px] text-buildops-text-secondary mt-0.5">
                    Manage the list of users you have blocked.
                  </div>
                </div>
                <button
                  onClick={() =>
                    toast.info("You have no blocked users at this time.")
                  }
                  className="px-3.5 py-2 text-[13px] font-medium bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-[12px] hover:bg-white/10 text-white transition-colors"
                >
                  Manage
                </button>
              </div>
            </SectionCard>
          </div>

          {/* Account */}
          <div
            className={
              activeTab === "account" || isMobileMenu
                ? "block"
                : "hidden md:block"
            }
          >
            <SectionCard id="settings-account" title="Account" icon={Lock}>
              <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-white text-[15px] mb-1">
                    Email Address
                  </div>
                  <div className="text-[14px] text-buildops-text-secondary">
                    {user?.email || "No email linked"}
                  </div>
                </div>
                {user?.isAnonymous ? (
                  <button
                    onClick={handleLinkGoogle}
                    disabled={isLinking}
                    className="px-4 py-2 bg-buildops-blue text-white hover:bg-buildops-blue/90 disabled:opacity-50 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer flex items-center gap-2"
                  >
                    {isLinking ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify Google Account"
                    )}
                  </button>
                ) : (
                  <span className="text-[12px] bg-buildops-green/10 text-buildops-green border border-buildops-green/20 px-2 py-1 rounded-[6px] font-medium block w-fit">
                    Verified Google Account
                  </span>
                )}
              </div>

              <div className="py-4">
                <div className="py-2.5 border-t border-[rgba(255,255,255,0.05)] mt-2 flex items-center justify-between">
                  <div className="font-mono text-sm text-[#8899A6]">
                    Session
                  </div>
                  <button
                    onClick={() => setShowSignOutConfirm(true)}
                    className="px-4 py-2 text-[13px] font-mono font-medium border border-red-500/25 hover:bg-red-500/5 text-red-400 transition-colors rounded cursor-pointer"
                  >
                    Sign out
                  </button>
                </div>

                <div className="pt-4 border-t border-[rgba(255,255,255,0.05)] mt-2">
                  <button
                    onClick={() =>
                      toast.error(
                        "Account deletion must be requested through support.",
                      )
                    }
                    className="text-[14px] font-medium text-buildops-text-secondary hover:text-[#f91880] hover:underline transition-colors"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Moderation & Safety Admin Control Panel */}
          {userProfile?.role === "admin" && (
            <div
              className={
                activeTab === "moderation" || isMobileMenu
                  ? "block"
                  : "hidden md:block"
              }
            >
              <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-[18px] p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-buildops-blue/10 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-buildops-blue" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Administration Control Center</h2>
                    <p className="text-xs text-buildops-text-secondary mt-0.5">Manage community guidelines, user safety, and policy moderation.</p>
                  </div>
                </div>
                <ModerationPanel currentUserProfile={userProfile} />
              </div>
            </div>
          )}

          {/* Developer */}
          <div
            className={
              activeTab === "developer" || isMobileMenu
                ? "block"
                : "hidden md:block"
            }
          >
            <SectionCard
              id="settings-developer"
              title="Developer Settings"
              icon={Code}
            >
              <Toggle
                label="Developer Mode"
                description="Enable builder features, allowing you to showcase, submit, and browse project build posts."
                checked={settings.developerMode}
                onChange={(val: any) => updateSetting("developerMode", val)}
              />
              <Toggle
                label="Markdown Rendering"
                description="Render Markdown syntax in post and comment bodies."
                checked={settings.markdownRendering}
                onChange={(val: any) => updateSetting("markdownRendering", val)}
              />
              <Toggle
                label="Performance Mode"
                description="Optimize application speed by reducing lazy loads and background syncing."
                checked={settings.performanceMode}
                onChange={(val: any) => updateSetting("performanceMode", val)}
              />
              <Toggle
                label="Experimental Features"
                description="Early access to alpha and beta UI components."
                checked={settings.experimentalFeatures}
                onChange={(val: any) =>
                  updateSetting("experimentalFeatures", val)
                }
              />
            </SectionCard>
          </div>

          {/* Guidance */}
          <div
            className={
              activeTab === "guidance" || isMobileMenu
                ? "block"
                : "hidden md:block"
            }
          >
            <SectionCard
              id="settings-guidance"
              title="User Guidance & Guidelines"
              icon={BookOpen}
            >
              <div className="py-2 space-y-8">
                <p className="text-[14px] text-buildops-text-secondary leading-relaxed">
                  Follow our community guidelines to keep the platform respectful and helpful. Read our full guidelines as well as legal agreements regarding your data and usage privileges below:
                </p>

                <div className="pt-2 space-y-4 font-sans">
                  <div className="font-semibold text-white text-[15px]">
                    Documentation & Policies
                  </div>
                  <div className="flex flex-col gap-3">
                    <Link
                      to="/user-guidance"
                      className="text-sm text-[#3182ce] hover:underline flex items-center gap-2 group"
                    >
                      <ChevronRight className="w-4 h-4 text-[#A0AEC0] group-hover:text-white transition-colors" />
                      <span>User Guidance Manual</span>
                    </Link>
                    <Link
                      to="/terms"
                      className="text-sm text-[#3182ce] hover:underline flex items-center gap-2 group"
                    >
                      <ChevronRight className="w-4 h-4 text-[#A0AEC0] group-hover:text-white transition-colors" />
                      <span>Terms & Conditions</span>
                    </Link>
                    <Link
                      to="/privacy-policy"
                      className="text-sm text-[#3182ce] hover:underline flex items-center gap-2 group"
                    >
                      <ChevronRight className="w-4 h-4 text-[#A0AEC0] group-hover:text-white transition-colors" />
                      <span>Privacy Policy</span>
                    </Link>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
      <ConfirmNavigationDialog
        isOpen={blocker.state === "blocked"}
        title="Discard changes?"
        description="You have unsaved edits."
        primaryActionText="Save Changes"
        secondaryActionText="Discard"
        onPrimaryAction={async () => {
          if (handleSaveProfile) {
            await handleSaveProfile();
          }
          blocker.proceed?.();
        }}
        onSecondaryAction={() => {
          setHandle(initialHandle);
          setUserLocation(initialLocation);
          setGender(initialGender);
          setBio(initialBio);
          blocker.proceed?.();
        }}
        onDismiss={() => blocker.reset?.()}
      />
      {/* IMMERSIVE SETTINGS SEARCH OVERLAY */}
      <AnimatePresence>
        {isSearchActive && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed inset-0 bg-[#000000] z-[150] flex flex-col overflow-hidden"
          >
            {/* Search Header exactly modeled after screenshot */}
            <div className="px-4 pt-6 pb-4 flex items-center gap-3 w-full border-b border-white/5 bg-[#000000]">
              <div className="relative flex-1 bg-[#1C1C1E] rounded-xl flex items-center h-11 px-3.5 focus-within:ring-1 focus-within:ring-white/10 transition-all">
                <SearchIcon className="w-4 h-4 text-[#6c7283] shrink-0 mr-2.5" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-[16px] text-white outline-none placeholder-[#6C7283] font-medium"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-[12px] text-buildops-text-secondary hover:text-white px-2 font-bold font-mono py-1 rounded-md"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  setIsSearchActive(false);
                  setSearchQuery("");
                }}
                className="text-buildops-blue text-[16px] font-medium cursor-pointer shrink-0 px-1 transition-opacity active:opacity-60"
              >
                Cancel
              </button>
            </div>

            {/* Scrolling Body */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-5 bg-[#000000]">
              <div className="max-w-2xl mx-auto w-full">
                {!searchQuery ? (
                  <div className="space-y-4 text-center py-12 max-w-sm mx-auto">
                    <p className="text-[15px] text-[#6C7283]">
                      Type to search and filter settings.
                    </p>
                    <p className="text-[13px] text-[#6C7283]/60">
                      Try searching for theme, bio, active status, notifications, or privacy settings.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-[12px] uppercase tracking-wider text-[#6c7283] font-bold">
                        Search results ({matchedSearchResults.length})
                      </h3>
                    </div>

                    {matchedSearchResults.length > 0 ? (
                      <div className="space-y-2.5 pb-20">
                        {matchedSearchResults.map((result) => {
                          const ResultIcon = getSearchIconComponent(
                            result.iconName,
                          );
                          return (
                            <div
                              key={result.id}
                              onClick={() => {
                                setIsSearchActive(false);
                                setSearchQuery("");
                                if (result.id === "trash-bin") {
                                  navigate("/settings/" + result.tab, {
                                    state: { view: "trash" },
                                  });
                                } else {
                                  navigate("/settings/" + result.tab);
                                }
                              }}
                              className="flex items-center gap-4 bg-[#1C1C1E] border border-white/5 rounded-2xl p-4 hover:bg-[#252528] active:bg-[#2A2A2E] transition-colors cursor-pointer group"
                            >
                              <div className="w-10 h-10 rounded-xl bg-white/[0.03] flex items-center justify-center shrink-0 border border-white/5">
                                <ResultIcon className="w-[18px] h-[18px] text-white" />
                              </div>
                              <div className="flex-1">
                                <span className="text-[11px] font-bold tracking-wider text-buildops-blue uppercase">
                                  {result.category}
                                </span>
                                <h4 className="text-[15px] font-semibold text-white mt-0.5 group-hover:text-buildops-blue transition-colors">
                                  {result.title}
                                </h4>
                                <p className="text-[13px] text-[#8C92A3] mt-1 leading-relaxed">
                                  {result.description}
                                </p>
                              </div>
                              <ChevronRight className="w-5 h-5 text-[#6c7283] opacity-50 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-[#1C1C1E] rounded-2xl p-8 text-center border border-white/5 text-buildops-text-secondary">
                        <p className="text-[14px]">
                          No matches found for{" "}
                          <span className="text-white font-semibold">
                            "{searchQuery}"
                          </span>
                        </p>
                        <p className="text-[12px] text-[#6c7283] mt-2">
                          Try searching for theme, bio, notifications, or
                          privacy settings instead.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmNavigationDialog
        isOpen={showSignOutConfirm}
        title="Sign out?"
        description="Are you sure you want to log out of your account on this device?"
        primaryActionText="Sign out"
        secondaryActionText="Cancel"
        onPrimaryAction={async () => {
          try {
            setShowSignOutConfirm(false);
            await logout();
            toast.success("Successfully logged out");
            navigate("/");
          } catch (err: any) {
            toast.error(err.message || "Failed to log out");
          }
        }}
        onSecondaryAction={() => {
          setShowSignOutConfirm(false);
        }}
        onDismiss={() => setShowSignOutConfirm(false)}
      />
    </div>
  );
}
