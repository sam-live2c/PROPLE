import { rtdb, db } from "./firebase";
import { ref, set, update, push, get, child, increment } from "firebase/database";
import { doc, setDoc, updateDoc, increment as fsIncrement, collection, serverTimestamp } from "firebase/firestore";

export function sanitizeRtdbKey(key: string): string {
  // RTDB keys cannot contain ., $, #, [, ], / or ASCII control characters
  return key.replace(/[\.\#\$\[\]\/]/g, '_').toLowerCase().trim();
}

/**
 * Saves a search query to both user's history log and global search counts/scales inside both Realtime Database and Firestore.
 */
export async function syncSearchToRtdb(userId: string | null, queryText: string) {
  if (!queryText || !queryText.trim()) return;
  const term = queryText.trim();
  const cleanTerm = sanitizeRtdbKey(term);
  if (!cleanTerm) return;

  const timestamp = Date.now();

  // 1. Sync to Realtime Database
  try {
    // A. Log user search history
    const userHistoryRef = ref(rtdb, `searchHistory/${userId || 'anonymous'}`);
    const newSearchRef = push(userHistoryRef);
    await set(newSearchRef, {
      query: term,
      createdAt: timestamp
    });

    // B. Increment global count and scale (score measurement) in RTDB
    await update(ref(rtdb), {
      [`searchCounts/${cleanTerm}/count`]: increment(1),
      [`searchCounts/${cleanTerm}/scale`]: increment(1), // Measured scale attribute
      [`searchCounts/${cleanTerm}/query`]: term,
      [`searchCounts/${cleanTerm}/lastSearchedAt`]: timestamp
    });
  } catch (error) {
    console.warn("Silent RTDB search sync fail:", error);
  }

  // 2. Sync to Firestore Database
  try {
    const searchCountDocRef = doc(db, "searchCounts", cleanTerm);
    await setDoc(searchCountDocRef, {
      query: term,
      count: fsIncrement(1),
      scale: fsIncrement(1), // Measured scale attribute for hots ranking
      lastSearchedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn("Silent Firestore search sync fail:", error);
  }
}

/**
 * Syncs a new or updated post to both Realtime Database and Firestore, updating tag use scales.
 */
export async function syncPostToRtdb(postId: string, payload: any) {
  if (!postId) return;
  try {
    const timestamp = payload.createdAt || Date.now();
    const tags = payload.tags || payload.search?.tags || [];

    // 1. Sync post to RTDB at /posts/{postId}
    const postRef = ref(rtdb, `posts/${postId}`);
    await set(postRef, {
      id: postId,
      title: payload.title || "",
      type: payload.type || "problem",
      status: payload.status || "open",
      tags: tags,
      createdAt: typeof timestamp === 'object' && timestamp?.toMillis ? timestamp.toMillis() : (typeof timestamp === 'number' ? timestamp : Date.now()),
      category: payload.category || "none",
      stats: {
        likesCount: payload.stats?.likesCount || 0,
        dislikesCount: payload.stats?.dislikesCount || 0,
        commentsCount: payload.stats?.commentsCount || 0,
        viewsCount: payload.stats?.viewsCount || 0
      }
    });

    // 2. Increment counts and scale for tags in RTDB to drive real-time hot topics list
    if (Array.isArray(tags) && tags.length > 0) {
      const updates: Record<string, any> = {};
      tags.forEach((tag: string) => {
        const cleanTag = sanitizeRtdbKey(tag);
        if (cleanTag) {
          updates[`tagCounts/${cleanTag}/count`] = increment(1);
          updates[`tagCounts/${cleanTag}/scale`] = increment(1); // Measured scale for tag popularity
          updates[`tagCounts/${cleanTag}/tag`] = tag;
        }
      });
      await update(ref(rtdb), updates);

      // 3. Increment counts and scale for tags in Firestore
      for (const tag of tags) {
        const cleanTag = sanitizeRtdbKey(tag);
        if (cleanTag) {
          try {
            const tagDocRef = doc(db, "tagCounts", cleanTag);
            await setDoc(tagDocRef, {
              tag: tag,
              count: fsIncrement(1),
              scale: fsIncrement(1), // Measured scale in Firestore
              updatedAt: serverTimestamp()
            }, { merge: true });
          } catch (e) {
            // silent catch for safety
          }
        }
      }
    }
  } catch (error) {
    console.warn("Silent RTDB post sync fail:", error);
  }
}

/**
 * Removes or updates trashing status of posts in Realtime Database.
 */
export async function removePostFromRtdb(postId: string) {
  if (!postId) return;
  try {
    const postRef = ref(rtdb, `posts/${postId}`);
    await set(postRef, null); // Deletes from RTDB
  } catch (error) {
    console.warn("Silent RTDB post remove fail:", error);
  }
}

/**
 * Fetches hot searches and trending tags from Realtime Database, ordered by their scale metrics.
 */
export async function getHotSearchesAndTagsFromRtdb(): Promise<{ hotQueries: string[], hotTags: string[] }> {
  try {
    const dbRef = ref(rtdb);
    
    // Fetch searchCounts and tagCounts
    const searchSnap = await get(child(dbRef, 'searchCounts'));
    const tagSnap = await get(child(dbRef, 'tagCounts'));

    const hotQueries: string[] = [];
    const hotTags: string[] = [];

    if (searchSnap.exists()) {
      const searchData = searchSnap.val();
      const sortedQueries = Object.values(searchData)
        .filter((item: any) => item && typeof item === 'object' && item.query)
        .sort((a: any, b: any) => (b.scale || b.count || 0) - (a.scale || a.count || 0))
        .map((item: any) => item.query);
      hotQueries.push(...sortedQueries);
    }

    if (tagSnap.exists()) {
      const tagData = tagSnap.val();
      const sortedTags = Object.values(tagData)
        .filter((item: any) => item && typeof item === 'object' && item.tag)
        .sort((a: any, b: any) => (b.scale || b.count || 0) - (a.scale || a.count || 0))
        .map((item: any) => item.tag);
      hotTags.push(...sortedTags);
    }

    return {
      hotQueries: hotQueries.slice(0, 5),
      hotTags: hotTags.slice(0, 5)
    };
  } catch (error) {
    console.warn("Failed fetching from RTDB trends:", error);
    return { hotQueries: [], hotTags: [] };
  }
}

/**
 * Retrieves recent searches for a specific authenticated user from Realtime Database.
 */
export async function getRecentSearchesFromRtdb(userId: string): Promise<{ id: string, query: string, createdAt: number }[]> {
  if (!userId) return [];
  try {
    const userHistoryRef = ref(rtdb, `searchHistory/${userId}`);
    const snap = await get(userHistoryRef);
    if (snap.exists()) {
      const val = snap.val();
      const list = Object.entries(val).map(([id, item]: [string, any]) => ({
        id,
        query: item.query,
        createdAt: item.createdAt || 0
      }));
      // Sort by newest and filter unique queries
      list.sort((a, b) => b.createdAt - a.createdAt);
      const uniqueMap = new Map<string, any>();
      for (const item of list) {
        const lower = item.query.toLowerCase();
        if (!uniqueMap.has(lower)) {
          uniqueMap.set(lower, item);
        }
      }
      return Array.from(uniqueMap.values()).slice(0, 5);
    }
  } catch (error) {
    console.warn("Failed fetching user recent searches from RTDB:", error);
  }
  return [];
}
