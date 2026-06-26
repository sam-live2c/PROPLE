import express from "express";
import path from "path";
import MiniSearch from "minisearch";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, onSnapshot } from "firebase/firestore";
import fs from "fs";
import dotenv from "dotenv";
import { Meilisearch } from "meilisearch";

// Load environment variables
dotenv.config();

// Meilisearch initialization
let rawMeiliHost = process.env.VITE_MEILISEARCH_HOST || "http://127.0.0.1:7700";
rawMeiliHost = rawMeiliHost.trim();
if (/^[a-f0-9]{64}$/i.test(rawMeiliHost)) {
  rawMeiliHost = `https://ms-${rawMeiliHost}.edge.meilisearch.com`;
} else if (rawMeiliHost && !rawMeiliHost.startsWith("http://") && !rawMeiliHost.startsWith("https://")) {
  rawMeiliHost = `https://${rawMeiliHost}`;
}

const meiliHost = rawMeiliHost;
const meiliApiKey = process.env.MEILISEARCH_MASTER_KEY || process.env.MEILISEARCH_API_KEY || process.env.VITE_MEILISEARCH_SEARCH_KEY || "masterKey";

let meiliClient: Meilisearch | null = null;
let isMeiliActive = false;

if (process.env.VITE_MEILISEARCH_HOST) {
  try {
    meiliClient = new Meilisearch({
      host: meiliHost,
      apiKey: meiliApiKey,
    });
    console.log("MeiliSearch client created for host:", meiliHost);
  } catch (error) {
    // Fail silently
  }
}

// Sync helper to update MeiliSearch
async function syncToMeili(indexUid: string, docId: string, data: any, isDelete = false) {
  if (!meiliClient || !isMeiliActive) return;
  try {
    const index = meiliClient.index(indexUid);
    if (isDelete) {
      await index.deleteDocument(docId);
    } else {
      await index.updateDocuments([{ id: docId, ...data }]);
    }
  } catch (error: any) {
    // Catch silently to avoid spamming logs or raising false-positive error warnings
  }
}

// Initialize Firebase using the generated config
// We read it from the file system to avoid import issues
const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
let db: any = null;

try {
  if (fs.existsSync(firebaseConfigPath)) {
    const rawConfig = fs.readFileSync(firebaseConfigPath, 'utf-8');
    const firebaseConfig = JSON.parse(rawConfig);
    const app = initializeApp(firebaseConfig);
    // Explicitly pass the databaseId if available
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");
  }
} catch (error) {
  console.error("Failed to initialize Firebase on backend for search:", error);
}

// --------------------------------------------------
// 1. Initialize MiniSearch Instances
// --------------------------------------------------
const backendUsersMap = new Map<string, any>();

const postsSearch = new MiniSearch({
  fields: ['title', 'body', 'category', 'tags_string', 'authorId'], // fields to index for full-text search
  storeFields: ['title', 'body', 'category', 'tags', 'authorId', 'type', 'status', 'createdAt', 'stats', 'ranking'], // fields to return with search results
});

const usersSearch = new MiniSearch({
  fields: ['displayName', 'handle', 'interests_string', 'bio'], 
  storeFields: ['displayName', 'handle', 'photoURL', 'interests', 'bio', 'role', 'email'], 
});

const commentsSearch = new MiniSearch({
  fields: ['body'],
  storeFields: ['body', 'postId', 'authorId', 'createdAt'],
});

