import { useState, useEffect, useRef, useMemo } from "react";
import { Filter, Search, Loader2 } from "lucide-react";
import { ProblemCard } from "../components/ProblemCard";
import { CardSkeleton } from "../components/SkeletonLoader";
import { collection, query, orderBy, where, getDocs, limit } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { handleFirestoreError, OperationType } from "@/src/lib/firestore-errors";
import { useSettings } from "@/src/contexts/SettingsContext";
import { sessionCache } from "@/src/lib/sessionCache";
import { useQuery, keepPreviousData } from "@tanstack/react-query";

export function Feed() {
  const { settings } = useSettings();
  
  // Use session cache for active filter, and filters list
  const cachedFilter = sessionCache.get("feed_active_filter", "All");
  const [activeFilter, setActiveFilterState] = useState(cachedFilter);
  const [limitCount, setLimitCount] = useState(() => sessionCache.get("feed_limit_" + cachedFilter, 15));
  const observerTarget = useRef<HTMLDivElement>(null);
  
  const [filters, setFilters] = useState<string[]>(() => 
    sessionCache.get("feed_filters", [
      "All",
      "Builds",
      "Newest",
      "Oldest",
      "Most Liked",
      "Most Viewed"
    ])
  );

  const setActiveFilter = (filter: string) => {
    setActiveFilterState(filter);
    sessionCache.set("feed_active_filter", filter);
    
    // Read the cached limit, default or fall back
    const cachedLimit = sessionCache.get("feed_limit_" + filter, 15);
    setLimitCount(cachedLimit);
  };

  const fetchFeedPosts = async () => {
    let q = query(collection(db, "posts"), limit(limitCount));
    
    const isBuiltInFilter = ["All", "Builds", "Recent Builds", "Newest", "Oldest", "Most Liked", "Most Viewed"].includes(activeFilter);
    
    if (activeFilter === "Builds" || activeFilter === "Recent Builds") q = query(collection(db, "posts"), where("type", "==", "build"), limit(limitCount));
    if (activeFilter === "Newest") q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(limitCount));
    if (activeFilter === "Oldest") q = query(collection(db, "posts"), orderBy("createdAt", "asc"), limit(limitCount));
    if (activeFilter === "Most Liked") q = query(collection(db, "posts"), orderBy("stats.likesCount", "desc"), limit(limitCount));
    if (activeFilter === "Most Viewed") q = query(collection(db, "posts"), orderBy("stats.viewsCount", "desc"), limit(limitCount));
    
    if (!isBuiltInFilter) {
       q = query(collection(db, "posts"), where("search.tags", "array-contains", activeFilter.toLowerCase()), limit(limitCount));
    }

    try {
      const snapshot = await getDocs(q);
      const postsData = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      return postsData;
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'posts');
      throw e;
    }
  };

  const { data: rawPosts = [], isLoading } = useQuery({
    queryKey: [
      "feed",
      activeFilter,
      limitCount,
      settings.developerMode,
      settings.workspaceMode,
      settings.showThoughts
    ],
    queryFn: fetchFeedPosts,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 5, // 5 seconds staleTime allows instant page load
    gcTime: 1000 * 60 * 10, // 10 minutes cache retention
  });

  const posts = useMemo(() => {
    let allPosts: any[] = [...rawPosts].filter((p: any) => p.status !== "trashed");
    
    // Hide all builds if developer mode is disabled
    if (!settings.developerMode) {
        allPosts = allPosts.filter(p => p.type !== "build");
    }
    
    // Settings filters
    if (settings.workspaceMode || !settings.showThoughts) {
        allPosts = allPosts.filter(p => p.type !== "thought");
    }
    
    if (activeFilter === "Builds" || activeFilter === "Recent Builds") allPosts = allPosts.filter(p => p.type === "build");

    const isBuiltInFilter = ["All", "Builds", "Recent Builds", "Newest", "Oldest", "Most Liked", "Most Viewed"].includes(activeFilter);
    if (!isBuiltInFilter) allPosts = allPosts.filter(p => (p.search?.tags || []).includes(activeFilter.toLowerCase()));

    if (activeFilter === "Newest" || activeFilter === "All" || activeFilter === "Recent Builds" || !isBuiltInFilter) {
      allPosts.sort((a: any, b: any) => {
         const timeA = typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : (a.createdAt?.toMillis() || 0);
         const timeB = typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : (b.createdAt?.toMillis() || 0);
         return timeB - timeA;
      });
    }
    if (activeFilter === "Oldest") {
      allPosts.sort((a: any, b: any) => {
         const timeA = typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : (a.createdAt?.toMillis() || 0);
         const timeB = typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : (b.createdAt?.toMillis() || 0);
         return timeA - timeB;
      });
    }
    if (activeFilter === "Most Liked") {
      allPosts.sort((a: any, b: any) => (b.stats?.likesCount || 0) - (a.stats?.likesCount || 0));
    }
    if (activeFilter === "Most Viewed") {
      allPosts.sort((a: any, b: any) => (b.stats?.viewsCount || 0) - (a.stats?.viewsCount || 0));
    }

    return allPosts;
  }, [rawPosts, activeFilter, settings.developerMode, settings.workspaceMode, settings.showThoughts]);

  const hasMore = rawPosts.length === limitCount;
  const loading = isLoading;

  // Reset limit when filter changes (if not cached)
  useEffect(() => {
     if (!sessionCache.has("feed_posts_" + activeFilter)) {
       setLimitCount(15);
     }
  }, [activeFilter]);

  // Fallback if developer mode is deactivated with activeFilter as Builds
  useEffect(() => {
    if (!settings.developerMode && activeFilter === "Builds") {
      setActiveFilter("All");
    }
  }, [settings.developerMode, activeFilter]);

  // Scroll recovery logic
  useEffect(() => {
    const handleScroll = () => {
      sessionCache.set(`feed_scroll_${activeFilter}`, window.scrollY);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [activeFilter]);

  useEffect(() => {
    if (!loading && posts.length > 0) {
      const savedScroll = sessionCache.get(`feed_scroll_${activeFilter}`, 0);
      if (savedScroll > 0) {
        // Scroll instantly to avoid visual jump
        const timer = setTimeout(() => {
          window.scrollTo({ top: savedScroll, behavior: "instant" as any });
        }, 30);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, activeFilter, posts.length]);

  // Synchronise filters and caches with React Query outputs
  useEffect(() => {
    if (rawPosts.length > 0) {
      sessionCache.set("feed_posts_" + activeFilter, posts);
      sessionCache.set("feed_limit_" + activeFilter, limitCount);
    }
  }, [rawPosts, posts, activeFilter, limitCount]);

  useEffect(() => {
    // Extract dynamic tags if on "All" filter to populate the filter bar
    if (activeFilter === "All" && rawPosts.length > 0) {
       const extractedTags = new Set<string>();
       rawPosts.forEach((p: any) => {
          if (p.search && p.search.tags) {
             p.search.tags.forEach((tag: string) => {
                if (tag.trim()) extractedTags.add(tag.trim());
              });
          }
       });
       const topTags = Array.from(extractedTags).slice(0, 10).map(t => t.charAt(0).toUpperCase() + t.slice(1));
       const combinedFilters = [
          "All",
          "Builds",
          "Newest",
          ...topTags,
          "Oldest",
          "Most Liked",
          "Most Viewed"
       ];
       const finalFilters = [...new Set(combinedFilters)];
       setFilters(finalFilters);
       sessionCache.set('feed_filters', finalFilters);
    }
  }, [rawPosts, activeFilter]);

  useEffect(() => {
      const observer = new IntersectionObserver(
          entries => {
              if (entries[0].isIntersecting && !loading && hasMore) {
                  setLimitCount(prev => prev + 15);
              }
          },
          { threshold: 1.0 }
      );
      
      if (observerTarget.current) {
          observer.observe(observerTarget.current);
      }
      
      return () => {
          if (observerTarget.current) {
              observer.unobserve(observerTarget.current);
          }
      };
  }, [loading, hasMore]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* YouTube-style Filter Stripe */}
      <div className="bg-buildops-bg/95 backdrop-blur-md border-b border-buildops-border/50 py-3 px-4 flex gap-2 overflow-x-auto no-scrollbar">
        {filters.filter(f => settings.developerMode || f !== "Builds").map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeFilter === filter
                ? "bg-buildops-text text-buildops-bg"
                : "bg-buildops-card border border-buildops-border text-buildops-text-secondary hover:bg-buildops-border/50 hover:text-buildops-text"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Main Feed */}
      <div className="flex-1 w-full flex flex-col items-center">
        <div className="w-full max-w-4xl mx-auto divide-y divide-buildops-border">
          {loading && posts.length === 0 ? (
             <>
               <CardSkeleton />
               <CardSkeleton />
               <CardSkeleton />
               <CardSkeleton />
               <CardSkeleton />
             </>
          ) : posts.length === 0 ? (
             <div className="p-12 text-center text-buildops-text-secondary text-base mt-4 max-w-md mx-auto">
               <p className="font-semibold mb-2 text-white">Your Feed is quiet</p>
               <p className="text-sm">There are no posts here yet. Follow more tags or start the conversation by writing your own post!</p>
             </div>
          ) : (
            <>
                {posts.map(p => (
                <ProblemCard key={p.id} post={p} />
                ))}
                
                {hasMore && (
                    <div ref={observerTarget} className="py-8 flex justify-center items-center">
                        <Loader2 className="w-6 h-6 animate-spin text-buildops-blue" />
                    </div>
                )}
                
                {!hasMore && posts.length > 0 && (
                    <div className="py-8 text-center text-buildops-text-secondary text-sm">
                        You are all caught up
                    </div>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
