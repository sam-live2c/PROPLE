import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Search as SearchIcon,
  ArrowLeft,
  ArrowUpLeft,
  SlidersHorizontal,
  ThumbsUp,
  CheckCircle2,
  Play,
  MessageSquare,
  Plus,
  GitBranch,
  Github,
  Clock,
  ChevronDown,
  Compass,
  User,
  X,
  TrendingUp,
  Hash,
} from "lucide-react";
import {
  collection,
  query,
  limit,
  getDocs,
  where,
  orderBy,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { ref as dbRef, onValue } from "firebase/database";
import { db, rtdb } from "@/src/lib/firebase";
import { useAuth } from "@/src/contexts/AuthContext";
import { meiliClient, isMeilisearchConfigured } from "@/src/lib/meilisearch";
import { cn, formatCount } from "@/src/lib/utils";
import { CardSkeleton } from "@/src/components/SkeletonLoader";
import { renderTextWithMentions } from "@/src/lib/renderUtils";
import { useSettings } from "@/src/contexts/SettingsContext";
import { motion } from "motion/react";
import { sessionCache } from "@/src/lib/sessionCache";
import { toast } from "sonner";
import {
  syncSearchToRtdb,
  getHotSearchesAndTagsFromRtdb,
  getRecentSearchesFromRtdb,
} from "@/src/lib/rtdb-sync";

function SearchFollowButton({ targetId }: { targetId: string }) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.uid === targetId) {
      setLoading(false);
      return;
    }
    const checkFollow = async () => {
      try {
        const followDoc = await getDoc(
          doc(db, "followers", `${user.uid}_${targetId}`),
        );
        setIsFollowing(followDoc.exists());
      } catch (e: any) {
        if (e?.message?.includes("offline") || e?.code === "unavailable") {
          console.warn(
            "Firestore client is offline. Search follow status loaded in offline mode.",
          );
        } else {
          console.warn("Failed to check follow status:", e);
        }
      } finally {
        setLoading(false);
      }
    };
    checkFollow();
  }, [user, targetId]);

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      alert("Please sign in to follow builders");
      return;
    }
    if (user.uid === targetId) return;

    const followId = `${user.uid}_${targetId}`;
    const followRef = doc(db, "followers", followId);

    // Optimistic UI update
    const previousState = isFollowing;
    setIsFollowing(!isFollowing);

    try {
      if (previousState) {
        await deleteDoc(followRef);
      } else {
        await setDoc(followRef, {
          followerId: user.uid,
          followingId: targetId,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
      setIsFollowing(previousState); // Revert on failure
    }
  };

  if (!user || user.uid === targetId || loading) return null;

  return null;
}

function SearchLikeButton({
  postId,
  authorId,
  initialLikesCount,
}: {
  postId: string;
  authorId?: string;
  initialLikesCount: number;
}) {
  const { user } = useAuth();
  const [hasLiked, setHasLiked] = useState(false);
  const [likes, setLikes] = useState(initialLikesCount);
  const [isLiking, setIsLiking] = useState(false);

  useEffect(() => {
    if (!user) {
      setHasLiked(false);
      return;
    }
    const checkLiked = async () => {
      try {
        const likeId = `${postId}_${user.uid}`;
        const likeRef = doc(db, "likes", likeId);
        const snap = await getDoc(likeRef);
        setHasLiked(snap.exists());
      } catch (e) {
        console.error(e);
      }
    };
    checkLiked();
  }, [postId, user]);

  useEffect(() => {
    setLikes(initialLikesCount);
  }, [initialLikesCount]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user) {
      toast.error("Please sign in to like posts.");
      return;
    }

    if (isLiking) return;
    setIsLiking(true);

    const newHasLiked = !hasLiked;
    setHasLiked(newHasLiked);
    setLikes((prev) => (newHasLiked ? prev + 1 : Math.max(0, prev - 1)));

    const likeId = `${postId}_${user.uid}`;
    try {
      const likeRef = doc(db, "likes", likeId);
      const postRef = doc(db, "posts", postId);

      const postSnap = await getDoc(postRef);
      if (!postSnap.exists()) {
        toast.error("This post no longer exists.");
        setHasLiked(!newHasLiked);
        setLikes((prev) => (!newHasLiked ? prev + 1 : Math.max(0, prev - 1)));
        setIsLiking(false);
        return;
      }

      const batch = writeBatch(db);
      const authorRef = authorId ? doc(db, "users", authorId) : null;

      if (!newHasLiked) {
        // Dislike
        batch.delete(likeRef);
        batch.update(postRef, {
          "stats.likesCount": increment(-1),
          updatedAt: serverTimestamp(),
        });
        if (authorRef && authorId !== user.uid) {
          batch.set(
            authorRef,
            {
              stats: { proofScore: increment(-1) },
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        }
      } else {
        // Like
        batch.set(likeRef, {
          userId: user.uid,
          postId: postId,
          createdAt: serverTimestamp(),
        });
        batch.update(postRef, {
          "stats.likesCount": increment(1),
          updatedAt: serverTimestamp(),
        });
        if (authorRef && authorId !== user.uid) {
          batch.set(
            authorRef,
            {
              stats: { proofScore: increment(1) },
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        }
      }

      await batch.commit();
    } catch (err) {
      console.error("Failed to update like:", err);
      // Rollback
      setHasLiked(!newHasLiked);
      setLikes((prev) => (!newHasLiked ? prev + 1 : Math.max(0, prev - 1)));
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLiking(false);
    }
  };

  return (
    <button
      onClick={handleLike}
      className={cn(
        "flex items-center gap-1.5 text-[13px] transition-colors group cursor-pointer",
        hasLiked
          ? "text-buildops-blue"
          : "text-buildops-text-secondary hover:text-buildops-blue",
      )}
    >
      <motion.div
        whileTap={{ scale: 0.8 }}
        animate={hasLiked ? { scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 0.3 }}
        className={cn(
          "p-1.5 rounded-full transition-colors",
          hasLiked ? "bg-buildops-blue/10" : "group-hover:bg-buildops-blue/10",
        )}
      >
        <ThumbsUp className={cn("w-4 h-4", hasLiked ? "fill-current" : "")} />
      </motion.div>
      <span className={cn(hasLiked ? "font-semibold text-buildops-blue" : "")}>
        {formatCount(likes)}
      </span>
    </button>
  );
}

export function Search() {
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("q") || "";
  const [searchInput, setSearchInput] = useState(searchQuery);
  const navigate = useNavigate();
  const { settings } = useSettings();

  const [activeTab, setActiveTab] = useState("All");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [suggestions, setSuggestions] = useState<{
    users: any[];
    posts: any[];
  }>({ users: [], posts: [] });
  const [recentSearches, setRecentSearches] = useState<
    { id: string; query: string }[]
  >(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("recentSearches") || "[]");
      if (stored.length > 0 && typeof stored[0] === "string") {
        return stored.map((q: string) => ({ id: q, query: q }));
      }
      return stored;
    } catch {
      return [];
    }
  });
  const { user, loading: authLoading } = useAuth();
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const lastRegisteredSearchRef = useRef<{
    query: string;
    userId: string | null;
  }>({ query: "", userId: null });

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);

  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableLevels, setAvailableLevels] = useState<string[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);

  const [sortBy, setSortBy] = useState("Most Relevant");

  useEffect(() => {
    if (searchQuery) {
      setSearchInput(searchQuery);
    }
  }, [searchQuery]);

  useEffect(() => {
    // We only fetch suggestions here, no auto-navigate anymore.
  }, [searchInput, searchQuery, navigate]);

  useEffect(() => {
    if (searchInput.trim() && searchInput !== searchQuery) {
      const q = searchInput.trim();
      const lowerQuery = q.toLowerCase();
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((res) => {
          if (!res.ok) throw new Error("API error");
          const contentType = res.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            throw new Error("Non-JSON response");
          }
          return res.json();
        })
        .then((data) => {
          setSuggestions({
            users: data.users.slice(0, 3),
            posts: data.posts.slice(0, 4),
          });
        })
        .catch((err) => {
          console.warn(
            "Backend suggestions API failed, falling back to direct Firestore suggestions:",
            err,
          );
          const usersRef = collection(db, "users");
          getDocs(query(usersRef, limit(100)))
            .then((usersSnap) => {
              const matchedUsers = usersSnap.docs
                .map((d) => ({ id: d.id, ...(d.data() as object) }))
                .filter((u: any) => {
                  const dn = (u.displayName || "").toLowerCase();
                  const un = (u.username || u.handle || "").toLowerCase();
                  return dn.includes(lowerQuery) || un.includes(lowerQuery);
                })
                .slice(0, 3);

              const postsRef = collection(db, "posts");
              getDocs(query(postsRef, limit(100)))
                .then((postsSnap) => {
                  const matchedPosts = postsSnap.docs
                    .map((d) => ({ id: d.id, ...(d.data() as object) }))
                    .filter(
                      (p: any) =>
                        p.status !== "trashed" &&
                        (p.title || "").toLowerCase().includes(lowerQuery),
                    )
                    .slice(0, 4);

                  setSuggestions({
                    users: matchedUsers,
                    posts: matchedPosts,
                  });
                })
                .catch(() => {
                  setSuggestions({ users: matchedUsers, posts: [] });
                });
            })
            .catch(() => {
              setSuggestions({ users: [], posts: [] });
            });
        });
    } else {
      setSuggestions({ users: [], posts: [] });
    }
  }, [searchInput, searchQuery]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setHistoryLoaded(true);
      return;
    }

    const cacheKey = `search_history_${user.uid}`;
    if (sessionCache.has(cacheKey)) {
      setRecentSearches(sessionCache.get(cacheKey, []));
      setHistoryLoaded(true);
      return;
    }

    const fetchHistory = async () => {
      try {
        let cloudHistory: { id: string; query: string; createdAt: number }[] =
          [];

        // Try fetching from Realtime Database first (fast, cost-effective)
        try {
          const rtdbHistory = await getRecentSearchesFromRtdb(user.uid);
          if (rtdbHistory && rtdbHistory.length > 0) {
            cloudHistory = rtdbHistory;
          }
        } catch (rtdbErr) {
          console.warn(
            "RTDB history fetch failed, falling back to Firestore:",
            rtdbErr,
          );
        }

        // Fallback to Firestore if RTDB was empty/failed
        if (cloudHistory.length === 0) {
          const q = query(
            collection(db, "searchHistory"),
            where("userId", "==", user.uid),
          );
          const snap = await getDocs(q);
          const searches = snap.docs.map((d) => ({
            id: d.id,
            query: d.data().query,
            createdAt: d.data().createdAt?.toMillis?.() || 0,
          }));
          searches.sort((a, b) => b.createdAt - a.createdAt);
          cloudHistory = searches;
        }

        // Merge cloud history with previous state (e.g. from local storage) rather than wiping it
        if (cloudHistory.length > 0) {
          setRecentSearches((prev) => {
            const merged = [...cloudHistory, ...prev];
            const unique = Array.from(
              new Map(
                merged.map((item) => [item.query.toLowerCase(), item]),
              ).values(),
            );
            const finalHistory = unique.slice(0, 5);
            try {
              localStorage.setItem(
                "recentSearches",
                JSON.stringify(finalHistory),
              );
            } catch (e) {}
            sessionCache.set(cacheKey, finalHistory);
            return finalHistory;
          });
        } else {
          sessionCache.set(cacheKey, recentSearches);
        }
      } catch (err) {
        console.error("Failed to fetch search history", err);
      } finally {
        setHistoryLoaded(true);
      }
    };
    fetchHistory();
  }, [user, authLoading]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const term = searchQuery.trim();
      if (
        lastRegisteredSearchRef.current.query === term &&
        lastRegisteredSearchRef.current.userId === (user?.uid || null)
      ) {
        return;
      }
      lastRegisteredSearchRef.current = {
        query: term,
        userId: user?.uid || null,
      };

      const newSearch = { id: term, query: term };
      setRecentSearches((prev) => {
        const filtered = prev.filter(
          (s) => s.query.toLowerCase() !== term.toLowerCase(),
        );
        const updated = [newSearch, ...filtered].slice(0, 5);
        try {
          localStorage.setItem("recentSearches", JSON.stringify(updated));
        } catch (e) {}
        if (user) {
          sessionCache.set(`search_history_${user.uid}`, updated);
        }
        return updated;
      });

      // Sync to Realtime Database for real-time count metrics
      syncSearchToRtdb(user?.uid || null, term).catch(console.error);

      if (user) {
        try {
          const historyRef = doc(collection(db, "searchHistory"));
          setDoc(historyRef, {
            userId: user.uid,
            query: term,
            createdAt: serverTimestamp(),
          }).catch(console.error);
        } catch (err) {
          console.error("Failed to save search to history", err);
        }
      }
    }
  }, [searchQuery, user]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchInput.trim())}`);
    } else {
      navigate(`/search`);
    }
  };

  const tabs = ["All", "Posts", "Builds", "Users"];

  const [trendingTags, setTrendingTags] = useState<string[]>([]);
  const [hotSearches, setHotSearches] = useState<string[]>([]);
  const [trendsLoaded, setTrendsLoaded] = useState(false);
  const [longPressedSearchId, setLongPressedSearchId] = useState<string | null>(
    null,
  );
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (longPressedSearchId) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [longPressedSearchId]);

  const handleSearchPressStart = (searchId: string) => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      setLongPressedSearchId(searchId);
    }, 500);
  };

  const handleSearchPressEnd = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }
  };

  type SuggestionItem =
    | { type: "text"; text: string; isHistory: boolean }
    | { type: "user"; user: any };

  const unifiedSuggestions = useMemo(() => {
    const list: SuggestionItem[] = [];
    const term = searchInput.trim().toLowerCase();
    if (!term) return list;

    const seen = new Set<string>();
    const seenUsers = new Set<string>();

    const addTextSuggestion = (text: string, isHistory: boolean) => {
      if (!text) return;
      const cleanText = text.trim();
      const lower = cleanText.toLowerCase();
      if (!lower || seen.has(lower)) return;
      seen.add(lower);
      list.push({ type: "text", text: cleanText.toLowerCase(), isHistory });
    };

    // 1. History matches
    const historyMatches = recentSearches.filter((r) =>
      r.query.toLowerCase().includes(term),
    );
    // Prioritize history that starts with the term
    historyMatches
      .filter((r) => r.query.toLowerCase().startsWith(term))
      .forEach((r) => addTextSuggestion(r.query, true));

    // 2. Exact query typed
    if (!seen.has(term)) {
      list.splice(
        historyMatches.filter((r) => r.query.toLowerCase().startsWith(term))
          .length,
        0,
        { type: "text", text: term, isHistory: false },
      );
      seen.add(term);
    }

    // 3. Extracted user suggestions from API
    suggestions.users.forEach((u) => {
      if (u.id && !seenUsers.has(u.id)) {
        const dn = (u.displayName || "").toLowerCase();
        const un = (u.username || u.handle || "").toLowerCase();
        if (
          dn.startsWith(term) ||
          un.startsWith(term) ||
          dn.split(" ").some((w) => w.startsWith(term))
        ) {
          seenUsers.add(u.id);
          list.push({ type: "user", user: u });
          // also mark displayName as seen so text suggestion doesn't repeat it
          seen.add(dn);
        }
      }
    });

    // 4. Extracted posts suggestions
    suggestions.posts.forEach((p) => {
      if (p.title && p.title.toLowerCase().includes(term)) {
        addTextSuggestion(p.title, false);
      }
    });

    return list.slice(0, 10);
  }, [searchInput, suggestions, recentSearches]);

  useEffect(() => {
    // 1. Live subscriber on searchCounts (Realtime Hot Searches)
    const searchCountsRef = dbRef(rtdb, "searchCounts");
    const unsubscribeSearches = onValue(
      searchCountsRef,
      (snapshot) => {
        const data = snapshot.val();
        const rawQueries: string[] = [];
        if (data) {
          const sortedQueries = Object.values(data)
            .filter(
              (item: any) => item && typeof item === "object" && item.query,
            )
            .sort(
              (a: any, b: any) =>
                (b.scale || b.count || 0) - (a.scale || a.count || 0),
            )
            .map((item: any) => item.query);
          rawQueries.push(...sortedQueries);
        }

        const fallbackQueries = [
          "builds",
          "software",
          "deploy",
          "engineering",
          "startup",
          "projects",
          "bugs",
          "solutions",
        ];
        rawQueries.push(...fallbackQueries);

        const finalQueries: string[] = [];
        const seen = new Set<string>();

        for (const q of rawQueries) {
          const trimmed = q.trim();
          if (!trimmed) continue;
          const lower = trimmed.toLowerCase();
          if (!seen.has(lower)) {
            seen.add(lower);
            finalQueries.push(trimmed);
          }
        }
        setHotSearches(finalQueries.slice(0, 3));
      },
      (error) => {
        console.warn("RTDB searchCounts listen fail:", error);
      },
    );

    // 2. Live subscriber on tagCounts (Realtime Hot Tags)
    const tagCountsRef = dbRef(rtdb, "tagCounts");
    const unsubscribeTags = onValue(
      tagCountsRef,
      (snapshot) => {
        const data = snapshot.val();
        const rawTags: string[] = [];
        if (data) {
          const sortedTags = Object.values(data)
            .filter((item: any) => item && typeof item === "object" && item.tag)
            .sort(
              (a: any, b: any) =>
                (b.scale || b.count || 0) - (a.scale || a.count || 0),
            )
            .map((item: any) => item.tag);

          const formattedTags = sortedTags.map((tag) => {
            const t = tag.trim().toLowerCase();
            if (
              t === "ai" ||
              t === "iot" ||
              t === "it" ||
              t === "api" ||
              t === "ui" ||
              t === "ux"
            )
              return t.toUpperCase();
            return t
              .split(/[_-]/)
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ");
          });
          rawTags.push(...formattedTags);
        }

        const fallbackTags = [
          "Software",
          "Build",
          "Deployment",
          "Database",
          "AI",
          "Cloud",
          "Web",
          "Design",
          "Testing",
          "Security",
        ];
        rawTags.push(...fallbackTags);

        const finalTags: string[] = [];
        const seen = new Set<string>();
        for (const t of rawTags) {
          const trimmed = t.trim();
          if (!trimmed) continue;
          const lower = trimmed.toLowerCase();
          if (!seen.has(lower)) {
            seen.add(lower);
            finalTags.push(trimmed);
          }
        }
        setTrendingTags(finalTags.slice(0, 2));
        setTrendsLoaded(true);
      },
      (error) => {
        console.warn("RTDB tagCounts listen fail:", error);
      },
    );

    return () => {
      unsubscribeSearches();
      unsubscribeTags();
    };
  }, []);

  const [searchResults, setSearchResults] = useState({
    problems: [] as any[],
    builds: [] as any[],
    solutions: [] as any[],
    builders: [] as any[],
  });
  const [loading, setLoading] = useState(!!searchQuery);
  const [lastSearchedQuery, setLastSearchedQuery] = useState("");

  if (searchQuery !== lastSearchedQuery) {
    setLastSearchedQuery(searchQuery);
    if (
      searchQuery.trim() ||
      selectedCategories.length > 0 ||
      selectedStatuses.length > 0 ||
      selectedLevels.length > 0
    ) {
      setLoading(true);
    }
  }

  useEffect(() => {
    if (
      !searchQuery.trim() &&
      selectedCategories.length === 0 &&
      selectedStatuses.length === 0 &&
      selectedLevels.length === 0
    ) {
      setSearchResults({
        problems: [],
        builds: [],
        solutions: [],
        builders: [],
      });
      return;
    }
    const fetchSearch = async () => {
      const cacheKey = `search_${searchQuery}_${selectedCategories.sort().join(",")}_${selectedStatuses.sort().join(",")}_${selectedLevels.sort().join(",")}_${sortBy}`;
      const cached = sessionCache.get(cacheKey, null);
      if (cached) {
        setSearchResults(cached.results);
        setAvailableCategories(cached.categories);
        setAvailableLevels(cached.levels);
        setAvailableStatuses(cached.statuses);
        setLoading(false);
        return;
      }

      setLoading(true);
      setSearchResults({
        problems: [],
        builds: [],
        solutions: [],
        builders: [],
      });

      try {
        let dbPosts: any[] = [];
        let dbComments: any[] = [];
        let dbUsers: any[] = [];
        const lowerQ = searchQuery.toLowerCase();

        if (lowerQ) {
          // Hit our real backend MiniSearch endpoint
          try {
            const res = await fetch(
              `/api/search?q=${encodeURIComponent(lowerQ)}`,
            );
            if (res.ok) {
              const contentType = res.headers.get("content-type");
              if (contentType && contentType.includes("application/json")) {
                const data = await res.json();
                dbPosts = data.posts || [];
                dbUsers = data.users || [];
                dbComments = data.comments || [];
              } else {
                throw new Error(
                  "Backend search returned non-JSON content. Fallback to client-side Firestore search.",
                );
              }
            } else {
              throw new Error("Failed to fetch search results from backend");
            }
          } catch (apiErr) {
            console.warn(
              "Backend search failed or returned HTML. Doing direct client-side Firestore query fallback...",
              apiErr,
            );

            const postsRef = collection(db, "posts");
            const postsSnap = await getDocs(query(postsRef, limit(150)));
            dbPosts = postsSnap.docs
              .map((d) => ({ id: d.id, ...(d.data() as object) }))
              .filter((p: any) => p.status !== "trashed");
            dbPosts = dbPosts.filter((p: any) => {
              const titleMatch = p.title?.toLowerCase()?.includes(lowerQ);
              const bodyMatch = p.body?.toLowerCase()?.includes(lowerQ);
              const catMatch = p.category?.toLowerCase()?.includes(lowerQ);
              const tagMatch =
                Array.isArray(p.tags) &&
                p.tags.some((t: string) => t?.toLowerCase()?.includes(lowerQ));
              return titleMatch || bodyMatch || catMatch || tagMatch;
            });

            const usersRef = collection(db, "users");
            const usersSnap = await getDocs(query(usersRef, limit(150)));
            dbUsers = usersSnap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as object),
            }));
            dbUsers = dbUsers.filter((u: any) => {
              const nameMatch = u.displayName?.toLowerCase()?.includes(lowerQ);
              const handleMatch = u.handle?.toLowerCase()?.includes(lowerQ);
              const interestsMatch =
                Array.isArray(u.interests) &&
                u.interests.some((i: string) =>
                  i?.toLowerCase()?.includes(lowerQ),
                );
              return nameMatch || handleMatch || interestsMatch;
            });

            const commentsRef = collection(db, "comments");
            const commentsSnap = await getDocs(query(commentsRef, limit(100)));
            dbComments = commentsSnap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as object),
            }));
            dbComments = dbComments.filter((c: any) =>
              c.body?.toLowerCase()?.includes(lowerQ),
            );
          }
        }

        // Fallback to Firestore for empty query / just filtering
        if (
          !lowerQ &&
          dbPosts.length === 0 &&
          dbComments.length === 0 &&
          dbUsers.length === 0
        ) {
          const postsRef = collection(db, "posts");
          const q = query(postsRef, orderBy("createdAt", "desc"), limit(50));

          const snap = await getDocs(q);
          dbPosts = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as object) }))
            .filter((p: any) => p.status !== "trashed") as any[];

          const usersRef = collection(db, "users");
          const uQ = query(usersRef, limit(20));
          const uSnap = await getDocs(uQ);
          dbUsers = uSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as object),
          })) as any[];
        }

        const allPosts = [...dbPosts, ...dbComments];
        const allBuilders = [...dbUsers];

        // Optimized batch lookup mapping to fetch only exactly needed user profiles!
        const usersMap = new Map<string, any>();
        allBuilders.forEach((b) => {
          if (b.id) {
            usersMap.set(b.id, b);
          }
        });

        const authorIds = Array.from(
          new Set(allPosts.map((p) => p.authorId).filter(Boolean)),
        );
        if (authorIds.length > 0) {
          const chunks: string[][] = [];
          for (let i = 0; i < authorIds.length; i += 30) {
            chunks.push(authorIds.slice(i, i + 30));
          }

          const usersRef = collection(db, "users");
          await Promise.all(
            chunks.map(async (chunk) => {
              const q = query(usersRef, where("__name__", "in", chunk));
              const snap = await getDocs(q);
              snap.docs.forEach((doc) => {
                usersMap.set(doc.id, doc.data());
              });
            }),
          );
        }

        const categoriesSet = new Set<string>();
        const levelsSet = new Set<string>();
        const statusesSet = new Set<string>();

        allPosts.forEach((p) => {
          if (p.category) categoriesSet.add(p.category);
          if (p.level) levelsSet.add(p.level);
          if (p.status) statusesSet.add(p.status);
        });

        setAvailableCategories(Array.from(categoriesSet).sort());
        setAvailableLevels(Array.from(levelsSet).sort());
        setAvailableStatuses(Array.from(statusesSet).sort());

        // Final offline filtering/ranking
        const matchedPosts = allPosts.filter((p) => {
          const matchesCategory =
            selectedCategories.length === 0 ||
            selectedCategories
              .map((c) => c.toLowerCase())
              .includes(p.category?.toLowerCase() || "");
          const matchesLevel =
            selectedLevels.length === 0 ||
            selectedLevels
              .map((l) => l.toLowerCase())
              .includes(p.level?.toLowerCase() || "");
          const matchesStatus =
            selectedStatuses.length === 0 ||
            selectedStatuses
              .map((s) => s.toLowerCase())
              .includes(p.status?.toLowerCase() || "");

          if (!(matchesCategory && matchesLevel && matchesStatus)) {
            return false;
          }

          return true;
        });

        const matchedBuilders = allBuilders.filter((b) => {
          const matchesSearch =
            !lowerQ ||
            b.displayName?.toLowerCase()?.includes(lowerQ) ||
            b.handle?.toLowerCase()?.includes(lowerQ) ||
            (Array.isArray(b.interests) &&
              b.interests.some(
                (t: string) =>
                  typeof t === "string" && t.toLowerCase().includes(lowerQ),
              ));
          if (!matchesSearch) return false;

          return true;
        });

        // Sort
        matchedPosts.sort((a, b) => {
          if (sortBy === "Most Relevant") {
            const scoreA = a.ranking?.searchScore || a.stats?.likesCount || 0;
            const scoreB = b.ranking?.searchScore || b.stats?.likesCount || 0;
            return scoreB - scoreA;
          } else if (sortBy === "Newest") {
            const timeA = a.createdAt?.toDate
              ? a.createdAt.toDate().getTime()
              : 0;
            const timeB = b.createdAt?.toDate
              ? b.createdAt.toDate().getTime()
              : 0;
            return timeB - timeA;
          } else if (sortBy === "Most Liked") {
            const likesA = a.stats?.likesCount || 0;
            const likesB = b.stats?.likesCount || 0;
            return likesB - likesA;
          } else if (sortBy === "Most Viewed") {
            const viewsA = a.stats?.viewsCount || 0;
            const viewsB = b.stats?.viewsCount || 0;
            return viewsB - viewsA;
          } else if (sortBy === "Most Discussed") {
            const commentsA = a.stats?.commentsCount || 0;
            const commentsB = b.stats?.commentsCount || 0;
            return commentsB - commentsA;
          }
          return 0;
        });

        const finalResults = {
          problems: matchedPosts.filter((p) => p.type === "problem" || !p.type),
          builds: matchedPosts.filter((p) => p.type === "build"),
          solutions: matchedPosts.filter(
            (p) => p.type === "solution" || p.type === "comment",
          ),
          builders: matchedBuilders,
        };
        setSearchResults(finalResults);

        const cacheKey = `search_${searchQuery}_${selectedCategories.sort().join(",")}_${selectedStatuses.sort().join(",")}_${selectedLevels.sort().join(",")}_${sortBy}`;
        sessionCache.set(cacheKey, {
          results: finalResults,
          categories: Array.from(categoriesSet).sort(),
          levels: Array.from(levelsSet).sort(),
          statuses: Array.from(statusesSet).sort(),
        });
      } catch (err) {
        console.error("Error fetching search results:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSearch();
  }, [
    searchQuery,
    selectedCategories,
    selectedStatuses,
    selectedLevels,
    sortBy,
  ]);

  const hasResults =
    searchResults.problems.length > 0 ||
    searchResults.builds.length > 0 ||
    searchResults.solutions.length > 0 ||
    searchResults.builders.length > 0;

  // Filter component
  const Filters = () => (
    <div className="space-y-6">
      {availableCategories.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-buildops-text-secondary uppercase tracking-wider mb-3">
            Category
          </h3>
          <div className="flex flex-col gap-2">
            {availableCategories.map((t) => (
              <label
                key={t}
                className="flex items-center gap-2 text-sm text-buildops-text-secondary hover:text-buildops-text cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="rounded border-buildops-border bg-buildops-bg text-buildops-blue focus:ring-buildops-blue/50"
                  checked={selectedCategories.includes(t)}
                  onChange={(e) => {
                    if (e.target.checked)
                      setSelectedCategories([...selectedCategories, t]);
                    else
                      setSelectedCategories(
                        selectedCategories.filter((c) => c !== t),
                      );
                  }}
                />
                {t}
              </label>
            ))}
          </div>
        </div>
      )}
      {availableLevels.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-buildops-text-secondary uppercase tracking-wider mb-3">
            Level
          </h3>
          <div className="flex flex-col gap-2">
            {availableLevels.map((t) => (
              <label
                key={t}
                className="flex items-center gap-2 text-sm text-buildops-text-secondary hover:text-buildops-text cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="rounded border-buildops-border bg-buildops-bg text-buildops-blue focus:ring-buildops-blue/50"
                  checked={selectedLevels.includes(t)}
                  onChange={(e) => {
                    if (e.target.checked)
                      setSelectedLevels([...selectedLevels, t]);
                    else
                      setSelectedLevels(selectedLevels.filter((c) => c !== t));
                  }}
                />
                {t}
              </label>
            ))}
          </div>
        </div>
      )}
      {availableStatuses.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-buildops-text-secondary uppercase tracking-wider mb-3">
            Status
          </h3>
          <div className="flex flex-col gap-2">
            {availableStatuses.map((t) => (
              <label
                key={t}
                className="flex items-center gap-2 text-sm text-buildops-text-secondary hover:text-buildops-text cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="rounded border-buildops-border bg-buildops-bg text-buildops-blue focus:ring-buildops-blue/50"
                  checked={selectedStatuses.includes(t)}
                  onChange={(e) => {
                    if (e.target.checked)
                      setSelectedStatuses([...selectedStatuses, t]);
                    else
                      setSelectedStatuses(
                        selectedStatuses.filter((c) => c !== t),
                      );
                  }}
                />
                {t}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen pb-20 md:pb-0">
      {/* Search Top Bar (Visible on mobile always, on desktop only when results are active) */}
      <div
        className={cn(
          "sticky top-0 z-50 bg-buildops-bg/95 backdrop-blur-md border-b border-buildops-border px-4 h-14 flex gap-3 items-center w-full max-w-5xl mx-auto",
          !searchQuery ? "md:hidden" : "",
        )}
      >
        <button
          onClick={() => navigate(-1)}
          className="p-1 -ml-1 text-buildops-text-secondary hover:text-buildops-text shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <form
          onSubmit={handleSearch}
          className="flex-1 relative flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onFocus={(e) => {
                const len = e.currentTarget.value.length;
                e.currentTarget.setSelectionRange(len, len);
                if (searchQuery) {
                  navigate("/search");
                }
              }}
              onClick={() => {
                if (searchQuery) {
                  navigate("/search");
                }
              }}
              placeholder="Search posts, comments, builders..."
              className="w-full bg-buildops-card border border-buildops-border rounded-full py-2 pl-4 pr-10 text-sm focus:outline-none focus:border-buildops-blue cursor-text"
            />
            {searchInput ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSearchInput("");
                  navigate("/search");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-buildops-text-secondary hover:text-buildops-text focus:outline-none"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-buildops-text-secondary focus:outline-none"
              >
                <SearchIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
        {searchQuery && (
          <button
            className="flex items-center gap-1.5 p-2 text-sm text-buildops-text-secondary bg-buildops-card border border-buildops-border rounded-md shrink-0 focus:outline-none focus:ring-1 focus:ring-buildops-blue"
            onClick={() => setShowMobileFilters(true)}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        )}
      </div>

      {searchInput !== searchQuery && searchInput.trim().length > 0 && (
        <div className="fixed top-14 left-0 right-0 bottom-0 bg-buildops-bg z-40 overflow-y-auto md:hidden w-full h-[calc(100vh-56px)] pb-20 pt-4">
          {unifiedSuggestions.length === 0 ? (
            <div className="flex items-center gap-4 px-4 py-3 border-b border-buildops-border/30">
              <SearchIcon className="w-5 h-5 text-buildops-text-secondary shrink-0" />
              <span className="flex-1 text-buildops-text text-[15px]">
                {searchInput}
              </span>
            </div>
          ) : (
            <div className="flex flex-col py-2">
              {unifiedSuggestions.map((sug, idx) => {
                if (sug.type === "user") {
                  const u = sug.user;
                  return (
                    <div
                      key={`m-sug-user-${idx}`}
                      onClick={() => {
                        navigate(`/profile/${u.id}`);
                      }}
                      className="flex items-center gap-3 px-4 py-3 active:bg-buildops-card transition-colors cursor-pointer group text-buildops-text"
                    >
                      <div className="w-8 h-8 rounded-full border border-buildops-border bg-buildops-bg overflow-hidden flex items-center justify-center shrink-0">
                        {u.photoURL ? (
                          <img
                            src={u.photoURL}
                            alt={u.displayName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-4 h-4 text-buildops-text-secondary" />
                        )}
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-buildops-text text-[15px] line-clamp-1 font-medium break-all">
                          {u.displayName}
                        </span>
                        {(u.username || u.handle) && (
                          <span className="text-sm text-buildops-text-secondary line-clamp-1 break-all">
                            @{u.username || u.handle}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSearchInput(
                            u.displayName || u.username || u.handle || "",
                          );
                        }}
                        className="p-2 -mr-2 text-buildops-text-secondary"
                      >
                        <ArrowUpLeft className="w-5 h-5 shrink-0" />
                      </button>
                    </div>
                  );
                }
                return (
                  <div
                    key={`m-sug-${idx}`}
                    onClick={() => {
                      navigate(`/search?q=${encodeURIComponent(sug.text)}`);
                    }}
                    className="flex items-center gap-4 px-4 py-3 active:bg-buildops-card transition-colors cursor-pointer group"
                  >
                    {sug.isHistory ? (
                      <Clock className="w-5 h-5 text-buildops-text-secondary shrink-0" />
                    ) : (
                      <SearchIcon className="w-5 h-5 text-buildops-text-secondary shrink-0" />
                    )}
                    <span className="flex-1 text-buildops-text text-[15px] font-medium line-clamp-1 break-all">
                      {sug.text}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearchInput(sug.text);
                      }}
                      className="p-2 -mr-2 text-buildops-text-secondary"
                    >
                      <ArrowUpLeft className="w-5 h-5 shrink-0" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!searchQuery ? (
        /* SEARCH HOME STATE */
        <div className="flex-1 flex flex-col items-center pt-[2px] md:pt-16 max-w-3xl mx-auto w-full px-4">
          <h1 className="text-2xl md:text-3xl font-bold text-buildops-text mb-8 hidden md:block">
            Search engineering posts
          </h1>

          <form
            onSubmit={handleSearch}
            className="w-full relative mb-[2px] hidden md:block"
          >
            <SearchIcon className="absolute left-4 top-3.5 h-5 w-5 text-buildops-text-secondary" />
            <input
              autoFocus
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search posts, comments, builders, tags..."
              className="w-full rounded-xl border border-buildops-border bg-buildops-card py-3.5 pl-12 pr-4 text-base text-buildops-text placeholder:text-buildops-text-secondary focus:border-buildops-blue focus:outline-none focus:ring-1 focus:ring-buildops-blue shadow-lg"
            />
            {searchInput !== searchQuery && searchInput.trim().length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-buildops-card border border-buildops-border rounded-xl shadow-2xl overflow-hidden z-50 text-left pb-2 py-1">
                {unifiedSuggestions.length === 0 ? (
                  <div className="flex items-center gap-4 px-4 py-3">
                    <SearchIcon className="w-4 h-4 text-buildops-text-secondary shrink-0" />
                    <span className="flex-1 text-buildops-text text-[15px]">
                      {searchInput}
                    </span>
                  </div>
                ) : (
                  <>
                    {unifiedSuggestions.map((sug, idx) => {
                      if (sug.type === "user") {
                        const u = sug.user;
                        return (
                          <div
                            key={`d-sug-user-${idx}`}
                            onClick={() => {
                              navigate(`/profile/${u.id}`);
                            }}
                            className="flex items-center gap-3 px-4 py-2 hover:bg-buildops-bg transition-colors cursor-pointer group text-buildops-text"
                          >
                            <div className="w-6 h-6 rounded-full border border-buildops-border bg-buildops-card overflow-hidden flex items-center justify-center shrink-0">
                              {u.photoURL ? (
                                <img
                                  src={u.photoURL}
                                  alt={u.displayName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <User className="w-3 h-3 text-buildops-text-secondary" />
                              )}
                            </div>
                            <span className="flex-1 text-[15px] font-medium line-clamp-1 break-all">
                              {u.displayName}
                            </span>
                            {(u.username || u.handle) && (
                              <span className="text-sm text-buildops-text-secondary line-clamp-1 mr-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                @{u.username || u.handle}
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSearchInput(
                                  u.displayName || u.username || u.handle || "",
                                );
                              }}
                              className="p-1 -mr-1 text-buildops-text-secondary opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <ArrowUpLeft className="w-4 h-4 shrink-0" />
                            </button>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={`d-sug-${idx}`}
                          onClick={() => {
                            navigate(
                              `/search?q=${encodeURIComponent(sug.text)}`,
                            );
                          }}
                          className="flex items-center gap-4 px-4 py-2 hover:bg-buildops-bg transition-colors cursor-pointer group text-buildops-text"
                        >
                          {sug.isHistory ? (
                            <Clock className="w-4 h-4 text-buildops-text-secondary shrink-0" />
                          ) : (
                            <SearchIcon className="w-4 h-4 text-buildops-text-secondary shrink-0" />
                          )}
                          <span className="flex-1 text-[15px] font-medium line-clamp-1 break-all">
                            {sug.text}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSearchInput(sug.text);
                            }}
                            className="p-1 -mr-1 text-buildops-text-secondary opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ArrowUpLeft className="w-4 h-4 shrink-0" />
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </form>

          {/* Search page main content */}

          <div className="w-full">
            {!historyLoaded ? (
              <div className="mb-6">
                <div className="flex flex-col gap-1 -ml-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="px-3 py-2 rounded-lg text-left text-sm text-buildops-text flex items-center justify-between animate-pulse w-full"
                    >
                      <span className="flex items-start gap-3 flex-1 overflow-hidden">
                        <Clock className="w-4 h-4 shrink-0 text-buildops-text-secondary mt-[3px]" />
                        <div className="h-4 bg-[rgba(255,255,255,0.08)] rounded w-2/3"></div>
                      </span>
                      <div className="p-1 -mr-1 text-buildops-text-secondary">
                        <ArrowUpLeft className="w-4 h-4 opacity-70" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              recentSearches.length > 0 && (
                <div className="mb-6">
                  <div className="flex flex-col gap-1 -ml-3">
                    {recentSearches.map((search) => (
                      <div key={search.id} className="relative">
                        {false && (
                          <div className="absolute top-0 left-0 w-full h-full bg-buildops-bg/40 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-lg">
                            <div className="bg-buildops-card border border-buildops-border p-2 rounded-lg shadow-lg flex flex-col items-center gap-2 max-w-[200px]">
                              <p className="text-sm text-buildops-text font-medium text-center">
                                Delete this search?
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLongPressedSearchId(null);
                                  }}
                                  className="px-3 py-1.5 text-xs font-medium text-buildops-text-secondary hover:bg-white/5 rounded-lg transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLongPressedSearchId(null);
                                    setRecentSearches((prev) => {
                                      const updated = prev.filter(
                                        (s) => s.id !== search.id,
                                      );
                                      localStorage.setItem(
                                        "recentSearches",
                                        JSON.stringify(updated),
                                      );

                                      return updated;
                                    });
                                    if (user && search.id !== search.query) {
                                      deleteDoc(
                                        doc(db, "searchHistory", search.id),
                                      ).catch(console.error);
                                    }
                                  }}
                                  className="px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        <div
                          onClick={(e) => {
                            if (longPressedSearchId === search.id) return;
                            navigate(
                              `/search?q=${encodeURIComponent(search.query)}`,
                            );
                          }}
                          onTouchStart={(e) =>
                            handleSearchPressStart(search.id)
                          }
                          onTouchMove={handleSearchPressEnd}
                          onTouchEnd={handleSearchPressEnd}
                          onMouseDown={(e) => handleSearchPressStart(search.id)}
                          onMouseUp={handleSearchPressEnd}
                          onMouseLeave={handleSearchPressEnd}
                          className="px-3 py-2 rounded-lg hover:bg-buildops-card text-left text-sm text-buildops-text flex items-center justify-between group transition-colors cursor-pointer select-none"
                        >
                          <span className="flex items-start gap-3 flex-1 overflow-hidden">
                            <Clock className="w-4 h-4 shrink-0 text-buildops-text-secondary mt-[3px]" />
                            <span className="line-clamp-2 leading-tight break-words">
                              {search.query}
                            </span>
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSearchInput(search.query);
                              const inputs =
                                document.querySelectorAll('input[type="text"]');
                              inputs.forEach((input) => {
                                const el = input as HTMLInputElement;
                                if (el.placeholder?.includes("Search")) {
                                  el.focus();
                                }
                              });
                            }}
                            className="p-1 -mr-1 text-buildops-text-secondary hover:text-buildops-text focus:outline-none transition-opacity"
                            title="Put in search bar"
                          >
                            <ArrowUpLeft className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        /* SEARCH RESULTS STATE */
        <div className="flex flex-col w-full">
          {/* Tabs - Not Sticky */}
          <div className="bg-buildops-bg/95 backdrop-blur-md border-b border-buildops-border pt-1">
            <div className="flex items-center px-4 max-w-2xl mx-auto w-full">
              <div className="flex gap-2 overflow-x-auto no-scrollbar py-2 pb-3 w-full">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-1 md:flex-none",
                      activeTab === tab
                        ? "bg-buildops-text text-buildops-bg"
                        : "text-buildops-text-secondary hover:text-buildops-text hover:bg-buildops-card",
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-8 p-4 md:p-6 w-full max-w-7xl mx-auto flex-col md:flex-row">
            {/* Desktop Filters */}
            <aside className="hidden md:block w-56 shrink-0 pt-2">
              <Filters />
            </aside>

            {/* Results */}
            <div className="flex-1 w-full min-w-0">
              {/* Sort/Filter Bar Desktop */}
              <div className="hidden md:flex items-center justify-between mb-4 pb-4 border-b border-buildops-border">
                <div className="text-sm text-buildops-text-secondary">
                  Showing results for{" "}
                  <span className="text-buildops-text font-medium">
                    "{searchQuery}"
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-buildops-text-secondary">
                  Sort by:
                  <div className="relative">
                    <select
                      className="bg-transparent text-buildops-text focus:outline-none font-medium cursor-pointer appearance-none pr-6"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option className="text-black">Most Relevant</option>
                      <option className="text-black">Newest</option>
                      <option className="text-black">Most Liked</option>
                      <option className="text-black">Most Viewed</option>
                      <option className="text-black">Most Discussed</option>
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-0 top-1/2 -translate-y-1/2 text-buildops-text-secondary pointer-events-none" />
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="space-y-4">
                  <CardSkeleton />
                  <CardSkeleton />
                  <CardSkeleton />
                </div>
              ) : hasResults ? (
                <div className="space-y-8">
                  {/* People Section */}
                  {(activeTab === "All" || activeTab === "Users") &&
                    searchResults.builders.length > 0 && (
                      <div>
                        <h2 className="text-sm font-semibold text-buildops-text-secondary flex items-center gap-2 mb-4 border-b border-buildops-border pb-2">
                          People matching "{searchQuery}"
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {searchResults.builders.map((b) => (
                            <div
                              key={b.id}
                              className="p-4 rounded-xl border border-buildops-border bg-buildops-card shadow-sm hover:border-buildops-text-secondary/50 hover:shadow-md transition-all flex flex-col items-center text-center gap-2 group cursor-pointer"
                              onClick={() => navigate(`/profile/${b.id}`)}
                            >
                              <div className="w-16 h-16 rounded-full border-2 border-buildops-bg shadow-sm overflow-hidden bg-buildops-card flex items-center justify-center shrink-0 mt-2">
                                {b.photoURL ? (
                                  <img
                                    src={b.photoURL}
                                    alt={b.displayName}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                ) : (
                                  <User className="w-8 h-8 text-buildops-text-secondary" />
                                )}
                              </div>
                              <div>
                                <h3 className="text-base font-bold text-buildops-text group-hover:text-buildops-blue transition-colors line-clamp-1 break-all break-words">
                                  {b.displayName || "Unknown Builder"}
                                </h3>
                                <p className="text-xs text-buildops-text-secondary mb-1 truncate">
                                  @{b.handle || "user"}
                                </p>
                              </div>
                              <div className="mt-auto pt-2 w-full hidden">
                                <SearchFollowButton targetId={b.id} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  <div className="space-y-6">
                    {/* Post Result */}
                    {(activeTab === "All" || activeTab === "Posts") &&
                      searchResults.problems.map((p) => (
                        <div
                          key={p.id}
                          className="py-4 px-3 sm:px-4 md:px-5 rounded-lg border border-buildops-border bg-buildops-card hover:border-buildops-text-secondary/50 transition-colors group flex flex-col gap-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium border border-buildops-border bg-buildops-bg text-buildops-text-secondary">
                              Post
                            </span>
                            {p.category && (
                              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium border border-buildops-border bg-buildops-bg text-buildops-text-secondary">
                                {p.category}
                              </span>
                            )}
                            {p.status &&
                              p.status !== "none" &&
                              p.status !== "open" && (
                                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium border border-buildops-green/30 bg-buildops-bg text-buildops-green">
                                  {p.status}
                                </span>
                              )}
                          </div>

                          <div>
                            <h3
                              className="text-lg font-bold text-buildops-text mb-1 group-hover:text-blue-400 transition-colors cursor-pointer"
                              onClick={() => navigate(`/problems/${p.id}`)}
                            >
                              {renderTextWithMentions(p.title, false)}
                            </h3>
                            <p className="text-sm text-buildops-text-secondary leading-relaxed line-clamp-2 break-words">
                              {renderTextWithMentions(
                                p.body,
                                settings.markdownRendering,
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 text-sm text-buildops-text-secondary">
                            Tags:{" "}
                            {p.tags?.map((t: string, i: number) => (
                              <span
                                key={`${t}-${i}`}
                                className="font-mono text-xs"
                              >
                                · {t}
                              </span>
                            ))}
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-sm font-medium mt-2">
                            <span className="text-buildops-text-secondary">
                              {formatCount(p.stats?.commentsCount || 0)}{" "}
                              Comments
                            </span>

                            <div className="ml-auto">
                              <SearchLikeButton
                                postId={p.id}
                                authorId={p.authorId}
                                initialLikesCount={p.stats?.likesCount || 0}
                              />
                            </div>
                          </div>

                          <Link
                            to={`/problems/${p.id}`}
                            className="mt-2 text-sm font-medium text-buildops-blue hover:text-blue-400 transition-colors flex items-center gap-1"
                          >
                            View Post →
                          </Link>
                        </div>
                      ))}

                    {/* Build Result */}
                    {(activeTab === "All" || activeTab === "Builds") &&
                      searchResults.builds.map((b) => (
                        <div
                          key={b.id}
                          className="py-4 px-3 sm:px-4 md:px-5 rounded-lg border border-buildops-border bg-buildops-card hover:border-buildops-text-secondary/50 transition-colors group flex flex-col gap-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium border border-buildops-border bg-buildops-bg text-buildops-text-secondary">
                              Build
                            </span>
                            {b.category && (
                              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium border border-buildops-border bg-buildops-bg text-buildops-text-secondary">
                                {b.category}
                              </span>
                            )}
                            {b.status &&
                              b.status !== "none" &&
                              b.status !== "open" && (
                                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium border border-buildops-green/30 bg-buildops-bg text-buildops-green">
                                  {b.status}
                                </span>
                              )}
                          </div>

                          <div>
                            <h3
                              className="text-lg font-bold text-buildops-text mb-1 group-hover:text-blue-400 transition-colors cursor-pointer"
                              onClick={() => navigate(`/problems/${b.id}`)}
                            >
                              {renderTextWithMentions(b.title, false)}
                            </h3>
                            <p className="text-sm text-buildops-text-secondary leading-relaxed line-clamp-2 break-words">
                              {renderTextWithMentions(
                                b.body,
                                settings.markdownRendering,
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 text-sm text-buildops-text-secondary">
                            Tags:{" "}
                            {b.tags?.map((t: string, i: number) => (
                              <span
                                key={`${t}-${i}`}
                                className="font-mono text-xs"
                              >
                                · {t}
                              </span>
                            ))}
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-sm font-medium mt-2">
                            <span className="text-buildops-text-secondary">
                              {formatCount(b.stats?.commentsCount || 0)}{" "}
                              Comments
                            </span>

                            <div className="ml-auto">
                              <SearchLikeButton
                                postId={b.id}
                                authorId={b.authorId}
                                initialLikesCount={b.stats?.likesCount || 0}
                              />
                            </div>
                          </div>

                          <Link
                            to={`/problems/${b.id}`}
                            className="mt-2 text-sm font-medium text-buildops-blue hover:text-blue-400 transition-colors flex items-center gap-1"
                          >
                            View Build →
                          </Link>
                        </div>
                      ))}

                    {/* Comment Result */}
                    {(activeTab === "All" || activeTab === "Comments") &&
                      searchResults.solutions.map((s) => (
                        <div
                          key={s.id}
                          className="py-4 px-3 sm:px-4 md:px-5 rounded-lg border border-buildops-border bg-buildops-bg hover:border-buildops-text-secondary/50 transition-colors group flex flex-col gap-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium border border-buildops-border bg-buildops-card text-buildops-text-secondary">
                              Comment
                            </span>
                          </div>

                          <div>
                            <h3
                              className="text-lg font-bold text-buildops-text mb-2 group-hover:text-buildops-blue transition-colors cursor-pointer"
                              onClick={() =>
                                navigate(`/problems/${s.postId}/submit`)
                              }
                            >
                              {s.title ||
                                (s.body
                                  ? s.body.substring(0, 30) + "..."
                                  : "Untitled Comment")}
                            </h3>
                          </div>

                          <div className="bg-buildops-card p-3 rounded border border-buildops-border mt-1">
                            <Link
                              to={`/problems/${s.postId}`}
                              className="text-sm font-medium text-buildops-text hover:underline decoration-buildops-border underline-offset-2"
                            >
                              View original post
                            </Link>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                /* EMPTY STATE */
                <div className="py-12 flex flex-col items-center text-center max-w-md mx-auto">
                  <SearchIcon className="w-12 h-12 text-buildops-border mb-4" />
                  <h3 className="text-xl font-bold text-buildops-text mb-2">
                    No matching engineering posts found.
                  </h3>
                  <div className="text-sm text-buildops-text-secondary mb-8 space-y-1">
                    <p>Try:</p>
                    <ul className="list-disc list-inside">
                      <li>using broader keywords</li>
                      <li>searching by domain</li>
                      <li>posting this as a new post</li>
                    </ul>
                  </div>
                  <Link
                    to="/problems/new"
                    className="flex items-center gap-2 rounded-md bg-buildops-text px-6 py-2.5 text-sm font-semibold text-buildops-bg transition-colors hover:bg-white"
                  >
                    <Plus className="h-4 w-4" />
                    Create this post
                  </Link>
                </div>
              )}

              {/* Best UX Feature - Convert failed search to post */}
              <div className="mt-12 p-6 rounded-xl border border-dashed border-buildops-border/80 bg-buildops-card/30 flex flex-col items-center text-center transition-colors hover:border-buildops-border hover:bg-buildops-card/50">
                <div className="w-10 h-10 rounded-full bg-buildops-bg border border-buildops-border flex items-center justify-center mb-3">
                  <Plus className="w-5 h-5 text-buildops-text" />
                </div>
                <h3 className="text-base font-semibold text-buildops-text mb-1">
                  Can't find the post?
                </h3>
                <p className="text-sm text-buildops-text-secondary mb-4">
                  Post it and let builders solve it.
                </p>
                <Link
                  to="/problems/new"
                  className="flex items-center gap-2 rounded-full border border-buildops-border bg-buildops-bg px-5 py-2 text-sm font-medium text-buildops-text transition-colors hover:border-buildops-text-secondary"
                >
                  Create New Post
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Filters Bottom Sheet */}
      {showMobileFilters && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-[60] transition-opacity"
            onClick={() => setShowMobileFilters(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-[60] bg-buildops-card border-t border-buildops-border rounded-t-2xl max-h-[85vh] flex flex-col pb-safe shadow-2xl">
            <div className="sticky top-0 bg-buildops-card border-b border-buildops-border px-4 py-3 flex items-center justify-between z-10 shrink-0 rounded-t-2xl">
              <button
                onClick={() => {
                  setSelectedCategories([]);
                  setSelectedStatuses([]);
                  setSelectedLevels([]);
                }}
                className="text-sm font-medium text-buildops-text-secondary px-2 py-1 hover:text-buildops-text"
              >
                Reset
              </button>
              <h2 className="text-base font-bold text-buildops-text">
                Filters
              </h2>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="text-sm font-bold text-buildops-blue px-4 py-1.5 bg-buildops-blue/10 rounded-full hover:bg-buildops-blue/20 transition-colors"
              >
                Apply
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto w-full overscroll-contain pb-12">
              <Filters />
            </div>
          </div>
        </>
      )}

      {/* Centered rigid search deletion dialog */}
      {longPressedSearchId && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 animate-in fade-in duration-100"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLongPressedSearchId(null);
          }}
        >
          <div className="bg-[#0c0d12] border border-buildops-border rounded w-full max-w-[290px] p-4 relative animate-in zoom-in-[0.98] duration-100 font-sans shadow-lg text-left">
            <div className="flex justify-between items-start mb-3 gap-2">
              <div>
                <h3 className="text-sm font-semibold text-buildops-text leading-tight">
                  Delete this search?
                </h3>
                <p className="text-xs text-buildops-text-secondary mt-1 leading-normal">
                  {(() => {
                    const searchObj = recentSearches.find(
                      (s) => s.id === longPressedSearchId,
                    );
                    return searchObj
                      ? `This will delete "${searchObj.query}" from your history.`
                      : "This will remove this query from your search history.";
                  })()}
                </p>
              </div>
              <button
                onClick={() => setLongPressedSearchId(null)}
                className="p-1 -mr-1 -mt-1 text-buildops-text-secondary/60 hover:text-buildops-text rounded hover:bg-buildops-card transition-colors shrink-0 bg-transparent border-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setLongPressedSearchId(null)}
                className="px-3 py-1.5 border border-buildops-border hover:bg-buildops-card text-buildops-text-secondary hover:text-buildops-text font-medium rounded text-xs transition-colors cursor-pointer bg-transparent"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const searchId = longPressedSearchId;
                  const searchObj = recentSearches.find(
                    (s) => s.id === searchId,
                  );
                  setLongPressedSearchId(null);
                  setRecentSearches((prev) => {
                    const updated = prev.filter((s) => s.id !== searchId);
                    localStorage.setItem(
                      "recentSearches",
                      JSON.stringify(updated),
                    );
                    return updated;
                  });
                  if (
                    user &&
                    searchId &&
                    searchObj &&
                    searchId !== searchObj.query
                  ) {
                    deleteDoc(doc(db, "searchHistory", searchId)).catch(
                      console.error,
                    );
                  }
                }}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded text-xs transition-colors shadow-sm cursor-pointer border-0"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