// --------------------------------------------------
// 2. Sync loop (Pull data from Firestore into MiniSearch)
// --------------------------------------------------
function setupSearchRealtimeSync() {
  if (!db) {
    console.warn("Firestore not initialized, skipping search indexing.");
    return;
  }

  console.log("Starting backend real-time indexing into MiniSearch & MeiliSearch...");

  onSnapshot(collection(db, "posts"), (snap) => {
    snap.docChanges().forEach(change => {
      const data = change.doc.data();
      const docData = { 
        id: change.doc.id, 
        ...data, 
        tags_string: Array.isArray(data.tags) ? data.tags.join(" ") : "" 
      };
      try {
        if (change.type === 'added') {
          if (!postsSearch.has(docData.id)) postsSearch.add(docData);
          syncToMeili('posts', docData.id, docData);
        } else if (change.type === 'modified') {
          if (postsSearch.has(docData.id)) postsSearch.replace(docData);
          else postsSearch.add(docData);
          syncToMeili('posts', docData.id, docData);
        } else if (change.type === 'removed') {
          if (postsSearch.has(docData.id)) postsSearch.discard(docData.id);
          syncToMeili('posts', docData.id, null, true);
        }
      } catch(e) {
        console.error("MiniSearch posts error:", e);
      }
    });
  });

  onSnapshot(collection(db, "users"), (snap) => {
    snap.docChanges().forEach(change => {
      const data = change.doc.data();
      const docData = { 
        id: change.doc.id, 
        ...data, 
        interests_string: Array.isArray(data.interests) ? data.interests.join(" ") : "" 
      };
      
      try {
        if (change.type === 'removed') {
          backendUsersMap.delete(docData.id);
        } else {
          backendUsersMap.set(docData.id, docData);
        }

        if (change.type === 'added') {
          if (!usersSearch.has(docData.id)) usersSearch.add(docData);
          syncToMeili('users', docData.id, docData);
        } else if (change.type === 'modified') {
          if (usersSearch.has(docData.id)) usersSearch.replace(docData);
          else usersSearch.add(docData);
          syncToMeili('users', docData.id, docData);
        } else if (change.type === 'removed') {
          if (usersSearch.has(docData.id)) usersSearch.discard(docData.id);
          syncToMeili('users', docData.id, null, true);
        }
      } catch(e) {
        console.error("MiniSearch users error:", e);
      }
    });
  });

  onSnapshot(collection(db, "comments"), (snap) => {
    snap.docChanges().forEach(change => {
      const docData = { id: change.doc.id, ...change.doc.data() };
      try {
        if (change.type === 'added') {
          if (!commentsSearch.has(docData.id)) commentsSearch.add(docData);
          syncToMeili('comments', docData.id, docData);
        } else if (change.type === 'modified') {
          if (commentsSearch.has(docData.id)) commentsSearch.replace(docData);
          else commentsSearch.add(docData);
          syncToMeili('comments', docData.id, docData);
        } else if (change.type === 'removed') {
          if (commentsSearch.has(docData.id)) commentsSearch.discard(docData.id);
          syncToMeili('comments', docData.id, null, true);
        }
      } catch(e) {
        console.error("MiniSearch comments error:", e);
      }
    });
  });
}

// Initialize MeiliSearch indexes
async function initMeiliIndexes() {
  if (!meiliClient) return;
  try {
    await meiliClient.health();
    isMeiliActive = true;
    console.log("Connected to MeiliSearch successfully!");
    
    // Create indexes if they don't exist
    await meiliClient.createIndex('posts', { primaryKey: 'id' }).catch(() => {});
    await meiliClient.createIndex('users', { primaryKey: 'id' }).catch(() => {});
    await meiliClient.createIndex('comments', { primaryKey: 'id' }).catch(() => {});

    // Set configuration
    await meiliClient.index('posts').updateSettings({
      searchableAttributes: ['title', 'body', 'category', 'tags_string'],
      displayedAttributes: ['id', 'title', 'body', 'category', 'tags', 'authorId', 'type', 'status', 'createdAt', 'stats', 'ranking'],
    }).catch(() => {});

    await meiliClient.index('users').updateSettings({
      searchableAttributes: ['displayName', 'handle', 'interests_string', 'bio'],
      displayedAttributes: ['id', 'displayName', 'handle', 'photoURL', 'interests', 'bio', 'role', 'email'],
    }).catch(() => {});

    await meiliClient.index('comments').updateSettings({
      searchableAttributes: ['body'],
      displayedAttributes: ['id', 'body', 'postId', 'authorId', 'createdAt'],
    }).catch(() => {});

    console.log("MeiliSearch indexes initialized & configured!");

    // Stagger/Push existing data to MeiliSearch to ensure it has all documents
    if (db) {
      console.log("Syncing initial Firestore data to MeiliSearch...");
      const [postsSnap, usersSnap, commentsSnap] = await Promise.all([
        getDocs(collection(db, "posts")),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "comments"))
      ]);

      const postsDocs = postsSnap.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data, tags_string: Array.isArray(data.tags) ? data.tags.join(" ") : "" };
      });
      if (postsDocs.length > 0) {
        await meiliClient.index('posts').addDocuments(postsDocs);
      }

      const usersDocs = usersSnap.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data, interests_string: Array.isArray(data.interests) ? data.interests.join(" ") : "" };
      });
      if (usersDocs.length > 0) {
        await meiliClient.index('users').addDocuments(usersDocs);
      }

      const commentsDocs = commentsSnap.docs.map(doc => {
        return { id: doc.id, ...doc.data() };
      });
      if (commentsDocs.length > 0) {
        await meiliClient.index('comments').addDocuments(commentsDocs);
      }
      console.log("All initial data synced to MeiliSearch successfully!");
    }
  } catch (error) {
    console.log("MeiliSearch is offline or unconfigured. Falling back to built-in local MiniSearch (Expected behavior in local dev environments).");
    isMeiliActive = false;
  }
}

