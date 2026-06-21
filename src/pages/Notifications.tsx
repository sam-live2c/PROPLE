import { Bell, Heart, MessageSquare, Award, Zap, User, X, Trash2, FileText, ArrowLeft, AtSign, Tag, Share2, Bookmark, UserPlus } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

import { collection, query, onSnapshot, where, doc, updateDoc } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { formatDistanceToNowStrict } from "date-fns";

import { NotificationSkeleton } from "@/src/components/SkeletonLoader";
import { sessionCache } from "@/src/lib/sessionCache";

const truncateText = (text: string, maxLength: number = 20) => {
   if (!text) return "";
   if (text.length <= maxLength) return text;
   return text.substring(0, maxLength).trim() + "...";
};

export function Notifications() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>(() => sessionCache.get("notifications_list", []));
  const [notificationUsers, setNotificationUsers] = useState<Record<string, any>>(() => sessionCache.get("notifications_users", {}));
  const [notificationPosts, setNotificationPosts] = useState<Record<string, any>>(() => sessionCache.get("notifications_posts", {}));
  const [loading, setLoading] = useState(() => notifications.length === 0);

  useEffect(() => {
     if (!user) return;
     const q = query(collection(db, "notifications"), where("userId", "==", user.uid));
     const unsub = onSnapshot(q, async (snap) => {
         const fetchedNotifications: any[] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
         fetchedNotifications.sort((a, b) => {
            const timeA = typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : (a.createdAt?.toMillis() || 0);
            const timeB = typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : (b.createdAt?.toMillis() || 0);
            return timeB - timeA;
         });

         // Extract unique IDs needing fetch
         const userIdsToFetch = Array.from(new Set(fetchedNotifications.map(n => n.fromUserId).filter(Boolean)));
         const postIdsToFetch = Array.from(new Set(fetchedNotifications.map(n => n.postId).filter(Boolean)));

         const usersCache: Record<string, any> = { ...notificationUsers };
         const postsCache: Record<string, any> = { ...notificationPosts };

         const missingUserIds = userIdsToFetch.filter(id => !usersCache[id]);
         const missingPostIds = postIdsToFetch.filter(id => !postsCache[id]);

         try {
             if (missingUserIds.length > 0) {
                 const { getDoc } = await import("firebase/firestore");
                 await Promise.all(missingUserIds.map(async (id) => {
                     const uDoc = await getDoc(doc(db, "users", id));
                     if (uDoc.exists()) usersCache[id] = uDoc.data();
                 }));
                 setNotificationUsers(usersCache);
             }

             if (missingPostIds.length > 0) {
                 const { getDoc } = await import("firebase/firestore");
                 await Promise.all(missingPostIds.map(async (id) => {
                     const pDoc = await getDoc(doc(db, "posts", id));
                     if (pDoc.exists()) postsCache[id] = pDoc.data();
                 }));
                 setNotificationPosts(postsCache);
             }
         } catch (err) {
              console.error("Error fetching notification details", err);
         }

         setNotifications(fetchedNotifications);
         sessionCache.set("notifications_list", fetchedNotifications);
         sessionCache.set("notifications_users", usersCache);
         sessionCache.set("notifications_posts", postsCache);
         setLoading(false);
     });
     return () => unsub();
  }, [user]);

  const [longPressedId, setLongPressedId] = useState<string | null>(null);
  const pressTimerRef = useRef<any>(null);

  const getTriggerIcon = (type: string) => {
     switch (type) {
        case 'like':
           return <Heart className="w-3 h-3 text-red-500 fill-red-500" />;
        case 'comment':
        case 'reply':
           return <MessageSquare className="w-3 h-3 text-blue-400 fill-blue-400" />;
        case 'mention':
           return <AtSign className="w-3 h-3 text-green-400" />;
        case 'tag':
        case 'tagged':
           return <Tag className="w-3 h-3 text-yellow-500 fill-yellow-500/10" />;
        case 'share':
        case 'shares':
           return <Share2 className="w-3 h-3 text-purple-400" />;
        case 'save':
        case 'saved':
           return <Bookmark className="w-3 h-3 text-pink-500 fill-pink-500" />;
        case 'follow':
           return <UserPlus className="w-3 h-3 text-teal-400" />;
        default:
           return <Bell className="w-3 h-3 text-zinc-400" />;
     }
  };

  if (authLoading) {
    return (
      <div id="notifications-page" className="flex flex-col min-h-screen pb-20 md:pb-0 w-full relative">
        <div id="notifications-header-bar" className="sticky top-0 z-40 bg-buildops-bg/95 backdrop-blur-md border-b border-[rgba(255,255,255,0.05)] px-2 h-14 flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
             <ArrowLeft className="w-6 h-6 text-buildops-text-secondary" />
             <h1 className="text-[20px] font-bold text-white tracking-tight">Notifications</h1>
          </div>
        </div>
        <div className="w-full max-w-full pt-4 pb-6 sm:pb-10 min-h-[70vh]">
          <div id="skeleton-loader-container" className="space-y-4 px-2">
            <NotificationSkeleton />
            <NotificationSkeleton />
            <NotificationSkeleton />
            <NotificationSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <div className="p-8 text-center text-buildops-text-secondary font-sans animate-fade-in">Please sign in to view notifications.</div>;
  }

   const markAllAsRead = async () => {
      if (!user) return;
      try {
         const { writeBatch, doc } = await import("firebase/firestore");
         const batch = writeBatch(db);
         const unreadNotifications = notifications.filter(n => !n.read && n.fromUserId !== user.uid);
         unreadNotifications.forEach(n => {
            batch.update(doc(db, "notifications", n.id), { read: true });
         });
         await batch.commit();
         // Update local state
         setNotifications(notifications.map(n => ({ ...n, read: true })));
      } catch (err) {
         console.error(err);
      }
   };

   const handleDeleteNotification = async (n: any, e?: React.MouseEvent | any) => {
      if (e && e.stopPropagation) {
         e.stopPropagation();
      }
      try {
         // Optimistically hide from local state instantly
         setNotifications(prev => prev.filter(item => item.id !== n.id));
         setLongPressedId(null);

         const { deleteDoc, doc, setDoc } = await import("firebase/firestore");
         await deleteDoc(doc(db, "notifications", n.id));
         
         toast("Notification cleared", {
            action: {
               label: "Undo",
               onClick: async () => {
                  try {
                     // Optimistically restore in state
                     setNotifications(prev => {
                        const exists = prev.some(item => item.id === n.id);
                        if (exists) return prev;
                        const updated = [...prev, n];
                        updated.sort((a, b) => {
                           const timeA = typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : (a.createdAt?.toMillis() || 0);
                           const timeB = typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : (b.createdAt?.toMillis() || 0);
                           return timeB - timeA;
                        });
                        return updated;
                     });
                     await setDoc(doc(db, "notifications", n.id), n);
                  } catch(err) {
                     console.error("Failed to restore notification:", err);
                  }
               }
            }
         });
      } catch(err) {
         console.error(err);
      }
   };

    const handleNotificationClick = (n: any) => {
       // Mark as read if not read
       if (!n.read) {
          try {
             updateDoc(doc(db, "notifications", n.id), { read: true }).catch(err => console.error(err));
             // Optimistically update local states
             setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
          } catch (e) { console.error(e); }
       }
       
       // Go directly to the content:
       if (n.type === 'follow' && n.fromUserId) {
          navigate(`/profile/${n.fromUserId}`);
       } else if (n.postId) {
          navigate(`/problems/${n.postId}`);
       } else if (n.fromUserId) {
          navigate(`/profile/${n.fromUserId}`);
       }
    };

   // Format timestamp IG style (e.g., "2h", "1d", "3w")
   const formatShortTime = (date: any) => {
      if (!date) return "now";
      const dateObj = date.toDate ? date.toDate() : new Date(date);
      return formatDistanceToNowStrict(dateObj)
         .replace(' seconds', 's')
         .replace(' second', 's')
         .replace(' minutes', 'm')
         .replace(' minute', 'm')
         .replace(' hours', 'h')
         .replace(' hour', 'h')
         .replace(' days', 'd')
         .replace(' day', 'd')
         .replace(' months', 'mo')
         .replace(' month', 'mo')
         .replace(' years', 'y')
         .replace(' year', 'y');
   };

  // Filter out any notification triggered by the user themselves
  const filteredNotifications = notifications.filter(n => n.fromUserId !== user.uid && n.userId !== n.fromUserId);

   const getRelativeTimeAgo = (date: any) => {
      const short = formatShortTime(date);
      if (short === "now") return "now";
      return `${short} ago`;
   };
  const hasAnyNotifications = filteredNotifications.length > 0;
  const hasUnread = filteredNotifications.some(n => !n.read);

  return (
    <div id="notifications-page" className="flex flex-col min-h-screen pb-20 md:pb-0 w-full relative">
      {/* Top Navigation Bar */}
      <div id="notifications-header-bar" className="sticky top-0 z-40 bg-buildops-bg/95 backdrop-blur-md border-b border-[rgba(255,255,255,0.05)] px-2 h-14 flex items-center justify-between w-full">
        <div className="flex items-center gap-3 max-w-full w-full">
          <button id="notif-back-btn" onClick={() => navigate(-1)} className="p-1 text-buildops-text-secondary hover:text-white transition-colors cursor-pointer">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-[20px] font-bold text-white tracking-tight">Notifications</h1>
          <div className="flex-1" />
          {hasAnyNotifications && (
            <motion.button 
              id="notif-mark-read" 
              onClick={markAllAsRead} 
              disabled={!hasUnread}
              animate={{ 
                color: hasUnread ? "#3B82F6" : "#71717a" 
              }}
              whileHover={hasUnread ? { opacity: 0.8 } : {}}
              whileTap={hasUnread ? { scale: 0.98 } : {}}
              transition={{ duration: 0.15 }}
              className="text-sm font-semibold justify-end pr-1 cursor-pointer bg-transparent border-0 outline-none disabled:cursor-default"
            >
              Mark all as read
            </motion.button>
          )}
        </div>
      </div>

       <div className="w-full max-w-full pt-1 pb-6 sm:pb-10 min-h-[70vh]">
          <div className="flex flex-col w-full">
             {loading ? (
                <div id="skeleton-loader-container" className="space-y-4 px-2">
                  <NotificationSkeleton />
                  <NotificationSkeleton />
                  <NotificationSkeleton />
                  <NotificationSkeleton />
                </div>
             ) : !hasAnyNotifications ? (
                <div id="no-notifications-placeholder" className="py-24 text-center text-buildops-text-secondary font-medium px-4">No notifications yet.</div>
             ) : (
                <div className="flex flex-col divide-y divide-buildops-border/40 border-b border-buildops-border/40">
                   <AnimatePresence initial={false}>
                      {filteredNotifications.map(n => {
                         const notifUser = n.fromUserId ? notificationUsers[n.fromUserId] : null;
                         const notifPost = n.postId ? notificationPosts[n.postId] : null;
                         
                         const userName = notifUser?.displayName || notifUser?.handle || 'Someone';
                         const userAvatar = notifUser?.photoURL || null;

                         return (
                         <motion.div 
                            key={n.id}
                            layout
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="relative group overflow-hidden bg-buildops-bg"
                         >
                            <motion.div 
                               drag="x"
                               dragConstraints={{ left: 0, right: 0 }}
                               dragElastic={{ left: 0.8, right: 0.8 }}
                               onDragStart={() => {
                                  if (pressTimerRef.current) {
                                     clearTimeout(pressTimerRef.current);
                                     pressTimerRef.current = null;
                                  }
                               }}
                               onDragEnd={(event, info) => {
                                  const swipeThreshold = 100;
                                  if (info.offset.x > swipeThreshold || info.offset.x < -swipeThreshold) {
                                     handleDeleteNotification(n);
                                  }
                               }}
                              onMouseDown={() => {
                                 if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
                                 pressTimerRef.current = setTimeout(() => {
                                    setLongPressedId(n.id);
                                 }, 1000);
                              }}
                              onMouseUp={() => {
                                 if (pressTimerRef.current) {
                                    clearTimeout(pressTimerRef.current);
                                    pressTimerRef.current = null;
                                 }
                              }}
                              onMouseLeave={() => {
                                 if (pressTimerRef.current) {
                                    clearTimeout(pressTimerRef.current);
                                    pressTimerRef.current = null;
                                 }
                              }}
                              onTouchStart={() => {
                                 if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
                                 pressTimerRef.current = setTimeout(() => {
                                    setLongPressedId(n.id);
                                 }, 1000);
                              }}
                              onTouchEnd={() => {
                                 if (pressTimerRef.current) {
                                    clearTimeout(pressTimerRef.current);
                                    pressTimerRef.current = null;
                                 }
                              }}
                              onClick={(e) => {
                                 if (longPressedId) {
                                    e.stopPropagation();
                                    return;
                                 }
                                 if (longPressedId !== n.id) handleNotificationClick(n);
                              }} 
                              className="relative z-10 flex w-full items-center gap-4 py-3 pb-3.5 px-4 sm:px-3 cursor-pointer transition-colors hover:bg-neutral-900/45"
                            >
                               {n.read && <div className="absolute inset-0 bg-buildops-bg/20 pointer-events-none z-30" />}
                               
                               {longPressedId === n.id && (
                                    <div className="absolute inset-0 bg-[#09090b]/95 backdrop-blur-sm z-20 flex items-center justify-end px-4 gap-3 animate-in fade-in">
                                      <button onClick={(e) => { e.stopPropagation(); setLongPressedId(null); }} className="px-3.5 py-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer bg-transparent border-0 outline-none">Cancel</button>
                                      <button onClick={(e) => { handleDeleteNotification(n, e); }} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded transition-colors cursor-pointer border-0 outline-none">Delete</button>
                                    </div>
                               )}

                               {/* Standard Avatar always displays their real profile picture - matching skeleton */}
                               <div className="relative shrink-0 select-none">
                                  <div onClick={(e) => { e.stopPropagation(); navigate(`/profile/${n.fromUserId || n.id}`); }} className="w-10 h-10 rounded-full bg-neutral-800 overflow-hidden cursor-pointer hover:opacity-95 flex items-center justify-center border border-white/5 shadow-md">
                                     {userAvatar ? (
                                        <img src={userAvatar} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                     ) : (
                                        <User className="w-5 h-5 text-buildops-text-secondary" />
                                     )}
                                  </div>
                                  {!n.read && (
                                     <div className="absolute -top-0.5 -left-0.5 w-3 h-3 rounded-full bg-buildops-blue border-2 border-buildops-bg animate-pulse z-10" />
                                  )}
                                  {/* Bottom-right Action Trigger Badge */}
                                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-zinc-900 border border-buildops-border/40 flex items-center justify-center shadow-lg z-10">
                                     {getTriggerIcon(n.type)}
                                  </div>
                                </div>
     
                               {/* Content Column (Beautiful 2-row block matching skeleton) */}
                               <div className="flex-1 min-w-0 space-y-1">
                                  <div className="text-[14px] text-zinc-300 leading-snug truncate pr-2">
                                     <span 
                                        className="font-bold text-white hover:underline cursor-pointer mr-1.5"
                                        onClick={(e) => { e.stopPropagation(); navigate(`/profile/${n.fromUserId}`); }}
                                     >
                                        {userName}
                                     </span>
                                     <span className="text-zinc-300">
                                        {n.type === 'like' && "liked your post"}
                                        {n.type === 'comment' && "commented"}
                                        {n.type === 'reply' && "replied"}
                                        {n.type === 'follow' && "followed you"}
                                        {n.type === 'mention' && "mentioned you"}
                                        {n.type === 'tagged' && "tagged you"}
                                        {n.type === 'tag' && "tagged you"}
                                        {n.type === 'share' && "shared"}
                                        {n.type === 'shares' && "shared"}
                                        {n.type === 'save' && "saved"}
                                        {n.type === 'saved' && "saved"}
                                        {!['like', 'comment', 'reply', 'follow', 'mention', 'tag', 'tagged', 'share', 'shares', 'save', 'saved'].includes(n.type) && (n.msg || n.message || 'interacted')}
                                     </span>
                                     
                                     {notifPost?.title && (
                                        <span className="text-zinc-400 font-semibold italic"> "{truncateText(notifPost.title, 20)}"</span>
                                     )}

                                     {n.message && (n.type === 'comment' || n.type === 'reply' || n.type === 'mention') && (
                                        <span className="text-zinc-400 font-medium ml-1">
                                           : {truncateText(n.message, 25)}
                                        </span>
                                     )}
                                  </div>

                                  <div className="flex items-center gap-3 text-[12px] text-zinc-500 font-normal">
                                     <span>{getRelativeTimeAgo(n.createdAt)}</span>
                                     {(n.type === 'comment' || n.type === 'reply' || n.type === 'mention') && (
                                        <>
                                           <span className="text-zinc-700 select-none">•</span>
                                           <button 
                                              onClick={(e) => {
                                                 e.stopPropagation();
                                                 if (n.postId) navigate(`/problems/${n.postId}`);
                                              }}
                                              className="font-semibold text-zinc-500 hover:text-white transition-colors cursor-pointer"
                                           >
                                              Reply
                                           </button>
                                        </>
                                     )}
                                  </div>
                               </div>
                               
                               {/* Row-hover Delete Action Button (visible on hover) */}
                               <button 
                                  onClick={(e) => {
                                     e.stopPropagation();
                                     handleDeleteNotification(n, e);
                                  }}
                                  className="absolute right-15 top-1/2 -translate-y-1/2 z-30 p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all opacity-0 group-hover:opacity-100 cursor-pointer hidden md:flex items-center justify-center bg-transparent border-0 outline-none"
                                  title="Delete notification"
                               >
                                  <Trash2 className="w-4 h-4" />
                               </button>

                               {/* Right side Action Block matching the skeleton with generic post outline icon */}
                               <div className="shrink-0 flex items-center select-none">
                                  {n.postId ? (
                                     <div 
                                        onClick={(e) => {
                                           e.stopPropagation();
                                           navigate(`/problems/${n.postId}`);
                                        }}
                                        className="w-10 h-10 rounded-lg bg-buildops-card border border-buildops-border/40 shrink-0 flex items-center justify-center hover:bg-neutral-800 transition-colors cursor-pointer"
                                        title="View post"
                                     >
                                        <FileText className="w-5 h-5 text-zinc-400 stroke-[1.5]" />
                                     </div>
                                  ) : (
                                     <div className="w-10 h-10 shrink-0" />
                                  )}
                               </div>
                            </motion.div>
                         </motion.div>
                         );
                      })}
                   </AnimatePresence>
                </div>
             )}
          </div>
       </div>
    </div>
  );
}
