import { Brain, Hammer, MessagesSquare, MessageSquare, Play, ThumbsUp, ThumbsDown, ArrowUp, Zap, X, Image as ImageIcon, CheckCircle2, MoreVertical, AlertTriangle, Info, Share as Share2, UserPlus, Edit2, Trash2, ChevronDown, ChevronRight, Bookmark, Sparkles, User, Undo2, ArrowLeft, ListFilter, Upload, Eye, BarChart2, Search, Github, Globe } from "lucide-react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { collection, doc, getDoc, updateDoc, writeBatch, onSnapshot, query, where, setDoc, deleteDoc, increment, serverTimestamp, getDocs } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/contexts/AuthContext";
import { handleFirestoreError, OperationType } from "@/src/lib/firestore-errors";
import { format } from "date-fns";
import { motion, AnimatePresence } from "motion/react";
import { sessionCache } from "@/src/lib/sessionCache";
import { DetailSkeleton } from "@/src/components/SkeletonLoader";
import { CodeEditor } from "@/src/components/CodeEditor";
import { cn, formatCount, formatPostTime } from "@/src/lib/utils";
import { useConfirmNavigation } from "@/src/hooks/useConfirmNavigation";
import { ConfirmNavigationDialog } from "@/src/components/ConfirmNavigationDialog";

import { generateSearchData } from "@/src/lib/search";

import { renderTextWithMentions } from "@/src/lib/renderUtils";
import { notifyMentions } from "@/src/lib/mentions";
import { toast } from "sonner";
import { FollowButton } from "@/src/components/FollowButton";
import { useSettings } from "@/src/contexts/SettingsContext";

const getWordsExcerpt = (text: string, limit: number) => {
  if (!text) return { excerpt: "", isTruncated: false, totalWords: 0 };
  const words = text.trim().split(/\s+/).filter(Boolean);
  const totalWords = words.length;
  if (totalWords <= limit) {
    return { excerpt: text, isTruncated: false, totalWords };
  }
  
  let wordCount = 0;
  let charIndex = 0;
  let inWord = false;
  while (charIndex < text.length && wordCount < limit) {
    const isCharWhitespace = /\s/.test(text[charIndex]);
    if (!isCharWhitespace) {
      if (!inWord) {
        inWord = true;
      }
    } else {
      if (inWord) {
        wordCount++;
        inWord = false;
      }
    }
    charIndex++;
  }
  if (inWord) {
    wordCount++;
  }
  
  return { 
    excerpt: text.slice(0, charIndex).trim(), 
    isTruncated: true,
    totalWords
  };
};