async function runInitialDataLoad() {
  if (!db) {
    console.warn("Firestore not initialized, skipping initial search indexing.");
    return;
  }
  try {
    console.log("Pre-populating search indices from Firestore...");
    const [postsSnap, usersSnap, commentsSnap] = await Promise.all([
      getDocs(collection(db, "posts")),
      getDocs(collection(db, "users")),
      getDocs(collection(db, "comments"))
    ]);

    postsSnap.docs.forEach(doc => {
      const data = doc.data();
      const docData = { id: doc.id, ...data, tags_string: Array.isArray(data.tags) ? data.tags.join(" ") : "" };
      try {
        if (!postsSearch.has(docData.id)) postsSearch.add(docData);
      } catch (e) {
        // ignore duplicate
      }
    });

    usersSnap.docs.forEach(doc => {
      const data = doc.data();
      const docData = { id: doc.id, ...data, interests_string: Array.isArray(data.interests) ? data.interests.join(" ") : "" };
      backendUsersMap.set(docData.id, docData);
      try {
        if (!usersSearch.has(docData.id)) usersSearch.add(docData);
      } catch (e) {
        // ignore duplicate
      }
    });

    commentsSnap.docs.forEach(doc => {
      const docData = { id: doc.id, ...doc.data() };
      try {
        if (!commentsSearch.has(docData.id)) commentsSearch.add(docData);
      } catch (e) {
        // ignore duplicate
      }
    });

    console.log(`Indices populated successfully! Posts: ${postsSnap.size}, Users: ${usersSnap.size}, Comments: ${commentsSnap.size}`);
  } catch (error) {
    console.error("Failed to run initial data load for search:", error);
  }
}

// Start initial data pre-loading, then register real-time sync, and finally init MeiliSearch
runInitialDataLoad().then(() => {
  setupSearchRealtimeSync();
  initMeiliIndexes();
});


