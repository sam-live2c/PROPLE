import React, { useEffect, useState, useRef } from "react";
import { ThumbsUp, Play, MessageSquare, BarChart2, Share, CheckCircle2, MoreVertical, AlertTriangle, Info, Edit2, Trash2, Bookmark, User, Upload, RotateCcw, Github, Globe } from "lucide-react";
import { toast } from 'sonner';
import { cn, formatCount, formatPostTime } from "@/src/lib/utils";
import { doc, getDoc, updateDoc, writeBatch, increment, collection, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/contexts/AuthContext";
import { handleFirestoreError, OperationType } from "@/src/lib/firestore-errors";
import { format } from "date-fns";
import { useNavigate, Link } from "react-router-dom";
import { UserActionModals } from "@/src/components/UserActionModals";

interface ProblemCardProps {
  post: any;
  showTrashActions?: boolean;
  onRestore?: () => void;
  onDeletePermanently?: () => void;
}

import { motion, AnimatePresence } from "motion/react";
import { generateSearchData } from "@/src/lib/search";
import { renderTextWithMentions } from "@/src/lib/renderUtils";
import { FollowButton } from "./FollowButton";
import { useSettings } from "@/src/contexts/SettingsContext";

export function ProblemCard({ post: initialPost, showTrashActions = false, onRestore, onDeletePermanently }: ProblemCardProps) {
  const { settings } = useSettings();
  const [post, setPost] = useState(initialPost);
  const [author, setAuthor] = useState<any>(null);
  const [likes, setLikes] = useState(post.stats?.likesCount || 0);
  const [hasLiked, setHasLiked] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [shares, setShares] = useState(post.stats?.sharesCount || 0);
  const [views, setViews] = useState(post.stats?.viewsCount || 0);
  const [modalOpen, setModalOpen] = useState<'none' | 'about' | 'report'>('none');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: string; onConfirm: () => void } | null>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [isLiking, setIsLiking] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.ceil(textareaRef.current.scrollHeight * 1.1)}px`;
    }
  }, [isEditing, editBody]);

  const { user } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    setPost(initialPost);
  }, [initialPost]);

  useEffect(() => {
    setLikes(post.stats?.likesCount || 0);
    setShares(post.stats?.sharesCount || 0);
    setViews(post.stats?.viewsCount || 0);
  }, [post.stats?.likesCount, post.stats?.sharesCount, post.stats?.viewsCount]);

  useEffect(() => {
    if (user && post.id) {
       getDoc(doc(db, "likes", `${post.id}_${user.uid}`)).then(snap => {
          setHasLiked(snap.exists());
       }).catch(() => {
          setHasLiked(false);
       });
       
       getDoc(doc(db, "saves", `${post.id}_${user.uid}`)).then(snap => {
          setHasSaved(snap.exists());
       }).catch(() => {
          setHasSaved(false);
       });
    } else {
       setHasLiked(false);
       setHasSaved(false);
    }
  }, [user, post.id]);

  useEffect(() => {
    if (post.authorId) {
      getDoc(doc(db, "users", post.authorId)).then(snap => {
        if (snap.exists()) {
          setAuthor(snap.data());
        }
      });
    }
  }, [post.authorId]);

  const handleEditSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editTitle.trim()) return;

    if (editTitle.trim() === post.title.trim() && editBody.trim() === (post.body || "").trim()) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
         const searchData = generateSearchData({
            title: editTitle.trim(),
            body: editBody.trim(),
            category: post.category,
            tags: post.tags,
            authorName: author?.displayName || "",
            authorHandle: author?.handle || ""
         });

         await updateDoc(doc(db, "posts", post.id), {
           title: editTitle.trim(),
           body: editBody.trim(),
           search: searchData,
           isEdited: true,
           updatedAt: serverTimestamp()
         });
      setPost({ ...post, title: editTitle.trim(), body: editBody.trim(), isEdited: true, updatedAt: new Date() });
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsMenuOpen(false);
    setEditTitle(post.title);
    setEditBody(post.body || "");
    setIsEditing(true);
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || user.isAnonymous) {
        toast.error("Guest users cannot like posts.");
        return;
    }
    
    if (isLiking) return;
    setIsLiking(true);

    // Optimistic Update
    const newHasLiked = !hasLiked;
    setHasLiked(newHasLiked);
    setLikes(prev => newHasLiked ? prev + 1 : Math.max(0, prev - 1));

    const likeId = `${post.id}_${user.uid}`;
    try {
      const likeRef = doc(db, "likes", likeId);
      const postRef = doc(db, "posts", post.id);
      
      const likeSnap = await getDoc(likeRef);
      const postSnap = await getDoc(postRef);
      
      if (!postSnap.exists()) {
          setIsLiking(false);
          return;
      }
      
      const batch = writeBatch(db);
      const postAuthorRef = post.authorId ? doc(db, "users", post.authorId) : null;
      
      if (likeSnap.exists()) {
         batch.delete(likeRef);
         batch.update(postRef, {
            "stats.likesCount": increment(-1),
            updatedAt: serverTimestamp()
         });
         if (postAuthorRef && post.authorId !== user.uid) {
             batch.set(postAuthorRef, {
                 stats: { proofScore: increment(-1) },
                 updatedAt: serverTimestamp()
             }, { merge: true });
         }
      } else {
         batch.set(likeRef, {
            postId: post.id,
            userId: user.uid,
            createdAt: serverTimestamp()
         });
         batch.update(postRef, {
            "stats.likesCount": increment(1),
            updatedAt: serverTimestamp()
         });
         
         if (postAuthorRef && post.authorId !== user.uid) {
            batch.set(postAuthorRef, {
                stats: { proofScore: increment(1) },
                updatedAt: serverTimestamp()
            }, { merge: true });

            const notifRef = doc(collection(db, "notifications"));
            batch.set(notifRef, {
               userId: post.authorId,
               fromUserId: user.uid,
               postId: post.id,
               type: 'like',
               read: false,
               createdAt: serverTimestamp()
            });
         }
      }
      await batch.commit();
    } catch (err) {
      console.error(err);
      // Revert optimistic update on failure
      setHasLiked(!newHasLiked);
      setLikes(prev => !newHasLiked ? prev + 1 : Math.max(0, prev - 1));
    } finally {
      setIsLiking(false);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/problems/${post.id}`;
    
    try {
      if (navigator.share) {
         await navigator.share({
            title: post.title,
            url: url
         });
      } else {
         await navigator.clipboard.writeText(url);
         toast.success("Link copied to clipboard!");
      }

      // Successful share
      setShares(prev => prev + 1);
      
      if (user && post.id) {
          const postRef = doc(db, "posts", post.id);
          const shareRef = doc(db, "shares", `${post.id}_${user.uid}`);
          getDoc(postRef).then(snap => {
              if (snap.exists()) {
                  updateDoc(postRef, {
                      "stats.sharesCount": increment(1)
                  });
                  setDoc(shareRef, {
                      postId: post.id,
                      userId: user.uid,
                      createdAt: serverTimestamp()
                  }, { merge: true }).catch(() => {});
              }
          }).catch(() => {});
      }
    } catch(err: any) {
      if (err.name !== 'AbortError' && !err.message?.includes('canceled')) {
         console.error(err);
      }
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Please sign in to save posts.");
      return;
    }

    const newHasSaved = !hasSaved;
    setHasSaved(newHasSaved);

    // Trigger instant successful feedback toast
    const toastId = toast.success(newHasSaved ? "Post saved!" : "Post unsaved!");

    try {
        const saveRef = doc(db, "saves", `${post.id}_${user.uid}`);
        const postRef = doc(db, "posts", post.id);

        const postSnap = await getDoc(postRef);
        if (!postSnap.exists()) {
            toast.dismiss(toastId);
            toast.error("This post no longer exists.");
            setHasSaved(!newHasSaved);
            return;
        }
        
        if (newHasSaved) {
            await setDoc(saveRef, { postId: post.id, userId: user.uid, createdAt: serverTimestamp() });
            await updateDoc(postRef, { "stats.savesCount": increment(1) });
        } else {
            await deleteDoc(saveRef);
            await updateDoc(postRef, { "stats.savesCount": increment(-1) });
        }
    } catch (e) {
        console.error("Save failure", e);
        toast.dismiss(toastId);
        toast.error(newHasSaved ? "Failed to save post." : "Failed to unsave post.");
        setHasSaved(!newHasSaved); // revert
    }
  };

  const handleCardClick = async () => {
    if (showTrashActions) {
      return;
    }
    navigate(`/problems/${post.id}`);
  };

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
  if (post.isEdited) {
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
    <>
      {confirmAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setConfirmAction(null); }}>
          <div className="w-full max-w-sm bg-buildops-card border border-buildops-border rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-buildops-text mb-2">Confirm Action</h3>
            <p className="text-sm text-buildops-text-secondary mb-6">Are you sure you want to {confirmAction.type} this post?</p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-sm font-medium text-buildops-text-secondary hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  confirmAction.onConfirm();
                  setConfirmAction(null);
                }}
                className="px-4 py-2 rounded-lg bg-[#f91880] text-white text-sm font-medium hover:bg-[#f91880]/90 transition-colors"
              >
                Yes, {confirmAction.type}
              </button>
            </div>
          </div>
        </div>
      )}
      <UserActionModals 
        user={author}
        isOpen={modalOpen}
        onClose={() => setModalOpen('none')}
      />
      <div className="flex flex-col sm:flex-row gap-3 py-4 px-3 sm:px-4 md:px-5 lg:px-6 border-b border-buildops-border hover:bg-buildops-card/50 transition-colors cursor-pointer" onClick={handleCardClick}>
        {/* Avatar */}
      <div 
        className="w-10 h-10 rounded-full bg-buildops-border overflow-hidden shrink-0 hidden sm:flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          if (post.authorId) navigate(`/profile/${post.authorId}`);
        }}
      >
        {author?.photoURL ? (
          <img src={author.photoURL} alt={author.displayName || 'User'} className="w-full h-full object-cover" />
        ) : (
           <User className="w-5 h-5 text-buildops-text-secondary" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        {/* Header Information */}
        <div className="flex items-start justify-between mb-1 text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <div 
              className="w-8 h-8 rounded-full bg-buildops-border overflow-hidden flex items-center justify-center shrink-0 sm:hidden cursor-pointer hover:opacity-80 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                if (post.authorId) navigate(`/profile/${post.authorId}`);
              }}
            >
              {author?.photoURL ? (
                <img src={author.photoURL} alt={author.displayName || 'User'} className="w-full h-full object-cover" />
              ) : (
                <User className="w-4 h-4 text-buildops-text-secondary" />
              )}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span 
                  className="font-bold text-buildops-text lg:truncate md:truncate sm:truncate break-words cursor-pointer hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (post.authorId) navigate(`/profile/${post.authorId}`);
                  }}
                >
                  {author?.displayName || 'Unknown'}
                </span>
                {author?.role === 'verified' && <CheckCircle2 className="w-3.5 h-3.5 text-buildops-blue shrink-0" />}
                {post.authorId && user?.uid !== post.authorId && (
                  <div className="ml-2">
                    <FollowButton targetId={post.authorId} variant="text" />
                  </div>
                )}
              </div>
              <Link 
                to={post.authorId ? `/profile/${post.authorId}` : '#'}
                onClick={(e) => e.stopPropagation()}
                className="text-buildops-text-secondary font-normal text-xs hover:underline truncate max-w-[150px]"
              >
                @{author?.handle || 'user'}
              </Link>
            </div>
          </div>
          
          <div className="relative flex items-center">
            <button 
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setIsMenuOpen(!isMenuOpen); }}
              className="p-2 text-buildops-text-secondary hover:text-white hover:bg-white/10 rounded-full transition-colors flex items-center justify-center cursor-pointer"
              title="Options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {isMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-[55]" 
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); setIsMenuOpen(false); }} 
                />
                <div className="absolute right-0 top-full mt-2 w-44 bg-buildops-card border border-buildops-border rounded-xl shadow-xl z-[60] py-1.5 text-left font-sans animate-fade-in">
                   {user?.uid === post.authorId ? (
                     <>
                       {!isEditing && (
                         <button 
                           onClick={startEditing} 
                           className="w-full text-left px-4 py-2.5 text-sm text-buildops-text hover:bg-white/5 transition-colors flex items-center gap-2.5 cursor-pointer border-0 bg-transparent font-medium"
                         >
                           <Edit2 className="w-4 h-4 text-buildops-text-secondary" />
                           Edit Post
                         </button>
                       )}
                       <button onClick={async (e) => { 
                          e.stopPropagation(); e.preventDefault(); 
                          setIsMenuOpen(false);
                          setConfirmAction({
                             type: 'delete',
                             onConfirm: async () => {
                               try {
                                   const postData = { ...post };
                                   delete postData.id;
                                   const batch = writeBatch(db);
                                   batch.delete(doc(db, "posts", post.id));
                                   const { getDocs, query, where } = await import("firebase/firestore");
                                   const commentsRef = collection(db, "comments");
                                   const q = query(commentsRef, where("postId", "==", post.id));
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
                                             restoreBatch.set(doc(db, "posts", post.id), postData);
                                             deletedComments.forEach((c) => {
                                                const cData = { ...c };
                                                const cId = cData.id;
                                                delete cData.id;
                                                restoreBatch.set(doc(db, "comments", cId), cData);
                                             });
                                             await restoreBatch.commit();
                                             toast.success('Post restored successfully');
                                          } catch (restoreErr) {
                                             console.error(restoreErr);
                                             toast.error('Failed to restore post');
                                          }
                                        }
                                      }
                                    });
                               } catch (err) {
                                  console.error(err);
                                  toast.error("Failed to delete post");
                                }
                             }
                          });
                       }} className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-2.5 cursor-pointer border-0 bg-transparent font-medium"
                       >
                          <Trash2 className="w-4 h-4 text-red-500" />
                          Delete Post
                       </button>
                       <button onClick={async (e) => { 
                          e.stopPropagation(); e.preventDefault();
                          setIsMenuOpen(false);
                          setConfirmAction({
                             type: 'trash',
                             onConfirm: async () => {
                               try {
                                   const originalStatus = post.status || "open";
                                   await setDoc(doc(db, "posts", post.id), { status: "trashed", updatedAt: serverTimestamp() }, { merge: true });
                                   toast('Post moved to trash', {
                                      action: {
                                        label: 'Undo',
                                        onClick: async () => {
                                           try {
                                              await setDoc(doc(db, "posts", post.id), { status: originalStatus, updatedAt: serverTimestamp() }, { merge: true });
                                              toast.success('Post restored');
                                           } catch (error) {
                                              console.error(error);
                                              toast.error('Failed to restore post');
                                           }
                                        }
                                      }
                                    });
                               } catch (err) {
                                  console.error(err);
                                  toast.error("Failed to send post to trash");
                               }
                             }
                          });
                       }} className="w-full text-left px-4 py-2.5 text-sm text-buildops-text hover:bg-white/5 transition-colors flex items-center gap-2.5 cursor-pointer border-0 bg-transparent font-medium"
                       >
                          <Trash2 className="w-4 h-4 text-buildops-text-secondary" />
                          Send to Trash
                       </button>
                     </>
                   ) : (
                     <>
                       <button 
                         onClick={(e) => { e.stopPropagation(); e.preventDefault(); setIsMenuOpen(false); setModalOpen('report'); }} 
                         className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-2.5 cursor-pointer border-0 bg-transparent font-medium"
                       >
                         <AlertTriangle className="w-4 h-4 text-red-500" />
                         Report Post
                       </button>
                       <button 
                         onClick={(e) => { e.stopPropagation(); e.preventDefault(); setIsMenuOpen(false); setModalOpen('about'); }} 
                         className="w-full text-left px-4 py-2.5 text-sm text-buildops-text hover:bg-white/5 transition-colors flex items-center gap-2.5 cursor-pointer border-0 bg-transparent font-medium"
                       >
                         <Info className="w-4 h-4 text-buildops-text-secondary" />
                         About Post
                       </button>
                     </>
                   )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        {post.type === "build" && (
            <div className="mb-2 text-xs font-mono font-medium text-buildops-blue uppercase">
                # build_showcase
            </div>
        )}
        
        {isEditing ? (
            <div className="space-y-3 mb-3 shrink-0 w-full" onClick={(e) => e.stopPropagation()}>
               <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-buildops-bg border border-buildops-border rounded-lg px-3 py-2 text-sm text-buildops-text focus:outline-none focus:border-buildops-blue"
                  placeholder="Post title"
               />
               <textarea
                  ref={textareaRef}
                  value={editBody}
                  onChange={(e) => {
                    setEditBody(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.ceil(e.target.scrollHeight * 1.1)}px`;
                  }}
                  className="w-full bg-buildops-bg border border-buildops-border rounded-lg px-3 py-2 text-sm text-buildops-text focus:outline-none focus:border-buildops-blue resize-none min-h-[88px]"
                  placeholder="Post details"
               />
               <div className="flex justify-end gap-2">
                 <button 
                   onClick={(e) => { e.stopPropagation(); setIsEditing(false); }} 
                   className="text-xs font-medium px-3 py-1.5 rounded-lg bg-buildops-card border border-buildops-border text-buildops-text-secondary hover:text-white transition-colors"
                 >
                   Cancel
                 </button>
                 <button 
                   onClick={handleEditSave}
                   disabled={isSaving}
                   className="text-xs font-medium px-3 py-1.5 rounded-lg bg-buildops-blue text-white hover:bg-buildops-blue/90 disabled:opacity-50 transition-colors cursor-pointer disabled:cursor-not-allowed"
                 >
                   {isSaving ? 'Saving...' : 'Save'}
                 </button>
               </div>
            </div>
        ) : (
            <>
               <h3 className="text-base font-bold text-buildops-text mb-1 leading-snug">
                 {renderTextWithMentions(post.title, false)}
               </h3>
               <div className={`text-buildops-text/95 ${settings.feedDensity === 'compact' ? 'text-sm mb-2' : 'text-[15px] mb-3'} leading-snug font-sans`}>
                  <div className={settings.feedDensity === 'expanded' ? '' : settings.feedDensity === 'compact' ? 'line-clamp-2' : 'line-clamp-3'}>
                    {renderTextWithMentions(post.body, settings.markdownRendering)}
                  </div>
                  {post.body && post.body.length > (settings.feedDensity === 'compact' ? 100 : 200) && settings.feedDensity !== 'expanded' && (
                    <span className="text-buildops-blue text-sm hover:underline mt-1 inline-block">Read more</span>
                  )}
               </div>
            </>
        )}

        {/* Links */}
        {(post.githubUrl || post.liveUrl) && (
            <div className="flex gap-3 mb-3">
               {post.githubUrl && (
                  <a href={post.githubUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="flex text-xs items-center gap-1.5 text-buildops-text-secondary hover:text-buildops-text transition-colors border border-buildops-border rounded px-2 py-1 bg-buildops-card">
                     <Github className="w-3.5 h-3.5" />
                     Repository
                  </a>
               )}
               {post.liveUrl && (
                  <a href={post.liveUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="flex text-xs items-center gap-1.5 text-buildops-text-secondary hover:text-buildops-text transition-colors border border-buildops-border rounded px-2 py-1 bg-buildops-card">
                     <Globe className="w-3.5 h-3.5" />
                     Live Demo
                  </a>
               )}
            </div>
        )}

        {/* Labels/Tags */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {post.category && (
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-buildops-card border border-buildops-border text-buildops-text-secondary">
              {post.category}
            </span>
          )}
          {post.tags?.slice(0, 3).map((tag: string, i: number) => (
             <span 
               key={`${tag}-${i}`} 
               onClick={(e) => { e.stopPropagation(); navigate(`/search?q=${encodeURIComponent(tag)}`); }}
               className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-buildops-bg border border-buildops-border/50 text-buildops-text-secondary/70 hover:text-buildops-blue hover:border-buildops-blue/50 cursor-pointer transition-colors"
             >
               {tag}
             </span>
          ))}
          {post.status && post.status !== "none" && post.status !== "open" && post.type !== "thought" && (
            <span
              className={cn(
                "px-2 py-0.5 rounded flex items-center gap-1 text-[11px] font-mono font-medium border uppercase w-fit",
                post.status === "solved" && "bg-buildops-card border-buildops-blue/30 text-buildops-blue",
                post.status === "expired" && "bg-buildops-card border-buildops-orange/30 text-buildops-orange"
              )}
            >
              {post.status === "solved" && <CheckCircle2 className="w-3 h-3" />}
              {post.status}
            </span>
          )}
          <span className="text-buildops-text-secondary text-[12px] sm:ml-auto w-full sm:w-auto mt-1 sm:mt-0" title={dateStr}>
            {timeAgo === dateStr ? dateStr : `${timeAgo}`} {post.isEdited && <span className="ml-1 text-buildops-text-secondary">{editedTimeStr ? `(edited ${editedTimeStr})` : '(edited)'}</span>}
          </span>
        </div>

        {/* Action Buttons */}
        {showTrashActions ? (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-buildops-border/40">
            <button 
              onClick={(e) => { e.stopPropagation(); onRestore?.(); }}
              className="px-4 py-2 text-xs text-buildops-text hover:bg-buildops-border/60 border border-buildops-border rounded-none uppercase tracking-wider font-semibold transition-colors flex items-center gap-1.5 cursor-pointer font-mono"
            >
              <RotateCcw className="w-3.5 h-3.5 text-buildops-text-secondary" />
              <span>Restore Post</span>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDeletePermanently?.(); }}
              className="px-4 py-2 text-xs text-red-500 hover:bg-red-500/10 border border-red-500/20 rounded-none uppercase tracking-wider font-semibold transition-colors flex items-center gap-1.5 cursor-pointer font-mono"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
              <span>Delete Permanently</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between text-buildops-text-secondary max-w-md mt-2">
            <button className="flex items-center gap-1.5 text-[13px] hover:text-buildops-green transition-colors group">
              <motion.div whileTap={{ scale: 0.8 }} className="p-1.5 rounded-full group-hover:bg-buildops-green/10 transition-colors">
                <MessageSquare className="w-5 h-5" />
              </motion.div>
              <span>{formatCount(post.stats?.commentsCount || 0)}</span>
            </button>
            
            <button onClick={handleLike} className={cn("flex items-center gap-1.5 text-[13px] transition-colors group", hasLiked ? "text-buildops-blue" : "hover:text-buildops-blue")}>
              <motion.div 
                 whileTap={{ scale: 0.8 }}
                 animate={hasLiked ? { scale: [1, 1.2, 1] } : {}}
                 transition={{ duration: 0.3 }}
                 className={cn("p-1.5 rounded-full transition-colors", hasLiked ? "bg-buildops-blue/10" : "group-hover:bg-buildops-blue/10")}
              >
                <ThumbsUp className={cn("w-5 h-5", hasLiked ? "fill-current" : "")} />
              </motion.div>
              <span className={hasLiked ? "font-medium" : ""}>{formatCount(likes)}</span>
            </button>
   
             <button className="flex items-center gap-1.5 text-[13px] hover:text-buildops-blue transition-colors group">
              <motion.div whileTap={{ scale: 0.8 }} className="p-1.5 rounded-full group-hover:bg-buildops-blue/10 transition-colors">
                <BarChart2 className="w-5 h-5" />
              </motion.div>
              <span>{formatCount(views)}</span>
            </button>
            
            <button onClick={handleShare} className="flex items-center gap-1.5 text-[13px] hover:text-buildops-blue transition-colors group">
              <motion.div 
                 whileTap={{ scale: 0.8 }} 
                 className="p-1.5 rounded-full group-hover:bg-buildops-blue/10 transition-colors"
              >
                <Upload className="w-5 h-5" />
              </motion.div>
              <span>{formatCount(shares)}</span>
            </button>
            
            <button onClick={handleSave} className={cn("flex items-center gap-1.5 text-[13px] transition-colors group", hasSaved ? "text-buildops-blue" : "hover:text-buildops-blue")}>
              <motion.div 
                 whileTap={{ scale: 0.8 }}
                 animate={hasSaved ? { scale: [1, 1.2, 1] } : {}}
                 transition={{ duration: 0.3 }}
                 className={cn("p-1.5 rounded-full transition-colors", hasSaved ? "bg-buildops-blue/10" : "group-hover:bg-buildops-blue/10")}
              >
                <Bookmark className={cn("w-5 h-5", hasSaved ? "fill-current" : "")} />
              </motion.div>
            </button>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