export function ProblemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [post, setPost] = useState<any>(() => sessionCache.get("post_" + id, null));
  const [author, setAuthor] = useState<any>(() => sessionCache.get("author_" + id, null));
  const [isFollowing, setIsFollowing] = useState(false);
  const [comments, setComments] = useState<any[]>(() => sessionCache.get("comments_" + id, []));
  const { user, userProfile } = useAuth();
  
  const [loadingPost, setLoadingPost] = useState(() => !sessionCache.has("post_" + id));
  const [isLiking, setIsLiking] = useState(false);
  const [hasDisliked, setHasDisliked] = useState(false);
  const [isDisliking, setIsDisliking] = useState(false);

  useEffect(() => {
    if (user && post?.authorId && user.uid !== post.authorId) {
      const followRef = doc(db, "followers", `${user.uid}_${post.authorId}`);
      getDoc(followRef).then((snap) => {
        setIsFollowing(snap.exists());
      }).catch(err => {
        if (err?.message?.includes("offline") || err?.code === "unavailable") {
          console.warn("Firestore client is offline. Follow status loaded in offline mode.");
        } else {
          console.warn("Failed to check follow status on detail page:", err);
        }
      });
    } else {
      setIsFollowing(false);
    }
  }, [user, post?.authorId]);
  
  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [viewingRepliesFor, setViewingRepliesFor] = useState<string | null>(null);
  const [solutionBody, setSolutionBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commentUsers, setCommentUsers] = useState<Record<string, any>>(() => sessionCache.get("commentUsers_" + id, {}));
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [activeCommentMenuId, setActiveCommentMenuId] = useState<string | null>(null);
  const [editCommentBody, setEditCommentBody] = useState("");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [longPressedCommentId, setLongPressedCommentId] = useState<string | null>(null);
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null);
  const [showReportPostModal, setShowReportPostModal] = useState(false);
  const [visibleTopCommentsCount, setVisibleTopCommentsCount] = useState(5);
  const [visiblePartsCount, setVisiblePartsCount] = useState(1);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // resolve comment authors
    comments.forEach(async (c) => {
      if (c.authorId && !commentUsers[c.authorId]) {
            try {
               const uDoc = await getDoc(doc(db, "users", c.authorId));
               if (uDoc.exists()) {
                  setCommentUsers(prev => {
                     const updated = { ...prev, [c.authorId]: uDoc.data() };
                     sessionCache.set("commentUsers_" + id, updated);
                     return updated;
                  });
               }
            } catch (e) {}
      }
    });
  }, [comments]);
  const [sentNotifications, setSentNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !id) return;
    const qSentNotifs = query(
      collection(db, "notifications"),
      where("fromUserId", "==", user.uid),
      where("postId", "==", id)
    );
    const unsubSent = onSnapshot(qSentNotifs, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSentNotifications(list);
    }, (err) => {
      console.warn("Offline or failed fetching sent notifications status:", err);
    });
    return () => unsubSent();
  }, [user, id]);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editCategory, setEditCategory] = useState("none");

  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const isDirty = isEditing && (editTitle.trim() !== (post?.title || "").trim() || editBody.trim() !== (post?.body || "").trim());
  const blocker = useConfirmNavigation(isDirty && !isSavingEdit);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  const handleShare = async () => {
    try {
      const url = window.location.href;
      if (user) {
        const shareRef = doc(db, "shares", `${id}_${user.uid}`);
        setDoc(shareRef, { postId: id, userId: user.uid, createdAt: serverTimestamp() }, { merge: true }).catch(() => {});
      }
      if (navigator.share) {
        await navigator.share({ title: post?.title, url: url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied!");
      }
      
      if (user) {
        const postRef = doc(db, "posts", id!);
        await updateDoc(postRef, {
          "stats.sharesCount": increment(1),
          updatedAt: serverTimestamp()
        });
        setPost((prev: any) => ({
          ...prev,
          stats: {
            ...prev.stats,
            sharesCount: (prev.stats?.sharesCount || 0) + 1
          }
        }));
      }
    } catch (err: any) {
      if (err.name !== 'AbortError' && !err.message?.includes('canceled')) {
        console.error(err);
      }
    }
  };

  const handleToggleSave = async () => {
    if (!user) {
      toast.error("Please sign in to save posts.");
      return;
    }
    const newHasSaved = !hasSaved;
    setHasSaved(newHasSaved);
    setPost((prev: any) => ({
        ...prev,
        stats: {
            ...prev.stats,
            savesCount: Math.max(0, (prev.stats?.savesCount || 0) + (newHasSaved ? 1 : -1))
        }
    }));

    // Trigger instant successful feedback toast
    const toastId = toast.success(newHasSaved ? "Post saved to bookmarks" : "Post removed from bookmarks");

    try {
      const saveRef = doc(db, "saves", `${id}_${user.uid}`);
      const postRef = doc(db, "posts", id!);
      const batch = writeBatch(db);
      if (newHasSaved) {
        batch.set(saveRef, { postId: id, userId: user.uid, createdAt: serverTimestamp() });
        batch.update(postRef, { "stats.savesCount": increment(1), updatedAt: serverTimestamp() });
      } else {
        batch.delete(saveRef);
        batch.update(postRef, { "stats.savesCount": increment(-1), updatedAt: serverTimestamp() });
      }
      await batch.commit();
    } catch (e) {
      console.error(e);
      toast.dismiss(toastId);
      toast.error("Failed to update bookmark.");
      setHasSaved(!newHasSaved);
      setPost((prev: any) => ({
          ...prev,
          stats: {
              ...prev.stats,
              savesCount: Math.max(0, (prev.stats?.savesCount || 0) + (!newHasSaved ? 1 : -1))
          }
      }));
    }
  };
  const [userCommentVotes, setUserCommentVotes] = useState<Record<string, number>>({});
  const [githubStars, setGithubStars] = useState<number | null>(null);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentSortBy, setCommentSortBy] = useState<'top' | 'newest'>('top');
  const [expandedTextState, setExpandedTextState] = useState<Record<string, boolean>>({});
  const [expandedRepliesState, setExpandedRepliesState] = useState<Record<string, number>>({});

  const toggleExpandedText = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setExpandedTextState(prev => ({ ...prev, [id]: !prev[id] }));
  }
  const loadMoreReplies = (id: string, currentVisible: number, total: number, e: React.MouseEvent) => {
      e.stopPropagation();
      setExpandedRepliesState(prev => ({ ...prev, [id]: total }));
  }

  const childrenMap = useMemo(() => {
      const map = new Map<string, any[]>();
      comments.forEach(c => {
          if (c.parentId) {
              if (!map.has(c.parentId)) map.set(c.parentId, []);
              map.get(c.parentId)!.push(c);
          }
      });
      
      const rootComments = comments.filter(c => !c.parentId);
      
      const extractSolutions = (currentId: string, depth: number): any[] => {
          const children = [...(map.get(currentId) || [])];
          let foundSolutions: any[] = [];
          
          for (const child of children) {
              foundSolutions = foundSolutions.concat(extractSolutions(child.id, depth + 1));
          }

          const newChildren = children.filter(child => {
              const checkIsSol = post?.solutionCommentIds?.includes(child.id) || child.isSolution;
              if (checkIsSol && depth > 0) {
                  foundSolutions.push(child);
                  return false;
              }
              return true;
          });
          
          if (newChildren.length !== children.length) {
              map.set(currentId, newChildren);
          }
          
          return foundSolutions;
      };

      for (const root of rootComments) {
          const deepSolutions = extractSolutions(root.id, 0);
          if (deepSolutions.length > 0) {
              const rootChildren = map.get(root.id) || [];
              
              // Only add them if they aren't somehow already there
              const existingIds = new Set(rootChildren.map(c => c.id));
              const toAdd = deepSolutions.filter(c => !existingIds.has(c.id));
              
              map.set(root.id, [...rootChildren, ...toAdd]);
          }
      }
      
      return map;
  }, [comments, post?.solutionCommentIds]);

  const isCommentInSolutionPath = useCallback((cId: string): boolean => {
      const c = comments.find(x => x.id === cId);
      if (!c) return false;
      if (c.isSolution) return true;
      const children = childrenMap.get(cId) || [];
      return children.some(child => isCommentInSolutionPath(child.id));
  }, [comments, childrenMap]);

  useEffect(() => {
    if (post && post.id && commentsLoaded && user && user.uid === post.authorId) {
       const actualCount = comments.length;
       if (post.stats?.commentsCount !== actualCount) {
          updateDoc(doc(db, "posts", post.id), {
             "stats.commentsCount": actualCount
          }).catch(console.error);
       }
    }
  }, [post, comments, commentsLoaded, user]);

  const handleDeleteComment = async (commentId: string) => {
     const commentToDelete = comments.find(c => c.id === commentId);
     const isAdminUser = userProfile?.role === 'admin';
     const isCommentAuthor = user?.uid === commentToDelete?.authorId;

     if (!commentToDelete || !(isCommentAuthor || isAdminUser)) {
        toast.error("You do not have permission to delete this comment.");
        return;
     }

     try {
        const batch = writeBatch(db);
        const idsToDelete = new Set<string>();
        
        const collectDeletes = (cId: string) => {
           idsToDelete.add(cId);
           batch.delete(doc(db, "comments", cId));
           const children = comments.filter(c => c.parentId === cId);
           children.forEach(child => collectDeletes(child.id));
        };
        
        collectDeletes(commentId);
        
        await batch.commit();
        const commentsToRestore = comments.filter(c => idsToDelete.has(c.id));
        setComments(prev => prev.filter(c => !idsToDelete.has(c.id)));
        
        toast('Comment deleted', {
           action: {
              label: 'Undo',
              onClick: async () => {
                 try {
                    const restoreBatch = writeBatch(db);
                    commentsToRestore.forEach((c) => {
                       const cData = { ...c };
                       const cId = cData.id;
                       delete cData.id;
                       restoreBatch.set(doc(db, "comments", cId), cData);
                    });
                    await restoreBatch.commit();
                    setComments(prev => {
                       const fresh = [...prev];
                       commentsToRestore.forEach(c => {
                          if (!fresh.some(x => x.id === c.id)) {
                             fresh.push(c);
                          }
                        });
                        return fresh;
                     });
                     toast.success('Comment restored successfully');
                  } catch (restoreErr) {
                     console.error(restoreErr);
                     toast.error('Failed to restore comment');
                  }
               }
            }
         });
     } catch (e) {
        toast.error("Failed to delete comment");
        handleFirestoreError(e, OperationType.DELETE, `comments/${commentId}`);
     }
  };

  useEffect(() => {
    if (post?.githubUrl) {

       try {
          const urlObj = new URL(post.githubUrl);
          if (urlObj.hostname === 'github.com') {
             const parts = urlObj.pathname.split('/').filter(Boolean);
             if (parts.length >= 2) {
                const owner = parts[0];
                const repo = parts[1];
                fetch(`https://api.github.com/repos/${owner}/${repo}`)
                   .then(res => res.json())
                   .then(data => {
                      if (data && typeof data.stargazers_count === 'number') {
                         setGithubStars(data.stargazers_count);
                      }
                   })
                   .catch(e => console.error("Github api err", e));
             }
          }
       } catch (e) {}
    }
  }, [post?.githubUrl]);
  
  useEffect(() => {
    if (id && user && post) {
      getDoc(doc(db, "likes", `${id}_${user.uid}`)).then(snap => {
        setHasLiked(snap.exists());
      }).catch(err => {
        if (err?.message?.includes("offline") || err?.code === "unavailable") {
          console.warn("Firestore client is offline. Like status loaded in offline mode.");
        } else {
          console.error("Error checking like", err);
        }
      });

      getDoc(doc(db, "dislikes", `${id}_${user.uid}`)).then(snap => {
        setHasDisliked(snap.exists());
      }).catch(err => {
        if (err?.message?.includes("offline") || err?.code === "unavailable") {
          console.warn("Firestore client is offline. Dislike status loaded in offline mode.");
        } else {
          console.error("Error checking dislike", err);
        }
      });
      
      getDoc(doc(db, "saves", `${id}_${user.uid}`)).then(snap => {
        setHasSaved(snap.exists());
      }).catch(err => {
        if (err?.message?.includes("offline") || err?.code === "unavailable") {
          console.warn("Firestore client is offline. Save status loaded in offline mode.");
        } else {
          console.error("Error checking save", err);
        }
      });
    } else {
      setHasLiked(false);
      setHasDisliked(false);
      setHasSaved(false);
    }
  }, [id, user, post?.id]);

  useEffect(() => {
    if (!id) return;
    
    const postRef = doc(db, "posts", id);
    const unsubscribe = onSnapshot(postRef, async (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as any;
        setPost(data);
         sessionCache.set("post_" + id, data);
        
        if (data.authorId) {
            const userSnap = await getDoc(doc(db, "users", data.authorId));
            if (userSnap.exists()) setAuthor(userSnap.data());
        }
      } else {
        setPost(null);
      }
      setLoadingPost(false);
    }, (error) => {
        handleFirestoreError(error, OperationType.GET, `posts/${id}`);
        setLoadingPost(false);
    });

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    
    // Track View Optimistically
    const trackView = async () => {
      if (!user) return; // Wait until Auth is ready (every visitor is assigned an anonymous/logged-in user)
      
      try {
        const viewedPosts = JSON.parse(localStorage.getItem('viewedPosts') || '[]');
        if (viewedPosts.includes(id)) {
           return;
        }

        const viewId = `${id}_${user.uid}`;
        const viewRef = doc(db, "views", viewId);
        
        try {
           const viewSnap = await getDoc(viewRef);
           if (!viewSnap.exists()) {
              await setDoc(viewRef, { postId: id, userId: user.uid, createdAt: serverTimestamp() });
              
              const postRef = doc(db, "posts", id!);
              await updateDoc(postRef, {
                "stats.viewsCount": increment(1),
                updatedAt: serverTimestamp()
              });
           }
           
           // Successfully tracked or already exists in Firebase, cache in localStorage to avoid redundant checks
           if (!viewedPosts.includes(id)) {
              viewedPosts.push(id);
              localStorage.setItem('viewedPosts', JSON.stringify(viewedPosts));
           }
        } catch (e: any) {
           if (!e.message?.includes("Missing or insufficient permissions")) {
               console.warn("View tracking failed", e);
           }
        }
      } catch (err) {
         console.warn("Local View tracking failed", err);
      }
    };
    trackView();

    // Fetch comments/solutions
    const q = query(collection(db, "comments"), where("postId", "==", id));
    const unsubComments = onSnapshot(q, (snap) => {
       const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
       setComments(docs);
       sessionCache.set("comments_" + id, docs);
       setCommentsLoaded(true);
    });
    
    let unsubVotes = () => {};
    if (user && id) {
      const qVotes = query(collection(db, "commentVotes"), where("postId", "==", id), where("userId", "==", user.uid));
      unsubVotes = onSnapshot(qVotes, (snap) => {
        const votes: Record<string, number> = {};
        snap.docs.forEach(d => {
          const data = d.data();
          votes[data.commentId] = data.voteType;
        });
        setUserCommentVotes(votes);
      });
    }

    return () => { 
        unsubComments(); 
        unsubVotes(); 
    };
  }, [id, user]);

  const handleCommentPressStart = (commentId: string, authorId: string) => {
    const isAdminUser = userProfile?.role === 'admin';
    const isCommentAuthor = user?.uid === authorId;
    if (isCommentAuthor || isAdminUser) {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      holdTimerRef.current = setTimeout(() => {
         setLongPressedCommentId(commentId);
      }, 2000);
    }
  };

  const handleCommentPressEnd = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }
  };

  const handleSubmitEditComment = async (commentId: string, originalBody: string) => {
    if (!user || !editCommentBody.trim()) return;

    if (editCommentBody.trim() === originalBody.trim()) {
      setEditingCommentId(null);
      setEditCommentBody("");
      return;
    }

    setIsSubmittingEdit(true);
    try {
       await updateDoc(doc(db, "comments", commentId), {
           body: editCommentBody.trim(),
           isEdited: true,
           updatedAt: serverTimestamp()
       });
       setEditingCommentId(null);
       setEditCommentBody("");
    } catch(e) {
       console.error("Failed to edit comment", e);
    } finally {
       setIsSubmittingEdit(false);
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!id || !user || user.isAnonymous) {
      toast.error("Guest users cannot comment or reply.");
      return;
    }
    if (!replyBody.trim()) return;
    setIsSubmittingReply(true);
    
    try {
       const batch = writeBatch(db);
       const postRef = doc(db, "posts", id);
       
       const commentRef = doc(collection(db, "comments"));
       batch.set(commentRef, {
          postId: id,
          authorId: user.uid,
          parentId,
          body: replyBody,
          createdAt: serverTimestamp()
       });
       
       batch.update(postRef, {
          "stats.commentsCount": increment(1),
          updatedAt: serverTimestamp()
       });
       
       // notify the parent comment author
       const parentAuthorId = comments.find(c => c.id === parentId)?.authorId;
       if (parentAuthorId && parentAuthorId !== user.uid) {
           const notifRef = doc(collection(db, "notifications"));
           batch.set(notifRef, {
               userId: parentAuthorId,
                type: 'reply', commentId: commentRef.id,
               fromUserId: user.uid,
               postId: id,
               read: false,
               createdAt: serverTimestamp()
           });
       }

       // notify mentioned users
       const textWithoutCode = replyBody.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*?`/g, '');
       const mentionMatches = textWithoutCode.match(/@([a-zA-Z0-9_]+)/g);
       
       if (mentionMatches && mentionMatches.length > 0) {
           const handles = Array.from(new Set(mentionMatches.map(m => m.substring(1).toLowerCase())));
           for (const handle of handles.slice(0, 10)) {
               const qStr = query(collection(db, "users"), where("handle", "==", handle));
               const userSnap = await getDocs(qStr);
               if (!userSnap.empty) {
                   const mentionedUserId = userSnap.docs[0].id;
                   if (mentionedUserId !== user.uid && mentionedUserId !== parentAuthorId) {
                       const notifRef = doc(collection(db, "notifications"));
                       batch.set(notifRef, {
                           userId: mentionedUserId,
                           type: 'mention',
                           postId: id,
                           message: `mentioned you in a comment`, commentId: commentRef.id,
                           read: false,
                           fromUserId: user.uid,
                           createdAt: serverTimestamp()
                       });
                   }
               }
           }
       }
       
       await batch.commit();
       setReplyingTo(null);
       setReplyBody("");
    } catch (e) {
       handleFirestoreError(e, OperationType.CREATE, 'comments');
       console.error("Failed to submit reply", e);
    } finally {
       setIsSubmittingReply(false);
    }
  };

  const handleVoteComment = async (commentId: string, voteType: 1 | -1 | 0) => {
    if (!user || user.isAnonymous) {
      toast.error("Guest users cannot vote on comments.");
      return;
    }
    if (!id) return;
    
    const currentVote = userCommentVotes[commentId] || 0;
    let newVoteType = voteType;
    let scoreChange = 0;

    if (currentVote === voteType) {
      // Toggle off
      newVoteType = 0 as any;
      scoreChange = -voteType;
    } else {
      // New vote or switch vote
      scoreChange = voteType - currentVote;
    }

    let downvotesChange = 0;
    if (currentVote === -1 && newVoteType === 1) downvotesChange = -1;
    else if (currentVote === -1 && newVoteType === 0) downvotesChange = -1;
    else if (currentVote === 1 && newVoteType === -1) downvotesChange = 1;
    else if (currentVote === 0 && newVoteType === -1) downvotesChange = 1;

    // Optimistic update
    setUserCommentVotes(prev => ({ ...prev, [commentId]: newVoteType }));
    setComments(prev => prev.map(c => 
      c.id === commentId ? { 
        ...c, 
        score: (c.score || 0) + scoreChange,
        downvotes: (c.downvotes || 0) + downvotesChange
      } : c
    ));

    try {
      const batch = writeBatch(db);
      const voteRef = doc(db, "commentVotes", `${user.uid}_${commentId}`);
      const commentRef = doc(db, "comments", commentId);
      
      const targetComment = comments.find(c => c.id === commentId);

      if (newVoteType === 0) {
        batch.delete(voteRef);
      } else {
        batch.set(voteRef, {
          userId: user.uid,
          postId: id,
          commentId: commentId,
          voteType: newVoteType,
          createdAt: serverTimestamp()
        });
      }

      batch.update(commentRef, {
        score: increment(scoreChange),
        downvotes: increment(downvotesChange)
      });
      
      if (targetComment?.authorId && targetComment.authorId !== user.uid) {
          batch.set(doc(db, "users", targetComment.authorId), {
             stats: { proofScore: increment(scoreChange) },
             updatedAt: serverTimestamp()
          }, { merge: true });
      }

      // Check if we need to auto-remove solution mark
      if (targetComment?.isSolution && post) {
         const threshold = Math.max(1, Math.ceil(comments.length / 2));
         const currentDownvotes = (targetComment.downvotes || 0) + downvotesChange;
         const currentReports = targetComment.reportsCount || 0;
         
         if ((currentDownvotes + currentReports) >= threshold) {
            batch.update(commentRef, { isSolution: false, updatedAt: serverTimestamp() });
            batch.update(doc(db, "posts", id), { status: "open", updatedAt: serverTimestamp() });
            if (targetComment.authorId) {
                batch.set(doc(db, "users", targetComment.authorId), { 
                   stats: {
                      problemsSolved: increment(-1),
                      proofScore: increment(-10)
                   },
                   updatedAt: serverTimestamp() 
                }, { merge: true });
            }
            toast.info("This solution was automatically unmarked due to negative feedback.");
         }
      }

      await batch.commit();
    } catch (err) {
      console.error("Vote failed", err);
      setUserCommentVotes(prev => ({ ...prev, [commentId]: currentVote }));
      setComments(prev => prev.map(c => 
        c.id === commentId ? { 
          ...c, 
          score: (c.score || 0) - scoreChange,
          downvotes: (c.downvotes || 0) - downvotesChange
        } : c
      ));
    }
  };

  const handleReportCommentSubmit = async (commentId: string, reason: string) => {
    if (!user || user.isAnonymous) { toast.error("Guest users cannot report comments."); return; }
    try {
      const reportRefParam = doc(collection(db, "reports"));
      const commentRef = doc(db, "comments", commentId);
      const batch = writeBatch(db);

      const targetComment = comments.find(c => c.id === commentId);

      batch.set(reportRefParam, {
        postId: id || "unknown_post",
        userId: user.uid,
        userName: user.displayName || "Unknown",
        uname: user.displayName ? user.displayName.toLowerCase().replace(/\s+/g, '') : "unknown",
        reason: `[Comment ${commentId}] - ${reason}`,
        recentActivity: { targetType: "comment" },
        createdAt: serverTimestamp()
      });

      batch.update(commentRef, {
        reportsCount: increment(1)
      });
      
      let wasSolutionRemoved = false;
      if (targetComment?.isSolution && post) {
         const threshold = Math.max(1, Math.ceil(comments.length / 2));
         const currentDownvotes = targetComment.downvotes || 0;
         const currentReports = (targetComment.reportsCount || 0) + 1;
         
         if ((currentDownvotes + currentReports) >= threshold) {
            wasSolutionRemoved = true;
            batch.update(commentRef, { isSolution: false, updatedAt: serverTimestamp() });
            if (id) {
               batch.update(doc(db, "posts", id), { status: "open", updatedAt: serverTimestamp() });
            }
            if (targetComment.authorId) {
                batch.set(doc(db, "users", targetComment.authorId), { 
                   stats: {
                      problemsSolved: increment(-1),
                      proofScore: increment(-10)
                   },
                   updatedAt: serverTimestamp() 
                }, { merge: true });
            }
         }
      }

      await batch.commit();
      
      setComments(prev => prev.map(c => 
        c.id === commentId ? { ...c, reportsCount: (c.reportsCount || 0) + 1, isSolution: wasSolutionRemoved ? false : c.isSolution } : c
      ));

      if (wasSolutionRemoved && post) {
         setPost({ ...post, status: "open" } as any);
      }

      toast('Report submitted successfully.', {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
               const undoBatch = writeBatch(db);
               undoBatch.delete(doc(db, "reports", reportRefParam.id));
               undoBatch.update(commentRef, { reportsCount: increment(-1) });
               // We will not auto-restore isSolution on undo, to keep it simple, but we decrement reports
               await undoBatch.commit();
               
               setComments(prev => prev.map(c => 
                 c.id === commentId ? { ...c, reportsCount: Math.max(0, (c.reportsCount || 0) - 1) } : c
               ));
               toast.success("Report undone");
            } catch(err) {
               toast.error("Failed to undo");
            }
          }
        }
      });
      
      if (wasSolutionRemoved) {
         toast.info("This solution was automatically unmarked due to negative feedback.");
      }

    } catch(e) {
      console.error(e);
      toast.error("Failed to submit report.");
    }
  };

  const handleSubmitSolution = async () => {
    if (!id || !user || user.isAnonymous) {
      toast.error("Guest users cannot submit comments or solutions.");
      return;
    }
    if (!solutionBody.trim()) return;
    setIsSubmitting(true);
    
    try {
       const batch = writeBatch(db);
       const postRef = doc(db, "posts", id);
       
       const commentRef = doc(collection(db, "comments"));
       batch.set(commentRef, {
          postId: id,
          authorId: user.uid,
          body: solutionBody,
          createdAt: serverTimestamp()
       });
       
       batch.update(postRef, {
          "stats.commentsCount": increment(1),
          updatedAt: serverTimestamp()
       });
       
       if (post && post.authorId && post.authorId !== user.uid) {
           const notifRef = doc(collection(db, "notifications"));
           batch.set(notifRef, {
               userId: post.authorId,
               type: 'comment',
               fromUserId: user.uid,
               postId: id,
               read: false,
               createdAt: serverTimestamp()
           });
       }

       // notify mentioned users
       const textWithoutCode = solutionBody.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*?`/g, '');
       const mentionMatches = textWithoutCode.match(/@([a-zA-Z0-9_]+)/g);
       
       if (mentionMatches && mentionMatches.length > 0) {
           const handles = Array.from(new Set(mentionMatches.map(m => m.substring(1).toLowerCase())));
           for (const handle of handles.slice(0, 10)) {
               const qStr = query(collection(db, "users"), where("handle", "==", handle));
               const userSnap = await getDocs(qStr);
               if (!userSnap.empty) {
                   const mentionedUserId = userSnap.docs[0].id;
                   if (mentionedUserId !== user.uid && mentionedUserId !== post?.authorId) {
                       const notifRef = doc(collection(db, "notifications"));
                       batch.set(notifRef, {
                           userId: mentionedUserId,
                           type: 'mention',
                           fromUserId: user.uid,
                           postId: id,
                           message: "mentioned you in a comment", commentId: commentRef.id,
                           read: false,
                           createdAt: serverTimestamp()
                       });
                   }
               }
           }
       }
       
       await batch.commit();
       localStorage.removeItem(`solution_draft_${id}`);
       setIsDrawerOpen(false);
       setSolutionBody("");
    } catch (e) {
       handleFirestoreError(e, OperationType.CREATE, 'comments');
       console.error("Failed to submit solution", e);
    } finally {
       setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!id || !user || !editTitle.trim()) return;

    if (
      editTitle.trim() === post.title.trim() &&
      editBody.trim() === (post.body || "").trim() &&
      editStatus === post.status &&
      (editCategory === "none" || editCategory === post.category)
    ) {
        setIsEditing(false);
        return;
    }

    setIsSavingEdit(true);
    try {
      const postRef = doc(db, "posts", id);
      
      const searchData = generateSearchData({
        title: editTitle.trim(),
        body: editBody.trim(),
        category: post.category,
        tags: post.tags,
        authorName: author?.displayName || "",
        authorHandle: author?.handle || ""
      });

      const updatedPayload: any = {
        title: editTitle.trim(),
        body: editBody.trim(),
        status: editStatus,
        search: searchData,
        isEdited: true,
        updatedAt: serverTimestamp()
      };

      if (editCategory !== "none") updatedPayload.category = editCategory;

      await setDoc(postRef, updatedPayload, { merge: true });
      localStorage.removeItem(`edit_post_draft_${id}`);
      setIsEditing(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `posts/${id}`);
      console.error("Failed to edit post", e);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeletePost = async () => {
    if (!id || !user) return;
    try {
      const postData = { ...post };
      delete postData.id;
      
      const batch = writeBatch(db);
      batch.delete(doc(db, "posts", id));
      
      const commentsRef = collection(db, "comments");
      const q = query(commentsRef, where("postId", "==", id));
      const querySnapshot = await getDocs(q);
      const deletedComments: any[] = [];
      querySnapshot.forEach((docSnap) => {
        deletedComments.push({ id: docSnap.id, ...docSnap.data() });
        batch.delete(doc(db, "comments", docSnap.id));
      });
      await batch.commit();

      toast('Post deleted permanently', {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              const restoreBatch = writeBatch(db);
              restoreBatch.set(doc(db, "posts", id), postData);
              deletedComments.forEach((c) => {
                const cData = { ...c };
                const cId = cData.id;
                delete cData.id;
                restoreBatch.set(doc(db, "comments", cId), cData);
              });
              await restoreBatch.commit();
              toast.success('Post restored successfully');
              navigate(`/problems/${id}`);
            } catch (restoreErr) {
              console.error(restoreErr);
              toast.error('Failed to restore post');
            }
          }
        }
      });
      navigate("/explore");
    } catch (e) {
      toast.error("Failed to delete post");
      handleFirestoreError(e, OperationType.DELETE, `posts/${id}`);
    }
  };

  const handleSendToTrash = async () => {
    if (!id || !user) return;
    
    const originalStatus = post?.status || "open";

    try {
      await setDoc(doc(db, "posts", id), { status: "trashed", updatedAt: serverTimestamp() }, { merge: true });
      
      toast('Post moved to trash', {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await setDoc(doc(db, "posts", id), { status: originalStatus, updatedAt: serverTimestamp() }, { merge: true });
              toast.success('Post restored');
            } catch (error) {
              console.error("Failed to restore post:", error);
              toast.error('Failed to restore post');
            }
          }
        },
      });

      navigate("/explore");
    } catch (e) {
      toast.error('Failed to send to trash');
      handleFirestoreError(e, OperationType.UPDATE, `posts/${id}`);
    }
  };

  const handleReportPost = async () => {
    if (!id || !user || user.isAnonymous) {
       toast.error("Guest users cannot report posts.");
       return;
    }
    setShowReportPostModal(true);
  };

  const handleReportPostSubmit = async (reason: string, suggestions: string = "") => {
    if (!id || !user || user.isAnonymous) {
       toast.error("Guest users cannot report posts.");
       return;
    }
    
    try {
      const reportRef = doc(collection(db, "reports"));
      await setDoc(reportRef, {
        postId: id,
        userId: user.uid,
        userName: user.displayName || "Unknown User",
        uname: user.displayName ? user.displayName.toLowerCase().replace(/\s+/g, '') : "unknown",
        reason: reason.trim(),
        suggestions: suggestions.trim(),
        recentActivity: {
          postType: post?.type || "unknown",
          postStatus: post?.status || "unknown"
        },
        createdAt: serverTimestamp()
      });
      toast('Report submitted successfully.', {
        action: {
          label: 'Undo',
          onClick: async () => {
             try {
                await deleteDoc(doc(db, "reports", reportRef.id));
                toast.success("Report undone");
             } catch (error) {
                console.error("Failed to undo report:", error);
                toast.error("Failed to undo report");
             }
          }
        }
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `reports`);
    }
  };

  if (loadingPost) {
      return <DetailSkeleton />;
  }

  if (!post || (post.status === 'trashed' && (!user || post.authorId !== user.uid))) {
      return (
         <div className="flex flex-col items-center justify-center py-32 text-center">
            <AlertTriangle className="w-12 h-12 text-buildops-text-secondary mb-4 opacity-50" />
            <h2 className="text-2xl font-bold mb-2">404: Not Found</h2>
            <p className="text-buildops-text-secondary">This post doesn't exist, has been deleted, or you don't have access.</p>
            <Link to="/explore" className="mt-6 px-6 py-2.5 bg-buildops-text text-buildops-bg rounded-xl font-medium hover:bg-white transition-colors">
               Go back to Feed
            </Link>
         </div>
      );
  }

  let timeAgo = "just now";
  let dateStr = "";
  if (post.createdAt) {
      let dateObj: Date | null = null;
      if (typeof post.createdAt === 'string') {
          dateObj = new Date(post.createdAt);
      } else if (post.createdAt.toDate) {
          dateObj = post.createdAt.toDate();
      } else if (post.createdAt instanceof Date) {
          dateObj = post.createdAt;
      }
      if (dateObj) {
          timeAgo = formatPostTime(dateObj);
          dateStr = format(dateObj, "MMM d, yyyy");
      }
  }

  let editedTimeStr = "";
  if (post && post.isEdited) {
      let editDateObj: Date | null = null;
      if (post.updatedAt) {
          if (typeof post.updatedAt === 'string') {
              editDateObj = new Date(post.updatedAt);
          } else if (post.updatedAt.toDate) {
              editDateObj = post.updatedAt.toDate();
          } else if (post.updatedAt instanceof Date) {
              editDateObj = post.updatedAt;
          }
      }
      if (!editDateObj) {
          editDateObj = new Date();
      }
      editedTimeStr = format(editDateObj, "MMM d, yyyy h:mm a");
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 pb-16 lg:pb-0 relative">
      {/* Main Content */}
      <div className="flex-1 w-full max-w-4xl min-w-0">
        <div className="sticky top-0 z-40 bg-buildops-bg/95 backdrop-blur-md h-14 mb-6 px-3 sm:px-4 md:px-5 lg:px-6 border-b border-[rgba(255,255,255,0.05)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-buildops-text-secondary hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-mono font-bold text-buildops-text">post</h1>
          </div>
          <div className="flex items-center gap-2 text-buildops-text-secondary">
            <Link to="/search" className="p-2 rounded-full text-buildops-text-secondary hover:text-buildops-text hover:bg-white/5 transition-colors flex items-center justify-center">
              <Search className="w-5 h-5" />
            </Link>
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
                className="p-2 rounded-full text-buildops-text-secondary hover:text-buildops-text hover:bg-white/5 transition-colors flex items-center justify-center cursor-pointer"
                title="Options"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {isMenuOpen && (
                <>
                  <div className="fixed inset-0 z-35" onClick={() => setIsMenuOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-buildops-card border border-buildops-border rounded-xl shadow-xl z-50 py-1.5 text-left font-sans animate-fade-in">
                    {user?.uid === post?.authorId ? (
                      <>
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setIsMenuOpen(false);
                            setEditTitle(post?.title || "");
                            setEditBody(post?.body || "");
                            setEditStatus(post?.status || "none");
                            setEditCategory(post?.category || "none");
                            setIsEditing(true); 
                          }} 
                          className="w-full text-left px-4 py-2.5 text-sm text-buildops-text hover:bg-white/5 transition-colors flex items-center gap-2.5 cursor-pointer border-0 bg-transparent font-medium"
                        >
                          <Edit2 className="w-4 h-4 text-buildops-text-secondary" />
                          Edit Post
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); handleDeletePost(); }} 
                          className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-2.5 cursor-pointer border-0 bg-transparent font-medium"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                          Delete Post
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); handleShare(); }} 
                          className="w-full text-left px-4 py-2.5 text-sm text-buildops-text hover:bg-white/5 transition-colors flex items-center gap-2.5 cursor-pointer border-0 bg-transparent font-medium"
                        >
                          <Upload className="w-4 h-4 text-buildops-text-secondary" />
                          Share Post
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); handleToggleSave(); }} 
                          className="w-full text-left px-4 py-2.5 text-sm text-buildops-text hover:bg-white/5 transition-colors flex items-center gap-2.5 cursor-pointer border-0 bg-transparent font-medium"
                        >
                          <Bookmark className="w-4 h-4 text-buildops-text-secondary" />
                          {hasSaved ? "Remove Bookmark" : "Bookmark Post"}
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="px-3 sm:px-4 md:px-5 lg:px-6 space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <Link to={`/profile/${post.authorId}`} className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-buildops-card flex items-center justify-center border border-buildops-border hover:opacity-80 transition-opacity">
                {author?.photoURL ? (
                  <img src={author.photoURL} alt={author?.displayName || 'User'} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-buildops-text-secondary" />
                )}
              </Link>
             <div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Link to={`/profile/${post.authorId}`} className="font-bold text-base text-buildops-text hover:underline truncate max-w-[200px] sm:max-w-[300px]">
                      {author?.displayName || 'Unknown Builder'}
                    </Link>
                    {author?.role === 'verified' && <CheckCircle2 className="w-4 h-4 text-buildops-blue shrink-0 hidden sm:block" />}
                    {post.authorId && user?.uid !== post.authorId && (
                      <div className="ml-2">
                         <FollowButton targetId={post.authorId} variant="text" />
                      </div>
                    )}
                  </div>
                  <Link to={`/profile/${post.authorId}`} className="text-buildops-text-secondary text-sm hover:underline truncate max-w-[200px] sm:max-w-[200px]">
                    @{author?.handle || 'user'}
                  </Link>
                </div>
              </div>
            </div>

          </div>
          
          <div className="flex flex-wrap items-center gap-2 mb-3">
          </div>
          
          {isEditing ? (
             <div className="space-y-4 mb-4">
                <input 
                  type="text" 
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-buildops-card border border-buildops-border rounded-lg px-4 py-2 text-xl font-bold text-buildops-text focus:outline-none focus:border-buildops-blue"
                  placeholder="Post Title"
                />
             </div>
          ) : (
            <>
                {post.type === "build" && (
                    <div className="mb-2 text-xs font-mono font-medium text-buildops-blue uppercase">
                        # build_showcase
                    </div>
                )}
                <h1 className="text-2xl md:text-3xl font-bold text-buildops-text mb-4 leading-tight">
                  {renderTextWithMentions(post.title, false)}
                </h1>
                {(post.githubUrl || post.liveUrl) && (
                    <div className="flex gap-3 mb-4">
                       {post.githubUrl && (
                          <a href={post.githubUrl} target="_blank" rel="noopener noreferrer" className="flex text-sm items-center gap-2 text-buildops-text-secondary hover:text-buildops-text transition-colors border border-buildops-border rounded px-3 py-1.5 bg-buildops-card">
                             <Github className="w-4 h-4" />
                             Repository
                          </a>
                       )}
                       {post.liveUrl && (
                          <a href={post.liveUrl} target="_blank" rel="noopener noreferrer" className="flex text-sm items-center gap-2 text-buildops-text-secondary hover:text-buildops-text transition-colors border border-buildops-border rounded px-3 py-1.5 bg-buildops-card">
                             <Globe className="w-4 h-4" />
                             Live Demo
                          </a>
                       )}
                    </div>
                )}
            </>
          )}

        </div>

        {/* User Description (Raw) */}
        <section className="space-y-4">
          {isEditing ? (
             <div className="space-y-4">
               <CodeEditor 
                  value={editBody}
                  onChange={setEditBody}
                  placeholder="Post Body"
                  height="165px"
               />
               <div className="flex gap-2">
                  <button 
                    onClick={handleSaveEdit}
                    disabled={isSavingEdit}
                    className="px-4 py-2 bg-buildops-blue text-white font-bold rounded flex-1 hover:bg-opacity-90 disabled:opacity-50"
                  >
                    {isSavingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-buildops-bg border border-buildops-border text-buildops-text font-bold rounded flex-1 hover:bg-buildops-card"
                  >
                    Cancel
                  </button>
               </div>
             </div>
          ) : (post.body && post.body.trim() ? (() => {
            const words = post.body.trim().split(/\s+/).filter(Boolean);
            const totalWords = words.length;
            let limit = totalWords;
            let isTruncated = false;
            if (totalWords > 50) {
              const numParts = (totalWords / 3 >= 50) ? 3 : 2;
              if (visiblePartsCount < numParts) {
                limit = Math.floor((visiblePartsCount * totalWords) / numParts);
                isTruncated = true;
              }
            }
            const { excerpt } = getWordsExcerpt(post.body, limit);
            return (
              <div className="mb-1">
                <div className="text-[17px] text-buildops-text/95 leading-snug font-sans whitespace-pre-wrap break-words">
                  {renderTextWithMentions(excerpt, settings.markdownRendering)}
                </div>
                {isTruncated && (
                  <button 
                    onClick={() => {
                      setVisiblePartsCount(prev => prev + 1);
                    }} 
                    className="text-buildops-blue text-sm font-medium hover:underline mt-2 cursor-pointer border-0 bg-transparent p-0 block"
                  >
                    Read more
                  </button>
                )}
              </div>
            );
          })() : null)}
          
          {!isEditing && (
             <div className="text-sm text-buildops-text-secondary mt-2 mb-4" title={dateStr}>
                {timeAgo === dateStr ? dateStr : `${timeAgo}`} {post.isEdited && <span className="ml-1 text-buildops-text-secondary">{editedTimeStr ? `(edited ${editedTimeStr})` : '(edited)'}</span>}
             </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between w-full text-buildops-text-secondary pt-4 border-t border-[rgba(255,255,255,0.1)] pb-2">
            {/* Like Button */}
            <button 
              onClick={async (e) => {
                e.stopPropagation();
                if (!user || user.isAnonymous) {
                  toast.error("Guest users cannot like posts.");
                  return;
                }
                
                if (isLiking || isDisliking) return;
                setIsLiking(true);

                const newHasLiked = !hasLiked;
                const shouldRemoveDislike = newHasLiked && hasDisliked;

                setHasLiked(newHasLiked);
                if (shouldRemoveDislike) setHasDisliked(false);

                setPost((prev: any) => ({
                    ...prev,
                    stats: {
                        ...prev.stats,
                        likesCount: Math.max(0, (prev.stats?.likesCount || 0) + (newHasLiked ? 1 : -1)),
                        dislikesCount: Math.max(0, (prev.stats?.dislikesCount || 0) + (shouldRemoveDislike ? -1 : 0))
                    }
                }));
                
                try {
                  const dislikeId = `${id}_${user.uid}`;
                  const likeId = `${id}_${user.uid}`;
                  const postRef = doc(db, "posts", id!);
                  const likeRef = doc(db, "likes", likeId);
                  const dislikeRef = doc(db, "dislikes", dislikeId);
                  
                  const batch = writeBatch(db);
                  
                  if (newHasLiked) {
                    batch.set(likeRef, {
                      postId: id,
                      userId: user.uid,
                      createdAt: serverTimestamp()
                    });
                    batch.update(postRef, {
                      "stats.likesCount": increment(1),
                      updatedAt: serverTimestamp()
                    });

                    if (shouldRemoveDislike) {
                      batch.delete(dislikeRef);
                      batch.update(postRef, {
                        "stats.dislikesCount": increment(-1),
                        updatedAt: serverTimestamp()
                      });
                    }
                    
                    if (post && post.authorId && post.authorId !== user.uid) {
                      const notifRef = doc(collection(db, "notifications"));
                      batch.set(notifRef, {
                        userId: post.authorId,
                        fromUserId: user.uid,
                        postId: id,
                        type: 'like',
                        read: false,
                        createdAt: serverTimestamp()
                      });
                    }
                  } else {
                    batch.delete(likeRef);
                    batch.update(postRef, {
                       "stats.likesCount": increment(-1),
                       updatedAt: serverTimestamp()
                    });
                  }
                  await batch.commit();
                } catch (err) {
                  console.error(err);
                  setHasLiked(!newHasLiked); // Revert on failure
                  if (shouldRemoveDislike) setHasDisliked(true);
                  setPost((prev: any) => ({
                      ...prev,
                      stats: {
                          ...prev.stats,
                          likesCount: Math.max(0, (prev.stats?.likesCount || 0) + (newHasLiked ? -1 : 1)),
                          dislikesCount: Math.max(0, (prev.stats?.dislikesCount || 0) + (shouldRemoveDislike ? 1 : 0))
                      }
                  }));
                } finally {
                  setIsLiking(false);
                }
              }} 
              className={`flex items-center justify-center flex-1 gap-1.5 transition-colors group ${hasLiked ? 'text-buildops-blue' : 'hover:text-buildops-blue'}`}
            >
              <div className={`p-1.5 flex items-center justify-center rounded-full transition-colors ${hasLiked ? 'bg-buildops-blue/10' : 'group-hover:bg-buildops-blue/10'}`}>
                <ThumbsUp className={`w-5 h-5 ${hasLiked ? 'fill-current' : ''}`} />
              </div>
              <span className="font-medium">{formatCount(post.stats?.likesCount || 0)}</span>
            </button>

            {/* Dislike Button */}
            <button 
              onClick={async (e) => {
                e.stopPropagation();
                if (!user || user.isAnonymous) {
                  toast.error("Guest users cannot dislike posts.");
                  return;
                }
                
                if (isLiking || isDisliking) return;
                setIsDisliking(true);

                const newHasDisliked = !hasDisliked;
                const shouldRemoveLike = newHasDisliked && hasLiked;

                setHasDisliked(newHasDisliked);
                if (shouldRemoveLike) setHasLiked(false);

                setPost((prev: any) => ({
                    ...prev,
                    stats: {
                        ...prev.stats,
                        dislikesCount: Math.max(0, (prev.stats?.dislikesCount || 0) + (newHasDisliked ? 1 : -1)),
                        likesCount: Math.max(0, (prev.stats?.likesCount || 0) + (shouldRemoveLike ? -1 : 0))
                    }
                }));
                
                try {
                  const dislikeId = `${id}_${user.uid}`;
                  const likeId = `${id}_${user.uid}`;
                  const postRef = doc(db, "posts", id!);
                  const likeRef = doc(db, "likes", likeId);
                  const dislikeRef = doc(db, "dislikes", dislikeId);
                  
                  const batch = writeBatch(db);
                  
                  if (newHasDisliked) {
                    batch.set(dislikeRef, {
                      postId: id,
                      userId: user.uid,
                      createdAt: serverTimestamp()
                    });
                    batch.update(postRef, {
                      "stats.dislikesCount": increment(1),
                      updatedAt: serverTimestamp()
                    });

                    if (shouldRemoveLike) {
                      batch.delete(likeRef);
                      batch.update(postRef, {
                        "stats.likesCount": increment(-1),
                        updatedAt: serverTimestamp()
                      });
                    }
                  } else {
                    batch.delete(dislikeRef);
                    batch.update(postRef, {
                       "stats.dislikesCount": increment(-1),
                       updatedAt: serverTimestamp()
                    });
                  }
                  await batch.commit();
                } catch (err) {
                  console.error(err);
                  setHasDisliked(!newHasDisliked); // Revert on failure
                  if (shouldRemoveLike) setHasLiked(true);
                  setPost((prev: any) => ({
                      ...prev,
                      stats: {
                          ...prev.stats,
                          dislikesCount: Math.max(0, (prev.stats?.dislikesCount || 0) + (newHasDisliked ? -1 : 1)),
                          likesCount: Math.max(0, (prev.stats?.likesCount || 0) + (shouldRemoveLike ? 1 : 0))
                      }
                  }));
                } finally {
                  setIsDisliking(false);
                }
              }} 
              className={`flex items-center justify-center flex-1 gap-1.5 transition-colors group ${hasDisliked ? 'text-buildops-orange' : 'hover:text-buildops-orange'}`}
            >
              <div className={`p-1.5 flex items-center justify-center rounded-full transition-colors ${hasDisliked ? 'bg-buildops-orange/10' : 'group-hover:bg-buildops-orange/10'}`}>
                <ThumbsDown className={`w-5 h-5 ${hasDisliked ? 'fill-current' : ''}`} />
              </div>
              <span className="font-medium">{formatCount(post.stats?.dislikesCount || 0)}</span>
            </button>

            <div className="flex items-center justify-center flex-1 gap-1.5 text-buildops-text-secondary/80 pointer-events-none" title="Views">
              <div className="p-1.5 flex items-center justify-center">
                <BarChart2 className="w-5 h-5" />
              </div>
              <span className="font-medium">{formatCount(post.stats?.viewsCount || 0)}</span>
            </div>

            <button 
              onClick={async (e) => {
                 e.stopPropagation();
                 try {
                   const url = window.location.href;
                   if (user) {
                     const shareRef = doc(db, "shares", `${id}_${user.uid}`);
                     setDoc(shareRef, { postId: id, userId: user.uid, createdAt: serverTimestamp() }, { merge: true }).catch(() => {});
                   }
                   if (navigator.share) {
                     await navigator.share({ title: post.title, url: url });
                   } else {
                     await navigator.clipboard.writeText(url);
                     toast.success("Link copied!");
                   }
                   
                   if (user) {
                     const postRef = doc(db, "posts", id!);
                     await updateDoc(postRef, {
                       "stats.sharesCount": increment(1),
                       updatedAt: serverTimestamp()
                     });
                     setPost((prev: any) => ({
                       ...prev,
                       stats: {
                         ...prev.stats,
                         sharesCount: (prev.stats?.sharesCount || 0) + 1
                       }
                     }));
                   }
                 } catch (err: any) {
                   if (err.name !== 'AbortError' && !err.message?.includes('canceled')) {
                     console.error(err);
                   }
                 }
               }}
               className="flex items-center justify-center flex-1 gap-1.5 hover:text-buildops-blue transition-colors group"
            >
              <div className="p-1.5 flex items-center justify-center rounded-full group-hover:bg-buildops-blue/10 transition-colors">
                <Upload className="w-5 h-5" />
              </div>
              <span className="font-medium">{formatCount(post.stats?.sharesCount || 0)}</span>
            </button>

            <button 
              onClick={async (e) => {
                e.stopPropagation();
                if (!user) {
                  toast.error("Please sign in to save posts.");
                  return;
                }
                const newHasSaved = !hasSaved;
                setHasSaved(newHasSaved);
                setPost((prev: any) => ({
                    ...prev,
                    stats: {
                        ...prev.stats,
                        savesCount: Math.max(0, (prev.stats?.savesCount || 0) + (newHasSaved ? 1 : -1))
                    }
                }));

                const toastId = toast.success(newHasSaved ? "Post saved!" : "Post unsaved!");

                try {
                      const saveRef = doc(db, "saves", `${id}_${user.uid}`);
                      const postRef = doc(db, "posts", id!);

                      if (newHasSaved) {
                          await setDoc(saveRef, { postId: id, userId: user.uid, createdAt: serverTimestamp() });
                          await updateDoc(postRef, { "stats.savesCount": increment(1) });
                      } else {
                          await deleteDoc(saveRef);
                          await updateDoc(postRef, { "stats.savesCount": increment(-1) });
                      }
                  } catch (e) {
                      console.error("Save failure", e);
                      toast.dismiss(toastId);
                      toast.error("Failed to update bookmark.");
                      // Revert optimism
                      setHasSaved(!newHasSaved);
                      setPost((prev: any) => ({
                          ...prev,
                          stats: {
                              ...prev.stats,
                              savesCount: Math.max(0, (prev.stats?.savesCount || 0) + (!newHasSaved ? 1 : -1))
                          }
                      }));
                  }
              }} 
              className={`flex items-center justify-center flex-1 gap-1.5 transition-colors group ${hasSaved ? 'text-buildops-blue' : 'hover:text-buildops-blue'}`}
            >
              <div className={`p-1.5 flex items-center justify-center rounded-full transition-colors ${hasSaved ? 'bg-buildops-blue/10' : 'group-hover:bg-buildops-blue/10'}`}>
                <Bookmark className={`w-5 h-5 ${hasSaved ? 'fill-current' : ''}`} />
              </div>
            </button>
          </div>
        </section>

        {/* Comments Section */}
        <section className="pt-6 border-t border-buildops-border">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 mb-6">
            <h2 className="text-xl font-bold text-buildops-text">Comments <span className="text-buildops-text-secondary font-normal text-base">({formatCount(comments.length)})</span></h2>
            
            {comments.length > 0 && (
              <div className="flex items-center gap-2 relative">
                 <ListFilter className="w-5 h-5 text-buildops-text" />
                 <span className="text-buildops-text font-semibold text-sm">Sort by</span>
                 <select
                    value={commentSortBy}
                    onChange={(e) => setCommentSortBy(e.target.value as 'top' | 'newest')}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                 >
                    <option value="top">Top comments</option>
                    <option value="newest">Newest first</option>
                 </select>
                 <span className="text-buildops-text-secondary text-sm ml-1 pointer-events-none">
                    {commentSortBy === 'top' ? 'Top comments' : 'Newest first'}
                 </span>
                 <ChevronDown className="w-4 h-4 text-buildops-text-secondary pointer-events-none ml-[-2px]" />
              </div>
            )}
          </div>

          {/* YouTube Style Add Comment Box */}
          {user && (
            <div className="flex gap-2 sm:gap-4 mb-8">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-buildops-card border border-buildops-border overflow-hidden flex items-center justify-center shrink-0 mt-0.5">
                 {(() => {
                   const avatar = userProfile ? userProfile.photoURL : (user ? user.photoURL : null);
                   return avatar ? (
                     <img src={avatar} alt="User" className="w-full h-full object-cover" />
                   ) : (
                     <User className="w-4 h-4 sm:w-5 sm:h-5 text-buildops-text-secondary" />
                   );
                 })()}
              </div>
              <div className="flex-1 flex flex-col min-w-0">
                 <textarea 
                   value={solutionBody}
                   onChange={(e) => {
                     setSolutionBody(e.target.value);
                     e.target.style.height = "auto";
                     e.target.style.height = e.target.scrollHeight + "px";
                   }}
                   onFocus={(e) => {
                     setIsDrawerOpen(true);
                     const target = e.target;
                     setTimeout(() => {
                       target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                     }, 300);
                   }}
                   placeholder="Add a comment..."
                   className="w-full bg-transparent border-b border-buildops-border focus:border-buildops-text text-sm pb-1 text-buildops-text focus:outline-none resize-none transition-colors min-h-[30px] overflow-hidden"
                   rows={1}
                 />
                 {isDrawerOpen && (
                   <div className="flex flex-wrap justify-end gap-2 pr-1 pt-3">
                     <button 
                       onClick={() => {
                         setIsDrawerOpen(false);
                         setSolutionBody("");
                       }}
                       className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-buildops-text hover:bg-buildops-card rounded-full transition-colors"
                     >
                       Cancel
                     </button>
                     <button
                       onClick={handleSubmitSolution}
                       disabled={isSubmitting || !solutionBody.trim()}
                       className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium bg-buildops-blue text-white rounded-full transition-colors disabled:opacity-50 disabled:bg-buildops-border disabled:text-buildops-text-secondary"
                     >
                       {isSubmitting ? 'Posting...' : 'Comment'}
                     </button>
                   </div>
                 )}
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 pb-24 custom-scrollbar">
            {comments.length === 0 ? (
               <div className="p-6 border border-buildops-border rounded-lg text-center text-buildops-text-secondary text-sm">
                 No comments yet. Be the first!
               </div>
            ) : (() => {
                 const renderComment = (comment: any, depth = 0, hideReplies = false) => {
                      const author = commentUsers[comment.authorId];
                      const replies = [...(childrenMap.get(comment.id) || [])];
                      replies.sort((a, b) => {
                        const aIsSolution = isCommentInSolutionPath(a.id);
                        const bIsSolution = isCommentInSolutionPath(b.id);
                        if (aIsSolution && !bIsSolution) return -1;
                        if (!aIsSolution && bIsSolution) return 1;
                        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                        return aTime - bTime;
                      });
                      
                      const isSolutionPath = isCommentInSolutionPath(comment.id);
                      const isActualSolution = comment.isSolution;

                      const parentComment = depth > 0 ? comments.find((c: any) => c.id === comment.parentId) : null;
                      const parentAuthor = parentComment ? commentUsers[parentComment.authorId] : null;

                      return (
                        <div 
                          key={comment.id}
                          id={`comment-${comment.id}`}
                          className={cn(
                            "group transition-all",
                            depth === 0 
                                ? `border-b border-buildops-border hover:bg-buildops-card/50 ${settings.threadStyle === 'compact' ? 'py-3 px-3 sm:px-4' : 'py-4 px-3 sm:px-4 sm:py-5'}` 
                                : `mt-3 relative ${settings.threadStyle === 'compact' ? 'pl-2' : ''}`
                          )}
                          onTouchStart={() => handleCommentPressStart(comment.id, comment.authorId)}
                          onTouchEnd={handleCommentPressEnd}
                          onTouchMove={handleCommentPressEnd}
                          onMouseDown={() => handleCommentPressStart(comment.id, comment.authorId)}
                          onMouseUp={handleCommentPressEnd}
                          onMouseLeave={handleCommentPressEnd}
                        >

                           <div className="flex gap-2 sm:gap-3">
                              <Link to={`/profile/${comment.authorId}`} className="w-8 h-8 rounded-full border border-buildops-border bg-buildops-bg overflow-hidden flex items-center justify-center shrink-0 mt-1">
                                 {author?.photoURL ? (
                                    <img src={author.photoURL} alt="User" className="w-full h-full object-cover" />
                                 ) : (
                                    <User className="w-5 h-5 text-buildops-text-secondary" />
                                 )}
                              </Link>
                              <div className="flex-1 min-w-0">
                                 <div className="flex flex-col mb-1 animate-fade-in">
                                    <div className="flex items-start justify-between gap-1">
                                      <div className="flex flex-wrap items-baseline gap-x-2 min-w-0">
                                        <Link to={`/profile/${comment.authorId}`} className="font-bold text-sm text-buildops-text hover:underline truncate max-w-[120px] sm:max-w-[200px]">
                                          {author?.displayName || 'Unknown User'}
                                        </Link>
                                        <span className="text-xs text-buildops-text-secondary">
                                          {comment.createdAt?.toDate ? formatPostTime(comment.createdAt.toDate()) : ''}
                                        </span>
                                      </div>
                                      
                                      <div className="relative shrink-0 select-none">
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            setActiveCommentMenuId(activeCommentMenuId === comment.id ? null : comment.id);
                                          }}
                                          className="p-2 rounded-full text-buildops-text-secondary hover:text-buildops-text hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer border-0 bg-transparent"
                                          title="Options"
                                        >
                                           <MoreVertical className="w-5 h-5" />
                                        </button>
                                        {activeCommentMenuId === comment.id && (
                                          <>
                                            <div 
                                              className="fixed inset-0 z-[55] bg-transparent" 
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                setActiveCommentMenuId(null);
                                              }}
                                            />
                                            <div className="absolute right-1 top-full mt-1.5 w-36 bg-buildops-card border border-buildops-border rounded-xl shadow-xl z-[60] py-1.5 text-left font-sans animate-fade-in">
                                              {user?.uid === comment.authorId ? (
                                                <>
                                                  <button 
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      e.preventDefault();
                                                      setActiveCommentMenuId(null);
                                                      setEditingCommentId(comment.id);
                                                      setEditCommentBody(comment.body);
                                                    }}
                                                    className="w-full text-left px-4 py-2.5 text-sm text-buildops-text hover:bg-white/5 transition-colors flex items-center gap-2.5 cursor-pointer border-0 bg-transparent font-medium"
                                                  >
                                                    <Edit2 className="w-4 h-4 text-buildops-text-secondary" />
                                                    Edit
                                                  </button>
                                                  <button 
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      e.preventDefault();
                                                      setActiveCommentMenuId(null);
                                                      setLongPressedCommentId(comment.id);
                                                    }}
                                                    className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-2.5 cursor-pointer border-0 bg-transparent font-medium"
                                                  >
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                    Delete
                                                  </button>
                                                </>
                                              ) : (
                                                <button 
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    setActiveCommentMenuId(null);
                                                    setReportingCommentId(comment.id);
                                                  }}
                                                  className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-2.5 cursor-pointer border-0 bg-transparent font-medium"
                                                >
                                                  <AlertTriangle className="w-4 h-4 text-red-500" />
                                                  Report
                                                </button>
                                              )}
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                      <Link to={`/profile/${comment.authorId}`} className="text-xs text-buildops-text-secondary hover:underline truncate max-w-[100px]">@{author?.handle || 'user'}</Link>
                                      {comment.isEdited && (
                                        <span className="text-xs text-buildops-text-secondary ml-1">
                                          {(() => {
                                            let editDateObj: Date | null = null;
                                            if (comment.updatedAt) {
                                                if (typeof comment.updatedAt === 'string') {
                                                    editDateObj = new Date(comment.updatedAt);
                                                } else if (comment.updatedAt.toDate) {
                                                    editDateObj = comment.updatedAt.toDate();
                                                } else if (comment.updatedAt instanceof Date) {
                                                    editDateObj = comment.updatedAt;
                                                }
                                            }
                                            if (!editDateObj) {
                                                editDateObj = new Date();
                                            }
                                            const commentEditedStr = format(editDateObj, "MMM d, yyyy h:mm a");
                                            return `(edited ${commentEditedStr})`;
                                          })()}
                                        </span>
                                      )}
                                      {depth > 0 && parentAuthor && parentComment && (
                                         <span className="text-xs text-buildops-text-secondary flex items-center ml-1">
                                            <span className="mx-1">•</span>
                                            Replying to <Link to={`/profile/${parentComment.authorId}`} className="ml-1 text-buildops-blue hover:underline">@{parentAuthor.handle || parentAuthor.displayName}</Link>
                                         </span>
                                      )}
                                      {comment.isSolution && <span className="text-xs font-semibold text-buildops-green bg-buildops-green/10 px-2.5 py-0.5 rounded-full ml-2 flex items-center gap-1 border border-buildops-green/20"><CheckCircle2 className="w-3.5 h-3.5"/> Solution</span>}
                                    </div>
                                 </div>
                                 {editingCommentId === comment.id ? (
                                    <div className="mt-1 flex flex-col gap-2">
                                       <textarea
                                         autoFocus
                                         onFocus={(e) => {
                                           const target = e.target;
                                           setTimeout(() => {
                                             target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                           }, 300);
                                         }}
                                         value={editCommentBody}
                                         onChange={(e) => {
                                           setEditCommentBody(e.target.value);
                                           e.target.style.height = "auto";
                                           e.target.style.height = e.target.scrollHeight + "px";
                                         }}
                                         className="w-full bg-transparent border-b border-buildops-border focus:border-buildops-text text-sm pb-1 text-buildops-text focus:outline-none resize-none transition-colors min-h-[30px] overflow-hidden"
                                         rows={1}
                                       />
                                       <div className="flex justify-end gap-2">
                                          <button 
                                            onClick={() => { setEditingCommentId(null); setEditCommentBody(""); }}
                                            className="text-xs font-medium text-buildops-text-secondary hover:text-buildops-text transition-colors"
                                          >
                                            Cancel
                                          </button>
                                          <button 
                                            onClick={() => handleSubmitEditComment(comment.id, comment.body)}
                                            disabled={isSubmittingEdit || !editCommentBody.trim()}
                                            className="text-xs font-medium text-buildops-blue hover:text-buildops-blue/80 transition-colors disabled:opacity-50"
                                          >
                                            {isSubmittingEdit ? "Saving..." : "Save"}
                                          </button>
                                       </div>
                                    </div>
                                 ) : (
                                    <div className="text-sm text-buildops-text whitespace-pre-wrap break-words">
                                       {(!expandedTextState[comment.id] && !isActualSolution && comment.body.length > 300) ? (
                                         <>
                                            {renderTextWithMentions(comment.body.substring(0, 300) + '...', settings.markdownRendering)}
                                            <button onClick={(e) => toggleExpandedText(comment.id, e)} className="ml-2 text-buildops-blue text-xs font-medium hover:underline">
                                                Read more
                                            </button>
                                         </>
                                       ) : (
                                         <>
                                            {renderTextWithMentions(comment.body, settings.markdownRendering)}
                                            {(expandedTextState[comment.id] && !isActualSolution && comment.body.length > 300) && (
                                                <button onClick={(e) => toggleExpandedText(comment.id, e)} className="ml-2 text-buildops-text-secondary text-xs font-medium hover:underline mt-1 block">
                                                    Show less
                                                </button>
                                            )}
                                         </>
                                       )}
                                    </div>
                                 )}
                                 <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-2">
                                    <div className="flex items-center gap-1">
                                       <button 
                                         onClick={() => handleVoteComment(comment.id, 1)}
                                         className={`p-1 rounded-full hover:bg-buildops-card transition-colors ${userCommentVotes[comment.id] === 1 ? 'text-buildops-blue' : 'text-buildops-text-secondary hover:text-buildops-text'}`} 
                                         title="Upvote"
                                       >
                                          <ThumbsUp className={`w-3.5 h-3.5 ${userCommentVotes[comment.id] === 1 ? 'fill-current' : ''}`} />
                                       </button>
                                       <span className="text-xs font-medium text-buildops-text-secondary">{formatCount(comment.score || 0)}</span>
                                       <button 
                                         onClick={() => handleVoteComment(comment.id, -1)}
                                         className={`p-1 rounded-full hover:bg-buildops-card transition-colors ${userCommentVotes[comment.id] === -1 ? 'text-buildops-orange' : 'text-buildops-text-secondary hover:text-buildops-text'}`} 
                                         title="Downvote"
                                       >
                                          <ThumbsUp className={`w-3.5 h-3.5 rotate-180 ${userCommentVotes[comment.id] === -1 ? 'fill-current' : ''}`} />
                                       </button>
                                    </div>
                                    <button onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)} className="text-xs font-semibold text-buildops-text-secondary hover:text-buildops-text transition-colors">
                                       Reply
                                    </button>
                                    {comment.authorId === user?.uid && (() => {
                                       const notif = sentNotifications.find(n => n.commentId === comment.id);
                                       if (notif) {
                                          return notif.read ? (
                                             <span className="text-[11px] font-medium text-buildops-green bg-buildops-green/10 border border-buildops-green/20 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Seen
                                             </span>
                                          ) : (
                                             <span className="text-[11px] font-medium text-buildops-text-secondary bg-white/5 border border-white/10 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                                <Eye className="w-3.5 h-3.5" /> Unseen
                                             </span>
                                          );
                                       }
                                       return null;
                                    })()}
                                    {post.authorId === user?.uid && post.status && post.status !== 'none' && comment.authorId !== user?.uid && (
                                      <button 
                                        onClick={async () => {
                                           try {
                                              const batch = writeBatch(db);
                                              const isNowSolution = !comment.isSolution;
                                              const newStatus = isNowSolution ? "solved" : "open";
                                              
                                              batch.update(doc(db, "posts", post.id), { status: newStatus, updatedAt: serverTimestamp() });
                                              
                                              if (isNowSolution) {
                                                  const existingSolutions = comments.filter(c => c.isSolution && c.id !== comment.id);
                                                  existingSolutions.forEach(existing => {
                                                      batch.update(doc(db, "comments", existing.id), { isSolution: false, updatedAt: serverTimestamp() });
                                                      if (existing.authorId) {
                                                          batch.set(doc(db, "users", existing.authorId), {
                                                              stats: {
                                                                  problemsSolved: increment(-1),
                                                                  proofScore: increment(-10)
                                                              }
                                                          }, { merge: true });
                                                      }
                                                  });
                                              }
                                              
                                              batch.update(doc(db, "comments", comment.id), { isSolution: isNowSolution, updatedAt: serverTimestamp() });
                                              
                                              if (comment.authorId) {
                                                 batch.set(doc(db, "users", comment.authorId), { 
                                                    stats: {
                                                       problemsSolved: increment(isNowSolution ? 1 : -1),
                                                       proofScore: increment(isNowSolution ? 10 : -10)
                                                    },
                                                    updatedAt: serverTimestamp() 
                                                 }, { merge: true });
                                              }
                                              await batch.commit();
                                              toast.success(isNowSolution ? "Marked as solution!" : "Solution marking removed.");
                                           } catch(e) {
                                              console.error(e);
                                              toast.error("Failed to update solution status");
                                              handleFirestoreError(e, OperationType.UPDATE, `posts/${post.id}`);
                                           }
                                        }}
                                        className={`text-xs font-semibold hover:opacity-80 transition-colors flex items-center gap-1 shrink-0 ${comment.isSolution ? 'text-yellow-500' : 'text-buildops-text-secondary hover:text-buildops-green'}`}
                                      >
                                         {comment.isSolution ? <Undo2 className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />} {comment.isSolution ? 'Undo Solution' : 'Mark Solution'}
                                      </button>
                                    )}
                                    
                                 </div>
                                 
                                 {/* Reply Box */}
                                 {replyingTo === comment.id && (
                                    <div className="mt-4 flex gap-2 sm:gap-3">
                                       <div className="w-8 h-8 rounded-full bg-buildops-card flex items-center justify-center border border-buildops-border overflow-hidden shrink-0 mt-0.5">
                                          {(() => {
                                            const avatar = userProfile ? userProfile.photoURL : (user ? user.photoURL : null);
                                            return avatar ? (
                                              <img src={avatar} alt="User" className="w-full h-full object-cover" />
                                            ) : (
                                              <User className="w-4 h-4 text-buildops-text-secondary" />
                                            );
                                          })()}
                                       </div>
                                       <div className="flex-1 flex flex-col min-w-0">
                                          <textarea
                                             autoFocus
                                             onFocus={(e) => {
                                               const target = e.target;
                                               setTimeout(() => {
                                                 target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                               }, 300);
                                             }}
                                             value={replyBody}
                                             onChange={(e) => {
                                               setReplyBody(e.target.value);
                                               e.target.style.height = "auto";
                                               e.target.style.height = e.target.scrollHeight + "px";
                                             }}
                                             placeholder={`Reply to @${author?.handle || author?.displayName}...`}
                                             className="w-full bg-transparent border-b border-buildops-border focus:border-buildops-text text-sm pb-1 text-buildops-text focus:outline-none resize-none transition-colors min-h-[30px] overflow-hidden"
                                             rows={1}
                                          />
                                          <div className="flex flex-wrap justify-end gap-2 pr-1 pt-3">
                                             <button 
                                               onClick={() => { setReplyingTo(null); setReplyBody(""); }}
                                               className="px-3 sm:px-4 py-1 sm:py-1.5 text-xs font-medium text-buildops-text hover:bg-buildops-card rounded-full transition-colors"
                                             >
                                               Cancel
                                             </button>
                                             <button
                                               onClick={() => handleSubmitReply(comment.id)}
                                               disabled={isSubmittingReply || !replyBody.trim()}
                                               className="px-3 sm:px-4 py-1 sm:py-1.5 text-xs font-medium bg-buildops-blue text-white rounded-full transition-colors disabled:opacity-50 disabled:bg-buildops-border disabled:text-buildops-text-secondary"
                                             >
                                               {isSubmittingReply ? 'Replying...' : 'Reply'}
                                             </button>
                                          </div>
                                       </div>
                                    </div>
                                 )}
                              </div>
                           </div>
                           {/* Replies Container */}
                           {(!hideReplies && replies.length > 0) && (() => {
                               const solutionCount = replies.filter(r => isCommentInSolutionPath(r.id)).length;
                               const currentVisible = expandedRepliesState[comment.id] !== undefined ? expandedRepliesState[comment.id] : solutionCount;
                               const visibleReplies = replies.slice(0, currentVisible);
                               const hasMore = currentVisible < replies.length;
                               const isExpanded = expandedRepliesState[comment.id] !== undefined;
                               
                               return (
                                   <div className={depth < 4 ? "mt-2 ml-4 sm:ml-5 pl-4 sm:pl-5 border-l-2 border-buildops-border/30" : "mt-2 pl-4 sm:pl-5 border-l-2 border-buildops-border/30"}>
                                       {visibleReplies.map(r => renderComment(r, depth + 1))}
                                       {hasMore && (
                                           <div className="mt-3 text-xs font-semibold text-buildops-blue">
                                               <button onClick={(e) => { e.stopPropagation(); setViewingRepliesFor(comment.id); }} className="hover:underline flex items-center gap-1.5 py-1 px-3 rounded-full bg-buildops-blue/10 transition-colors hover:bg-buildops-blue/20">
                                                   <MessagesSquare className="w-3.5 h-3.5"/> 
                                                   {!isExpanded && currentVisible === 0 ? `View ${replies.length} repl${replies.length === 1 ? 'y' : 'ies'}` : `View more replies`}
                                               </button>
                                           </div>
                                       )}
                                   </div>
                               );
                           })()}
                        </div>
                      );
                   };

                const rootComments = comments.filter(c => !c.parentId).sort((a, b) => {
                      const aIsSolution = isCommentInSolutionPath(a.id);
                      const bIsSolution = isCommentInSolutionPath(b.id);
                      if (aIsSolution && !bIsSolution) return -1;
                      if (!aIsSolution && bIsSolution) return 1;
                      
                      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                      
                      if (commentSortBy === 'newest') {
                          return bTime - aTime;
                      }
                      
                      // top comments
                      if ((b.score || 0) !== (a.score || 0)) {
                         return (b.score || 0) - (a.score || 0);
                      }
                      return bTime - aTime;
                });
                const visibleRootComments = rootComments.slice(0, visibleTopCommentsCount);
                
                return (
                   <>
                       {visibleRootComments.map(c => renderComment(c))}
                       {visibleRootComments.length < rootComments.length && visibleRootComments.length >= visibleTopCommentsCount && (
                           <div className="flex justify-center mt-6">
                               <button onClick={() => setVisibleTopCommentsCount(prev => prev + 5)} className="px-6 py-2 rounded-lg bg-buildops-card border border-buildops-border text-buildops-text font-medium text-sm hover:bg-white/5 transition-colors">
                                   Load more comments
                               </button>
                           </div>
                       )}

                       {/* FULL SCREEN REPLIES VIEW */}
                       {viewingRepliesFor && (() => {
                           const parentComment = comments.find(c => c.id === viewingRepliesFor);
                           
                           // YouTube-style: get all nested descendants flat
                           const getAllDescendants = (parentId: string): any[] => {
                               let result: any[] = [];
                               const children = childrenMap.get(parentId) || [];
                               for (const child of children) {
                                   result.push(child);
                                   result = result.concat(getAllDescendants(child.id));
                               }
                               return result;
                           };
                           
                           const threadReplies = getAllDescendants(viewingRepliesFor);
                           const sortedThreadReplies = [...threadReplies].sort((a, b) => {
                               const aIsSolution = isCommentInSolutionPath(a.id);
                               const bIsSolution = isCommentInSolutionPath(b.id);
                               if (aIsSolution && !bIsSolution) return -1;
                               if (!aIsSolution && bIsSolution) return 1;
                               const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                               const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                               return aTime - bTime; // chronological
                           });

                           return (
                               <div className="fixed inset-0 z-[100] bg-buildops-bg overflow-y-auto flex flex-col">
                                   <div className="sticky top-0 z-10 bg-buildops-bg/80 backdrop-blur-xl border-b border-buildops-border">
                                       <div className="max-w-4xl mx-auto w-full px-4 h-14 flex items-center gap-3">
                                           <button onClick={() => {
                                               if (parentComment && parentComment.parentId) {
                                                   // if replying from a sub-reply, go up one level? No, let's just go all the way back to main view
                                                   setViewingRepliesFor(null);
                                               } else {
                                                   setViewingRepliesFor(null);
                                               }
                                           }} className="p-2 -ml-2 rounded-full hover:bg-buildops-card transition-colors">
                                               <ArrowLeft className="w-5 h-5 text-buildops-text" />
                                           </button>
                                           <h2 className="font-bold text-lg">Replies</h2>
                                       </div>
                                   </div>
                                   
                                   <div className="max-w-4xl mx-auto w-full px-4 py-6 flex-1 pb-32">
                                       {/* Render the parent comment */}
                                       {parentComment && (
                                           <div className="mb-6">
                                               {renderComment(parentComment, 0, true)}
                                           </div>
                                       )}
                                       
                                       <div className="space-y-4 ml-[15px] pl-4 sm:pl-6 border-l-2 border-buildops-border/30">
                                           {sortedThreadReplies.map(r => renderComment(r, 0, true))}
                                       </div>
                                   </div>
                               </div>
                           );
                       })()}
                   </>
                );
            })()}
          </div>
        </section>
        </div>

      </div>

      {/* Right Sidebar */}
      <aside className="hidden lg:block w-72 shrink-0 space-y-6 pt-2 lg:pt-[80px]">
        {user && user.uid !== post.authorId && (
          <button
            onClick={async () => {
              if (!user) return;
              const saveRef = doc(db, "saves", `${user.uid}_${id}`);
              try {
                 const snap = await getDoc(saveRef);
                 if (snap.exists()) {
                    await import("firebase/firestore").then(m => m.deleteDoc(saveRef));
                    toast.success("Removed from saved posts.");
                 } else {
                    await setDoc(saveRef, { userId: user.uid, postId: id, createdAt: serverTimestamp() });
                    toast.success("Post saved to dashboard!");
                 }
              } catch (err) {}
            }}
            className="w-full flex items-center justify-center gap-2 bg-buildops-card border border-buildops-border text-buildops-text font-bold py-3.5 px-4 rounded-lg hover:border-buildops-text-secondary transition-colors"
          >
            <Zap className="w-4 h-4" />
            Save Post
          </button>
        )}
        
        {user?.uid === post.authorId && (
          <Link
            to={`/boost/${id}`}
            className="w-full flex items-center justify-center gap-2 border border-buildops-orange text-buildops-orange font-bold py-3.5 px-4 rounded-lg hover:bg-buildops-orange/10 transition-colors shadow-[0_0_15px_rgba(249,115,22,0.1)]"
          >
            <Zap className="w-4 h-4" />
            Boost this Post
          </Link>
        )}
        
        <div className="rounded-lg border border-buildops-border bg-buildops-card p-5 space-y-4">
          <div>
              <h3 className="text-sm font-bold text-buildops-text mb-3">Post Info</h3>
              <div className="space-y-2 text-sm text-buildops-text-secondary">
                  {post.category && (
                     <div className="flex justify-between"><span>Category</span><span className="font-mono text-buildops-text lowercase">{post.category}</span></div>
                  )}
                  {post.status && post.status !== "none" && post.status !== "open" && post.type !== "thought" && (
                     <div className="flex justify-between"><span>Status</span><span className="font-mono text-buildops-text lowercase">{post.status}</span></div>
                  )}
              </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-buildops-text mb-3">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {post.tags?.length > 0 ? (
                post.tags.map((tag: string, i: number) => (
                  <span 
                     key={`${tag}-${i}`} 
                     onClick={() => navigate(`/search?q=${encodeURIComponent(tag)}`)}
                     className="px-2.5 py-1 bg-buildops-bg border border-buildops-border rounded text-xs text-buildops-text-secondary font-mono hover:text-buildops-blue hover:border-buildops-blue/50 transition-colors cursor-pointer"
                  >
                    {tag}
                  </span>
                ))
              ) : (
                  <span className="text-xs text-buildops-text-secondary">No tags specified</span>
              )}
            </div>
          </div>
        </div>
      </aside>

      {longPressedCommentId && (() => {
        const commentToDelete = comments.find(c => c.id === longPressedCommentId);
        const isAdminUser = userProfile?.role === 'admin';
        const isCommentAuthor = commentToDelete && user?.uid === commentToDelete.authorId;
        const isAuthorized = commentToDelete && (isCommentAuthor || isAdminUser);
        if (!isAuthorized) return null;

        return (
          <div 
            className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => setLongPressedCommentId(null)}
          >
            <div 
              className="bg-buildops-card border border-buildops-border rounded-xl w-full max-w-sm p-6 relative animate-in zoom-in-95 duration-150 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-buildops-text mb-1">Delete comment?</h3>
              <p className="text-sm text-buildops-text-secondary mb-6">
                This action is permanent and cannot be undone.
              </p>
              
              <div className="flex gap-3 justify-end">
                <button 
                  onClick={() => setLongPressedCommentId(null)}
                  className="px-4 py-2 text-sm font-medium text-buildops-text-secondary hover:text-white transition-colors cursor-pointer border-0 bg-transparent"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    const idToDelete = longPressedCommentId;
                    setLongPressedCommentId(null);
                    handleDeleteComment(idToDelete);
                  }}
                  className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors cursor-pointer border-0"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {reportingCommentId && (
        <div 
          className="fixed inset-0 z-[202] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setReportingCommentId(null)}
        >
          <div 
            className="bg-buildops-card border border-buildops-border rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150 shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-buildops-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="text-lg font-bold text-buildops-text">Report Comment</h3>
              </div>
              <button 
                onClick={() => setReportingCommentId(null)}
                className="text-buildops-text-secondary hover:text-white border-0 bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-buildops-text-secondary mb-4">
                Why are you reporting this comment? Your report is anonymous.
              </p>
              
              <div className="space-y-1 max-h-[30vh] overflow-y-auto no-scrollbar">
                {[
                  "It's spam",
                  "Harassment or bullying",
                  "Hate speech or symbols",
                  "Nudity or sexual activity",
                  "Violence or physical harm",
                  "Intellectual property violation",
                  "I just don't like it"
                ].map((reason) => (
                  <button
                    key={reason}
                    onClick={() => {
                      const commId = reportingCommentId;
                      setReportingCommentId(null);
                      handleReportCommentSubmit(commId, reason);
                    }}
                    className="w-full text-left py-3 px-3 rounded-lg hover:bg-white/5 transition-colors flex items-center justify-between group border-0 bg-transparent cursor-pointer"
                  >
                    <span className="text-sm text-buildops-text font-medium">{reason}</span>
                    <ChevronRight className="w-4 h-4 text-buildops-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showReportPostModal && (
        <div 
          className="fixed inset-0 z-[202] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowReportPostModal(false)}
        >
          <div 
            className="bg-buildops-card border border-buildops-border rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150 shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-buildops-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="text-lg font-bold text-buildops-text">Report Post</h3>
              </div>
              <button 
                onClick={() => setShowReportPostModal(false)}
                className="text-buildops-text-secondary hover:text-white border-0 bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-buildops-text-secondary mb-4">
                Why are you reporting this post? Your report is anonymous.
              </p>
              
              <div className="space-y-1 max-h-[30vh] overflow-y-auto no-scrollbar">
                {[
                  "It's spam or off-topic",
                  "Intellectual property violation",
                  "Hate speech or symbols",
                  "Harassment or bullying",
                  "Incorrect or misleading technical info",
                  "Violence or safety concerns",
                  "I just don't like it"
                ].map((reasonCategory) => (
                  <button
                    key={reasonCategory}
                    onClick={() => {
                      setShowReportPostModal(false);
                      handleReportPostSubmit(reasonCategory);
                    }}
                    className="w-full text-left py-3 px-3 rounded-lg hover:bg-white/5 transition-colors flex items-center justify-between group border-0 bg-transparent cursor-pointer"
                  >
                    <span className="text-sm text-buildops-text font-medium">{reasonCategory}</span>
                    <ChevronRight className="w-4 h-4 text-buildops-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmNavigationDialog
        isOpen={blocker.state === 'blocked'}
        title="Discard changes?"
        description="You have unsaved edits."
        primaryActionText="Save Changes"
        secondaryActionText="Discard"
        onPrimaryAction={async () => {
           await handleSaveEdit();
           blocker.proceed?.();
        }}
        onSecondaryAction={() => {
           setEditTitle(post?.title || "");
           setEditBody(post?.body || "");
           setIsEditing(false);
           blocker.proceed?.();
        }}
        onDismiss={() => blocker.reset?.()}
      />
    </div>
  );
}
