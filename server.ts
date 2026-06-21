import express from "express";
import path from "path";
import MiniSearch from "minisearch";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, onSnapshot } from "firebase/firestore";
import fs from "fs";

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
  storeFields: ['displayName', 'handle', 'photoURL', 'interests', 'bio', 'role'], 
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

  console.log("Starting backend real-time indexing into MiniSearch...");

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
        } else if (change.type === 'modified') {
          if (postsSearch.has(docData.id)) postsSearch.replace(docData);
          else postsSearch.add(docData);
        } else if (change.type === 'removed') {
          if (postsSearch.has(docData.id)) postsSearch.discard(docData.id);
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
        } else if (change.type === 'modified') {
          if (usersSearch.has(docData.id)) usersSearch.replace(docData);
          else usersSearch.add(docData);
        } else if (change.type === 'removed') {
          if (usersSearch.has(docData.id)) usersSearch.discard(docData.id);
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
        } else if (change.type === 'modified') {
          if (commentsSearch.has(docData.id)) commentsSearch.replace(docData);
          else commentsSearch.add(docData);
        } else if (change.type === 'removed') {
          if (commentsSearch.has(docData.id)) commentsSearch.discard(docData.id);
        }
      } catch(e) {
        console.error("MiniSearch comments error:", e);
      }
    });
  });
}

// Start realtime sync
setupSearchRealtimeSync();


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

      // REAL BACKEND SEARCH ENDPOINT using MiniSearch
  app.get("/api/search", async (req, res) => {
    try {
      const { q } = req.query;
      const term = (q as string) || "";
      
      if (!term.trim()) {
        return res.json({ posts: [], users: [], comments: [] });
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
         // Require a Google-verified author (non-empty email in user profile)
         const author = backendUsersMap.get(pr.authorId);
         return author && author.email && author.email.trim() !== "";
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

      const enhancedUserResults = userResults.filter(ur => {
         // Require Google-verified email
         const uProfile = backendUsersMap.get(ur.id);
         return uProfile && uProfile.email && uProfile.email.trim() !== "";
      }).map(ur => {
         // Optionally enhance user search depending on followers/following/proofScore if available
         // currently stats not included in usersSearch storeFields but we have role
         const roleBoost = ur.role === 'admin' || ur.role === 'verified' ? 1.2 : 1;
         const customScore = ur.score * roleBoost;

         return {
             ...ur,
             customScore
         };
      }).sort((a, b) => b.customScore - a.customScore);

      const commentResults = commentsSearch.search(term, { prefix: true, fuzzy: 0.2 }).filter(cr => {
         // Require Google-verified email for parent thread author or comment author
         const author = backendUsersMap.get(cr.authorId);
         return author && author.email && author.email.trim() !== "";
      });

      res.json({
        posts: enhancedPostResults.slice(0, 50), // limits
        users: enhancedUserResults.slice(0, 20),
        comments: commentResults.slice(0, 30),
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