async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add middleware to parse JSON bodies
  app.use(express.json());

  // ==========================================
  // API ROUTES (Backend Logic)
  // ==========================================
  
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Express backend is running!" });
  });

      // REAL BACKEND SEARCH ENDPOINT using MeiliSearch / MiniSearch fallback
  app.get("/api/search", async (req, res) => {
    try {
      const { q } = req.query;
      const term = (q as string) || "";
      
      if (!term.trim()) {
        return res.json({ posts: [], users: [], comments: [] });
      }

      // If MeiliSearch is active and reachable, query MeiliSearch
      if (isMeiliActive && meiliClient) {
        try {
          const [postsRes, usersRes, commentsRes] = await Promise.all([
            meiliClient.index('posts').search(term, { limit: 50 }),
            meiliClient.index('users').search(term, { limit: 20 }),
            meiliClient.index('comments').search(term, { limit: 30 })
          ]);

          // Transform and format the results to match search page expectations
          const enhancedPostResults = postsRes.hits.filter(pr => {
             if (pr.status === 'trashed') return false;
             return true;
          }).map(pr => {
             const likes = pr.stats?.likesCount || 0;
             const comments = pr.stats?.commentsCount || 0;
             const views = Math.max(pr.stats?.viewsCount || 0, 1);
             const engagementScore = (likes * 2) + (comments * 3) + Math.log10(views);
             // Default scoring if rank score is missing
             const relevanceScore = pr._rankingScore || 1;
             const customScore = relevanceScore * (1 + (engagementScore * 0.05));
             return {
                 ...pr,
                 engagementScore,
                 relevanceScore,
                 customScore
             };
          }).sort((a, b) => b.customScore - a.customScore);

          const enhancedUserResults = usersRes.hits.map(ur => {
             const roleBoost = ur.role === 'admin' || ur.role === 'verified' ? 1.2 : 1;
             const relevanceScore = ur._rankingScore || 1;
             const customScore = relevanceScore * roleBoost;
             return {
                 ...ur,
                 customScore
             };
          }).sort((a, b) => b.customScore - a.customScore);

          const commentResults = commentsRes.hits;

          return res.json({
            posts: enhancedPostResults,
            users: enhancedUserResults,
            comments: commentResults,
            source: 'meilisearch'
          });
        } catch (meiliSearchError) {
          console.log("MeiliSearch query failed or is offline, falling back to MiniSearch.");
          // Fall through to MiniSearch if MeiliSearch query fails
        }
      }

      // Perform searches
      // Prefix true allows partial matching (e.g., "sol" for "solution")
      // Fuzzy true handles typo tolerance
      const postResults = postsSearch.search(term, { 
        prefix: true, 
        fuzzy: 0.2,
        boost: { title: 3, tags_string: 2, category: 1.5 } 
      });

      // Enhance & Filter post results with engagement score
      const enhancedPostResults = postResults.filter(pr => {
         if (pr.status === 'trashed') return false;
         return true;
      }).map(pr => {
         const likes = pr.stats?.likesCount || 0;
         const comments = pr.stats?.commentsCount || 0;
         const views = Math.max(pr.stats?.viewsCount || 0, 1);
         
         // Custom engagement score
         // log10 scale for views so it doesn't overpower basic relevance
         const engagementScore = (likes * 2) + (comments * 3) + Math.log10(views);
         
         // Combine Minisearch relevance score with engagement bonus
         // We enhance the relevance score by a fraction of engagement to keep relevance paramount
         const customScore = pr.score * (1 + (engagementScore * 0.05));

         return {
             ...pr,
             engagementScore,
             relevanceScore: pr.score,
             customScore
         };
      }).sort((a, b) => b.customScore - a.customScore);

      const userResults = usersSearch.search(term, { 
        prefix: true, 
        fuzzy: 0.2,
        boost: { handle: 2, displayName: 2, interests_string: 1.5 } 
      });

      const enhancedUserResults = userResults.map(ur => {
         // Optionally enhance user search depending on followers/following/proofScore if available
         // currently stats not included in usersSearch storeFields but we have role
         const roleBoost = ur.role === 'admin' || ur.role === 'verified' ? 1.2 : 1;
         const customScore = ur.score * roleBoost;

         return {
             ...ur,
             customScore
         };
      }).sort((a, b) => b.customScore - a.customScore);

      const commentResults = commentsSearch.search(term, { prefix: true, fuzzy: 0.2 });

      res.json({
        posts: enhancedPostResults.slice(0, 50), // limits
        users: enhancedUserResults.slice(0, 20),
        comments: commentResults.slice(0, 30),
        source: 'minisearch'
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to search backend index" });
    }
  });

  // ==========================================
  // VITE / FRONTEND SERVING
  // ==========================================
  if (process.env.NODE_ENV !== "production") {
    // Development mode: use Vite's middleware
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: serve static files built by Vite
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
