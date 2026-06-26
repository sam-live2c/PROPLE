import {
  Github,
  Twitter,
  MapPin,
  Link as LinkIcon,
  Award,
  CheckCircle2,
  ChevronRight,
  LogOut,
  MoreVertical,
  AlertTriangle,
  Info,
  ArrowLeft,
  Flag,
  User,
  Users,
  Plus,
  Calendar,
  Settings,
  Lock,
  Hexagon,
  Loader2,
  Video,
  Chrome,
  Search,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, formatCount } from "@/src/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/src/contexts/AuthContext";
import { useSettings } from "@/src/contexts/SettingsContext";
import { useEffect, useState, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ProfileSkeleton } from "@/src/components/SkeletonLoader";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "@/src/lib/firebase";
import { UserActionModals } from "@/src/components/UserActionModals";
import { ProblemCard } from "@/src/components/ProblemCard";
import { renderTextWithMentions } from "@/src/lib/renderUtils";
import { toast } from "sonner";

export function Profile() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, loading: authLoading, logout, signInWithGoogle, signInAsGuest } = useAuth();

  const [profileUser, setProfileUser] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("Posts");
  const [isGuestLoggingIn, setIsGuestLoggingIn] = useState(false);
  const [isGoogleLoggingIn, setIsGoogleLoggingIn] = useState(false);

  const handleGoogleLogin = async () => {
    setIsGoogleLoggingIn(true);
    try {
      await signInWithGoogle();
      // Safe fallback if popup closes or auth fails without throwing
      setTimeout(() => {
        if (!auth.currentUser) {
          setIsGoogleLoggingIn(false);
        }
      }, 3000);
    } catch (e) {
      console.error(e);
      setIsGoogleLoggingIn(false);
    }
  };

  useEffect(() => {
    if (user && isGoogleLoggingIn) {
      setIsGoogleLoggingIn(false);
    }
  }, [user, isGoogleLoggingIn]);

  const handleGuestLogin = async () => {
    setIsGuestLoggingIn(true);
    try {
      await signInAsGuest();
    } catch (e) {
      console.error(e);
    } finally {
      setIsGuestLoggingIn(false);
    }
  };
  const { settings } = useSettings();

  useEffect(() => {
    if (!settings.developerMode && activeTab === "Builds") {
      setActiveTab("Posts");
    }
  }, [settings.developerMode, activeTab]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState<
    "none" | "about" | "report" | "stats"
  >("none");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const queryClient = useQueryClient();
  const targetUserId = id || user?.uid;

  // React Query for profileUser
  const { data: profileUserData, isLoading: loadingProfileUser } = useQuery({
    queryKey: ["profileUser", targetUserId],
    queryFn: async () => {
      if (!targetUserId) return null;
      if (id) {
        let userDoc = await getDoc(doc(db, "users", id));
        if (!userDoc.exists()) {
          const handleQuery = query(
            collection(db, "users"),
            where("handle", "==", id),
          );
          const handleDocs = await getDocs(handleQuery);
          if (!handleDocs.empty) {
            userDoc = handleDocs.docs[0];
          }
        }
        if (userDoc.exists()) {
          return { id: userDoc.id, ...userDoc.data() };
        } else {
          return {
            id,
            displayName: "Unknown Builder",
            photoURL: null,
            notFound: true,
          };
        }
      } else if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          return { id: user.uid, ...user, ...userDoc.data() };
        } else {
          return user;
        }
      }
      return null;
    },
    enabled: !!targetUserId,
    staleTime: 1000 * 5,
    gcTime: 1000 * 60 * 10,
  });

  const resolvedTargetId = (profileUserData as any)?.id || (profileUserData as any)?.uid || targetUserId;

  // React Query for posts
  const { data: rawUserPosts, isLoading: loadingPosts } = useQuery({
    queryKey: ["profilePosts", resolvedTargetId],
    queryFn: async () => {
      if (!resolvedTargetId) return [];
      const q = query(
        collection(db, "posts"),
        where("authorId", "==", resolvedTargetId),
        limit(20),
      );
      const snap = await getDocs(q);
      const dbPosts = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p: any) => p.status !== "trashed");
      
      return [...dbPosts].sort((a: any, b: any) => {
        const timeA =
          typeof a.createdAt === "string"
            ? new Date(a.createdAt).getTime()
            : a.createdAt?.toMillis() || 0;
        const timeB =
          typeof b.createdAt === "string"
            ? new Date(b.createdAt).getTime()
            : b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });
    },
    enabled: !!resolvedTargetId,
    staleTime: 1000 * 5,
    gcTime: 1000 * 60 * 10,
  });

  // React Query for follow counts and status
  const { data: followDetails, isLoading: loadingFollow } = useQuery({
    queryKey: ["profileFollowDetails", resolvedTargetId, user?.uid],
    queryFn: async () => {
      if (!resolvedTargetId) return null;
      let followersCount = 0;
      let followingCount = 0;
      let isFollowing = false;

      const followersQuery = query(
        collection(db, "followers"),
        where("followingId", "==", resolvedTargetId),
      );
      const followingQuery = query(
        collection(db, "followers"),
        where("followerId", "==", resolvedTargetId),
      );

      const [followersSnap, followingSnap] = await Promise.all([
        getDocs(followersQuery),
        getDocs(followingQuery),
      ]);

      followersCount = followersSnap.docs.length;
      followingCount = followingSnap.docs.length;

      if (user && user.uid !== resolvedTargetId) {
        const followDoc = await getDoc(
          doc(db, "followers", `${user.uid}_${resolvedTargetId}`),
        );
        isFollowing = followDoc.exists();
      }

      return { followersCount, followingCount, isFollowing };
    },
    enabled: !!resolvedTargetId,
    staleTime: 1000 * 5,
    gcTime: 1000 * 60 * 10,
  });

  // Redirect to search page if profile is not found
  useEffect(() => {
    if (profileUserData && (profileUserData as any).notFound) {
      toast.error(`User @${id} not found. Searching for "${id}" instead.`);
      navigate(`/search?q=${encodeURIComponent(id || "")}`, { replace: true });
    }
  }, [profileUserData, id, navigate]);

  // Set local state synchronizations
  useEffect(() => {
    if (profileUserData) {
      setProfileUser(profileUserData);
    }
  }, [profileUserData]);

  useEffect(() => {
    if (rawUserPosts) {
      setUserPosts(rawUserPosts);
    }
  }, [rawUserPosts]);

  useEffect(() => {
    if (followDetails) {
      setFollowersCount(followDetails.followersCount);
      setFollowingCount(followDetails.followingCount);
      setIsFollowing(followDetails.isFollowing);
    }
  }, [followDetails]);

  const loading =
    authLoading ||
    loadingProfileUser ||
    loadingPosts ||
    loadingFollow ||
    (profileUserData && !profileUser);

  const handleFollow = async () => {
    if (!user || !profileUser) return;
    if (user.isAnonymous) {
      toast.error("Guest users cannot follow other users.");
      return;
    }
    const targetId = profileUser.id || profileUser.uid;
    const followId = `${user.uid}_${targetId}`;
    const followRef = doc(db, "followers", followId);

    try {
      if (isFollowing) {
        setIsFollowing(false);
        setFollowersCount((prev) => Math.max(0, prev - 1));
        await deleteDoc(followRef);
      } else {
        setIsFollowing(true);
        setFollowersCount((prev) => prev + 1);
        await setDoc(followRef, {
          followerId: user.uid,
          followingId: targetId,
          createdAt: serverTimestamp(),
        });

        try {
          await setDoc(doc(collection(db, "notifications")), {
            userId: targetId,
            fromUserId: user.uid,
            type: "follow",
            msg: `${user.displayName || user.email?.split("@")[0] || "A user"} started following you.`,
            read: false,
            createdAt: serverTimestamp(),
          });
        } catch (e) {}
      }
      queryClient.invalidateQueries({ queryKey: ["profileFollowDetails", targetId, user?.uid] });
    } catch (err) {
      console.error(err);
      if (followDetails) {
        setIsFollowing(followDetails.isFollowing);
        setFollowersCount(followDetails.followersCount);
      }
    }
  };

  const handleSignOut = async () => {
    localStorage.removeItem("recentSearches");
    await logout();
    navigate("/");
  };

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (!profileUser) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
        <div className="relative overflow-hidden w-full max-w-sm rounded-none border border-buildops-border bg-buildops-card p-8 text-center shadow-lg flex flex-col items-center animate-in fade-in duration-350">
          
          {/* Authentic and beautiful reaction animation overlay for guest processing */}
          <AnimatePresence>
            {isGuestLoggingIn && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-buildops-card flex flex-col items-center justify-center p-8 z-20"
              >
                <div className="relative w-12 h-12 flex items-center justify-center mb-6">
                  {/* Outer spinning ring */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    className="absolute inset-0 border border-t-buildops-blue border-r-transparent border-b-transparent border-l-transparent rounded-full"
                  />
                  {/* Inner opposite spinning ring */}
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="absolute inset-1 border border-b-buildops-blue/40 border-t-transparent border-r-transparent border-l-transparent rounded-full"
                  />
                  <User className="w-5 h-5 text-buildops-blue animate-pulse" />
                </div>
                
                <h3 className="text-xs uppercase tracking-widest font-mono font-bold text-white mb-2">
                  Authenticating Guest
                </h3>
                
                {/* Custom simulated loading progress line */}
                <div className="h-0.5 w-24 bg-buildops-bg border border-buildops-border overflow-hidden mb-3 relative">
                  <motion.div
                    initial={{ left: "-100%" }}
                    animate={{ left: "100%" }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                    className="absolute top-0 bottom-0 w-1/2 bg-buildops-blue"
                  />
                </div>
                
                <span className="text-[10px] font-mono text-buildops-text-secondary leading-relaxed uppercase tracking-wider text-center">
                  Configuring secure temporary session...
                </span>
              </motion.div>
            )}
          </AnimatePresence>


          <div className="w-12 h-12 rounded-full border border-buildops-border bg-buildops-bg flex items-center justify-center mb-6">
            <User className="w-5 h-5 text-buildops-blue" />
          </div>
          
          <h2 className="text-lg font-bold text-white mb-2 uppercase tracking-wide font-mono">
            Access Profile
          </h2>
          <p className="text-[#8e9aa8] text-xs mb-8 leading-relaxed max-w-[270px]">
            Sign in to personalize your portfolio, track stats, and publish challenges.
          </p>

          <div className="w-full flex flex-col gap-4">
            <button
              onClick={handleGoogleLogin}
              disabled={isGuestLoggingIn || isGoogleLoggingIn}
              className="w-full flex items-center justify-center gap-3 text-xs uppercase tracking-wider font-semibold font-mono text-white bg-buildops-bg border border-buildops-border py-3 px-4 rounded-none hover:bg-buildops-border/30 hover:border-buildops-text-secondary transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGoogleLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 text-buildops-blue animate-spin" />
                  <span>LOGGING IN...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.08H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.92l2.85-2.22-.03-.6z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.08l3.66 2.84c.87-2.6 3.3-4.54 6.16-4.54z" fill="#EA4335"/>
                  </svg>
                  <span>SIGN IN WITH GOOGLE</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-3 my-0.5 w-full">
              <div className="h-px bg-buildops-border/60 flex-1"></div>
              <span className="text-[10px] font-mono text-[#5c6e82] select-none uppercase tracking-wider">or</span>
              <div className="h-px bg-buildops-border/60 flex-1"></div>
            </div>

            <button
              onClick={handleGuestLogin}
              disabled={isGuestLoggingIn}
              className="w-full flex items-center justify-center gap-3 text-xs uppercase tracking-wider font-semibold font-mono text-buildops-text-secondary bg-[rgba(255,255,255,0.01)] border border-buildops-border/60 hover:bg-buildops-border/30 hover:text-white hover:border-buildops-text-secondary py-3 px-4 rounded-none transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGuestLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 text-buildops-blue animate-spin" />
                  <span>LOGGING IN...</span>
                </>
              ) : (
                <>
                  <User className="w-4 h-4 text-buildops-text-secondary" />
                  <span>guest login</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isOwnProfile =
    !id ||
    (user && user.uid === profileUser.id) ||
    (user && user.uid === profileUser.uid);

  const tabs = settings.developerMode ? ["Posts", "Builds"] : ["Posts"];

  return (
    <div className="w-full max-w-5xl mx-auto pb-20 md:pb-8 relative">
      <div className="sticky top-0 z-40 bg-[rgba(5,8,15,0.92)] backdrop-blur-xl h-[56px] border-b border-[rgba(255,255,255,0.05)] flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-buildops-text-secondary hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-medium text-buildops-text">Profile</h1>
        </div>
        <div className="flex items-center gap-2" ref={menuRef}>
          <button
            onClick={() => navigate("/search")}
            className="p-2 rounded-full hover:bg-buildops-card transition-colors text-buildops-text-secondary hover:text-buildops-text cursor-pointer"
            title="Search"
          >
            <Search className="w-5 h-5" />
          </button>
          {isOwnProfile ? (
            <button
              onClick={() => navigate("/settings")}
              className="p-2 rounded-full hover:bg-buildops-card transition-colors text-buildops-text-secondary hover:text-buildops-text"
            >
              <Settings className="w-5 h-5" />
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors text-buildops-text-secondary hover:text-buildops-text cursor-pointer"
                title="Options"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-buildops-card border border-buildops-border rounded-xl shadow-xl z-50 py-1.5 text-left font-sans animate-fade-in">
                  <button
                    onClick={() => {
                      setModalOpen("report");
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2.5 cursor-pointer border-0 bg-transparent font-medium"
                  >
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    Report
                  </button>
                  <button
                    onClick={() => {
                      setModalOpen("about");
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-buildops-text hover:bg-white/5 transition-colors flex items-center gap-2.5 cursor-pointer border-0 bg-transparent font-medium"
                  >
                    <Info className="w-4 h-4 text-buildops-text-secondary" />
                    About
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-0.5 px-4 sm:px-6 pt-2 pb-0">
        <UserActionModals
          user={profileUser}
          isOpen={modalOpen}
          onClose={() => setModalOpen("none")}
        />

        {/* Profile Header */}
        <div className="flex flex-col md:flex-row gap-3 md:gap-5 items-start">
          <div className="w-[88px] h-[88px] sm:w-[124px] sm:h-[124px] rounded-full border border-buildops-border bg-buildops-bg flex items-center justify-center shrink-0 overflow-hidden">
            {profileUser.photoURL ? (
              <img
                src={profileUser.photoURL}
                alt={profileUser.displayName || "User"}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-12 h-12 text-buildops-text-secondary" />
            )}
          </div>

          <div className="flex-1 w-full">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-0.5">
              <div className="space-y-0.5 flex-1">
                <div>
                  <h1 className="text-[27.8px] sm:text-[34.6px] font-bold text-buildops-text mb-0.5 leading-tight">
                    {profileUser.displayName ||
                      profileUser.handle ||
                      "Anonymous Explorer"}
                  </h1>
                  {profileUser.handle && (
                    <p className="text-buildops-text-secondary text-[16.3px] font-medium">
                      @{profileUser.handle}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  {profileUser.bio ? (
                    <div>
                      <p className="text-buildops-text text-[14.7px] sm:text-[16.8px] whitespace-pre-wrap">
                        {renderTextWithMentions(
                          profileUser.bio,
                          settings?.markdownRendering ?? false
                        )}
                      </p>
                      {isOwnProfile && (
                        <button
                          onClick={() => navigate("/settings/profile")}
                          className="text-xs text-buildops-blue hover:underline cursor-pointer mt-1"
                        >
                          edit bio
                        </button>
                      )}
                    </div>
                  ) : (
                    isOwnProfile && (
                      <button
                        onClick={() => navigate("/settings/profile")}
                        className="text-buildops-blue font-bold hover:underline cursor-pointer text-sm flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        add bio
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!isOwnProfile && (
                  <button
                    onClick={handleFollow}
                    className={cn(
                      "self-start px-6 py-2 rounded-md border text-sm font-bold transition-colors shadow-lg",
                      isFollowing
                        ? "border-buildops-border bg-buildops-card text-buildops-text hover:bg-buildops-bg"
                        : "border-buildops-blue bg-buildops-blue text-white hover:bg-buildops-blue/90 shadow-buildops-blue/20",
                    )}
                  >
                    {isFollowing ? "Following" : "Follow"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Metadata and Stats row - split with clean line break, aligned styled captions */}
        <div className="space-y-1.5 text-[14.2px] sm:text-[16.3px] text-buildops-text-secondary mt-1.5 mb-1.5 pb-1">
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
            {(!profileUser.locationPrivate || isOwnProfile) && (
              <span className="flex items-center gap-1">
                <MapPin className="w-[17px] h-[17px]" /> 
                {profileUser.location || "Earth"}
                {isOwnProfile && profileUser.locationPrivate && (
                  <Lock className="w-[15px] h-[15px] text-buildops-text-secondary/60 ml-0.5" />
                )}
              </span>
            )}
            {profileUser?.gender &&
              profileUser.gender !== "Prefer not to say" && 
              (!profileUser.genderPrivate || isOwnProfile) && (
                <span className="flex items-center gap-1">
                  <User className="w-[17px] h-[17px]" /> 
                  {profileUser.gender}
                  {isOwnProfile && profileUser.genderPrivate && (
                    <Lock className="w-[15px] h-[15px] text-buildops-text-secondary/60 ml-0.5" />
                  )}
                </span>
              )}
            {profileUser?.website && (
              <span className="flex items-center gap-1">
                <LinkIcon className="w-[17px] h-[17px]" /> {profileUser.website}
              </span>
            )}
            {profileUser?.createdAt && (
              <span className="flex items-center gap-1">
                <Calendar className="w-[17px] h-[17px]" />
                Joined{" "}
                {typeof profileUser.createdAt === "string"
                  ? new Date(profileUser.createdAt).toLocaleDateString(
                      "en-US",
                      { month: "long", year: "numeric" },
                    )
                  : profileUser.createdAt?.toDate
                    ? profileUser.createdAt
                        .toDate()
                        .toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })
                    : new Date(profileUser.createdAt).toLocaleDateString(
                        "en-US",
                        { month: "long", year: "numeric" },
                      )}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
            <span className="flex items-center gap-1">
              <Users className="w-[17px] h-[17px]" />{" "}
              <strong>{formatCount(followersCount)}</strong> Followers
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-[17px] h-[17px]" />{" "}
              <strong>{formatCount(followingCount)}</strong> Following
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-col px-1 sm:px-2 pt-0">
        {/* Tabs */}
        <div className="flex border-b border-buildops-border overflow-x-auto no-scrollbar mb-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap",
                activeTab === tab
                  ? "border-buildops-blue text-buildops-blue"
                  : "border-transparent text-buildops-text-secondary hover:text-buildops-text hover:border-buildops-text-secondary",
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Sub-header */}
        <div className="flex items-center justify-between px-2 mb-2">
          <h2 className="text-[13px] font-bold text-buildops-text-secondary uppercase tracking-widest">
            {activeTab === "Posts" && "Recent Posts"}
            {activeTab === "Builds" && "Published Builds"}
          </h2>
          {isOwnProfile && activeTab === "Builds" && userPosts.filter((p) => p.type === "build").length > 0 && (
            <button
              onClick={() => navigate("/builds/new")}
              className="p-1 px-2 border border-buildops-border bg-buildops-card text-buildops-text hover:bg-buildops-blue hover:border-buildops-blue hover:text-white rounded transition-colors"
              title="Post Build"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}

        </div>

        {/* Content */}
        <div className="space-y-4">
          {activeTab === "Posts" &&
          userPosts.filter((p) => p.type !== "build").length > 0 ? (
            <div className="divide-y divide-buildops-border relative">
              {userPosts
                .filter((p) => p.type !== "build")
                .map((post) => (
                  <ProblemCard key={post.id} post={post} />
                ))}
            </div>
          ) : activeTab === "Builds" &&
            userPosts.filter((p) => p.type === "build").length > 0 ? (
            <div className="divide-y divide-buildops-border relative">
              {userPosts
                .filter((p) => p.type === "build")
                .map((post) => (
                  <ProblemCard key={post.id} post={post} />
                ))}
            </div>
          ) : isOwnProfile && activeTab === "Builds" ? (
            <div className="py-12 flex flex-col items-center text-center max-w-md mx-auto border border-dashed border-buildops-border rounded-xl px-4">
              <Plus className="w-12 h-12 text-buildops-border mb-4" />
              <h3 className="text-xl font-bold text-buildops-text mb-2">
                No builds published yet.
              </h3>
              <div className="text-sm text-buildops-text-secondary mb-8 space-y-1">
                <p>Showcase your projects to the community.</p>
              </div>
              <button
                onClick={() => navigate("/builds/new")}
                className="flex items-center gap-2 rounded-md bg-buildops-text px-6 py-2.5 text-sm font-semibold text-buildops-bg transition-colors hover:bg-white"
              >
                <Plus className="h-4 w-4" />
                Post your first Build
              </button>
            </div>
          ) : isOwnProfile && activeTab === "Posts" ? (
            <div className="py-12 flex flex-col items-center text-center max-w-md mx-auto border border-dashed border-buildops-border rounded-xl px-4">
              <Plus className="w-12 h-12 text-buildops-border mb-4" />
              <h3 className="text-xl font-bold text-buildops-text mb-2">
                No posts published yet.
              </h3>
              <div className="text-sm text-buildops-text-secondary mb-8 space-y-1">
                <p>Showcase your challenges to the community.</p>
              </div>
              <button
                onClick={() => navigate("/problems/new")}
                className="flex items-center gap-2 rounded-md bg-buildops-text px-6 py-2.5 text-sm font-semibold text-buildops-bg transition-colors hover:bg-white"
              >
                <Plus className="h-4 w-4" />
                Post your first Post
              </button>
            </div>
          ) : (
            <div className="p-8 text-center border border-dashed border-buildops-border rounded-xl">
              <p className="text-buildops-text-secondary text-sm">
                Nothing here yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Dummy Icon for the comment card
function VideoIcon(props: any) {
  return <Video {...props} />;
}
