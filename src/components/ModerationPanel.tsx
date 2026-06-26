import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  User, 
  UserX, 
  UserCheck, 
  Trash, 
  RotateCcw, 
  Search, 
  Check, 
  Eye, 
  X,
  FileText,
  ShieldAlert,
  Mail,
  ChevronRight,
  Info
} from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  updateDoc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp 
} from 'firebase/firestore';
import { toast } from 'sonner';

interface ModerationPanelProps {
  currentUserProfile: any;
}

export function ModerationPanel({ currentUserProfile }: ModerationPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<'reports' | 'users' | 'posts'>('reports');
  const [reports, setReports] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [postSearchQuery, setPostSearchQuery] = useState('');
  const [selectedPostStatus, setSelectedPostStatus] = useState<'suspended' | 'trashed' | 'all'>('suspended');
  
  const [loading, setLoading] = useState(false);
  const [actionReason, setActionReason] = useState('');
  const [selectedActionTarget, setSelectedActionTarget] = useState<{ type: 'post' | 'user'; id: string; data?: any } | null>(null);

  // Load Reports
  const fetchReports = async () => {
    setLoading(true);
    try {
      const reportsRef = collection(db, "reports");
      const q = query(reportsRef, orderBy("createdAt", "desc"), limit(50));
      const snap = await getDocs(q);
      const reportsList = snap.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setReports(reportsList);
    } catch (err) {
      console.error("Error fetching reports:", err);
      // Fallback without ordering just in case index is creating or missing
      try {
        const reportsRef = collection(db, "reports");
        const snap = await getDocs(reportsRef);
        const reportsList = snap.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        setReports(reportsList);
      } catch (innerErr) {
        toast.error("Failed to load reports panel");
      }
    } finally {
      setLoading(false);
    }
  };

  // Load Users
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersRef = collection(db, "users");
      const snap = await getDocs(usersRef);
      const usersList = snap.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setUsers(usersList);
    } catch (err) {
      console.error("Error fetching users:", err);
      toast.error("Failed to load users directory");
    } finally {
      setLoading(false);
    }
  };

  // Load Posts (Suspended & Trashed by default)
  const fetchPosts = async () => {
    setLoading(true);
    try {
      const postsRef = collection(db, "posts");
      const snap = await getDocs(postsRef);
      const postsList = snap.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setPosts(postsList);
    } catch (err) {
      console.error("Error fetching posts:", err);
      toast.error("Failed to load moderated content");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'reports') {
      fetchReports();
    } else if (activeSubTab === 'users') {
      fetchUsers();
    } else if (activeSubTab === 'posts') {
      fetchPosts();
    }
  }, [activeSubTab]);

  // Send System Notification helper
  const sendSystemNotification = async (targetUserId: string, message: string, postId?: string) => {
    try {
      const notifRef = doc(collection(db, "notifications"));
      await setDoc(notifRef, {
        userId: targetUserId,
        type: "moderation",
        fromUserId: "system",
        postId: postId || "system",
        msg: message,
        message: message,
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to send moderation notification:", err);
    }
  };

  // Handle Ban/Unban Account
  const handleToggleBan = async (userId: string, currentBanState: boolean, userName: string) => {
    try {
      const userRef = doc(db, "users", userId);
      const newBanState = !currentBanState;
      
      await updateDoc(userRef, {
        isBanned: newBanState,
        status: newBanState ? 'banned' : 'active',
        updatedAt: serverTimestamp()
      });

      // Notify user profile history
      const logMessage = newBanState 
        ? `Your account has been banned/suspended by administration for policy violations. Reason: ${actionReason || 'Community standards violation'}.`
        : `Your account has been reinstated by administration. Welcome back!`;
      
      await sendSystemNotification(userId, logMessage);

      toast.success(newBanState ? `Banned @${userName}` : `Unbanned @${userName}`);
      setActionReason('');
      setSelectedActionTarget(null);
      
      // Refresh user lists
      if (activeSubTab === 'users') fetchUsers();
      if (activeSubTab === 'reports') fetchReports();
    } catch (err) {
      console.error(err);
      toast.error("Failed to modify user ban status");
    }
  };

  // Handle Suspend Post
  const handleSuspendPost = async (postId: string, authorId: string, postTitle: string) => {
    try {
      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, {
        status: "suspended",
        updatedAt: serverTimestamp()
      });

      const logMessage = `Your post "${postTitle}" has been suspended by administration. Reason: ${actionReason || 'Inappropriate content / Policy violation'}.`;
      await sendSystemNotification(authorId, logMessage, postId);

      toast.success("Post suspended and author notified.");
      setActionReason('');
      setSelectedActionTarget(null);

      // Refresh
      if (activeSubTab === 'posts') fetchPosts();
      if (activeSubTab === 'reports') fetchReports();
    } catch (err) {
      console.error(err);
      toast.error("Failed to suspend post");
    }
  };

  // Handle Resurrect / Restore Post
  const handleRestorePost = async (postId: string, authorId: string, postTitle: string) => {
    try {
      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, {
        status: "open",
        updatedAt: serverTimestamp()
      });

      const logMessage = `Your post "${postTitle}" has been successfully reviewed and restored to the public feed by moderation.`;
      await sendSystemNotification(authorId, logMessage, postId);

      toast.success("Post resurrected and author notified!");
      
      // Refresh
      if (activeSubTab === 'posts') fetchPosts();
      if (activeSubTab === 'reports') fetchReports();
    } catch (err) {
      console.error(err);
      toast.error("Failed to resurrect post");
    }
  };

  // Dismiss report
  const handleDismissReport = async (reportId: string) => {
    try {
      await deleteDoc(doc(db, "reports", reportId));
      toast.success("Report dismissed successfully");
      fetchReports();
    } catch (err) {
      console.error(err);
      toast.error("Failed to dismiss report");
    }
  };

  // Filter lists
  const filteredUsers = users.filter(u => {
    const queryLower = userSearchQuery.toLowerCase();
    return (
      (u.displayName || '').toLowerCase().includes(queryLower) ||
      (u.email || '').toLowerCase().includes(queryLower) ||
      (u.handle || '').toLowerCase().includes(queryLower)
    );
  });

  const filteredPosts = posts.filter(p => {
    const matchesSearch = (p.title || '').toLowerCase().includes(postSearchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (selectedPostStatus === 'suspended') {
      return p.status === 'suspended';
    } else if (selectedPostStatus === 'trashed') {
      return p.status === 'trashed';
    } else {
      return true; // All posts
    }
  });

  if (currentUserProfile?.role !== 'admin') {
    return (
      <div className="p-8 text-center bg-buildops-card border border-buildops-border rounded-2xl">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
        <p className="text-buildops-text-secondary text-sm">
          You do not have administrative privileges required to access this resource.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Moderation Navigation Tabs */}
      <div className="flex border-b border-[rgba(255,255,255,0.05)] pb-px">
        {[
          { id: 'reports', label: 'Safety Reports', count: reports.length, icon: AlertTriangle },
          { id: 'users', label: 'User Directory', count: filteredUsers.length, icon: User },
          { id: 'posts', label: 'Content Control', count: filteredPosts.length, icon: FileText }
        ].map((subTab) => {
          const SubIcon = subTab.icon;
          const isActive = activeSubTab === subTab.id;
          return (
            <button
              key={subTab.id}
              onClick={() => setActiveSubTab(subTab.id as any)}
              className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition-colors cursor-pointer border-transparent ${
                isActive 
                  ? 'border-buildops-blue text-white bg-white/[0.02]' 
                  : 'text-buildops-text-secondary hover:text-white'
              }`}
            >
              <SubIcon className={`w-4 h-4 ${isActive ? 'text-buildops-blue' : 'text-buildops-text-secondary'}`} />
              {subTab.label}
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-buildops-blue/20 text-buildops-blue' : 'bg-white/5 text-buildops-text-secondary'}`}>
                {subTab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Panel Body */}
      <div className="min-h-[400px]">
        {loading && (
          <div className="py-12 text-center text-buildops-text-secondary text-sm">
            Loading database nodes...
          </div>
        )}

        {/* --- REPORTS PANEL --- */}
        {!loading && activeSubTab === 'reports' && (
          <div className="space-y-4">
            {reports.length === 0 ? (
              <div className="text-center py-16 bg-white/[0.01] border border-[rgba(255,255,255,0.03)] rounded-2xl">
                <Check className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white mb-1">Inbox Clear</h3>
                <p className="text-buildops-text-secondary text-sm">No safety policy reports reported yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.05)] rounded-2xl bg-white/[0.01] overflow-hidden">
                {reports.map((report) => (
                  <div key={report.id} className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-4 hover:bg-white/[0.01] transition-colors">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/10 flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3" />
                          Safety Flag
                        </span>
                        <span className="text-xs text-buildops-text-secondary font-mono">
                          {report.createdAt?.toDate ? report.createdAt.toDate().toLocaleDateString() : 'Recent'}
                        </span>
                      </div>

                      <h4 className="text-base font-semibold text-white">{report.reason}</h4>
                      
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-buildops-text-secondary font-mono">
                        <div>Reporter: <span className="text-white">@{report.userName || 'anonymous'}</span></div>
                        {report.recentActivity?.targetUserId && (
                          <div>Target UID: <span className="text-buildops-blue shrink-0">{report.recentActivity.targetUserId.slice(0, 10)}...</span></div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-end md:self-center shrink-0">
                      {report.postId && report.postId !== 'account_report' && (
                        <button
                          onClick={() => {
                            setSelectedActionTarget({
                              type: 'post',
                              id: report.postId,
                              data: { title: report.reason, authorId: report.recentActivity?.targetUserId || '' }
                            });
                          }}
                          className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors cursor-pointer"
                        >
                          Suspend Post
                        </button>
                      )}

                      {report.recentActivity?.targetUserId && (
                        <button
                          onClick={() => {
                            setSelectedActionTarget({
                              type: 'user',
                              id: report.recentActivity.targetUserId,
                              data: { displayName: report.userName || 'Reported User', isBanned: false }
                            });
                          }}
                          className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-red-500/20 hover:bg-red-500/35 text-red-300 border border-red-500/20 transition-colors cursor-pointer"
                        >
                          Ban User
                        </button>
                      )}

                      <button
                        onClick={() => handleDismissReport(report.id)}
                        className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-buildops-text border border-white/5 transition-colors cursor-pointer"
                      >
                        Dismiss Report
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- USERS PANEL --- */}
        {!loading && activeSubTab === 'users' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-buildops-text-secondary" />
              <input
                type="text"
                placeholder="Search database users by name, email, or handle..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="w-full bg-white/[0.02] border border-[rgba(255,255,255,0.05)] rounded-xl pl-11 pr-4 py-3 text-sm text-white outline-none focus:border-buildops-blue/50 placeholder-buildops-text-secondary"
              />
            </div>

            <div className="border border-[rgba(255,255,255,0.05)] rounded-2xl bg-white/[0.01] overflow-hidden divide-y divide-[rgba(255,255,255,0.05)]">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-buildops-text-secondary text-sm">
                  No matching user credentials found in registry index.
                </div>
              ) : (
                filteredUsers.map((userNode) => {
                  const isUserBanned = userNode.isBanned === true || userNode.status === 'banned';
                  const isAdminRole = userNode.role === 'admin';
                  return (
                    <div key={userNode.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                          {userNode.photoURL ? (
                            <img src={userNode.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-5 h-5 text-buildops-text-secondary" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-[15px]">{userNode.displayName || 'Anonymous'}</span>
                            {isAdminRole && (
                              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-buildops-blue/20 text-buildops-blue border border-buildops-blue/20">
                                Admin Node
                              </span>
                            )}
                            {isUserBanned && (
                              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-red-500/20 text-red-400 border border-red-500/20">
                                Banned
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-buildops-text-secondary font-mono mt-0.5">
                            @{userNode.handle} • {userNode.email || 'No email synced'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {userNode.id !== currentUserProfile.uid && (
                          <button
                            onClick={() => {
                              setSelectedActionTarget({
                                type: 'user',
                                id: userNode.id,
                                data: { ...userNode, isBanned: isUserBanned }
                              });
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                              isUserBanned
                                ? 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/20'
                                : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                            }`}
                          >
                            {isUserBanned ? 'Unban Account' : 'Ban Account'}
                          </button>
                        )}

                        {userNode.id !== currentUserProfile.uid && (
                          <button
                            onClick={async () => {
                              try {
                                const userRef = doc(db, "users", userNode.id);
                                const newRole = isAdminRole ? 'user' : 'admin';
                                await updateDoc(userRef, { role: newRole, updatedAt: serverTimestamp() });
                                toast.success(`Changed @${userNode.handle} role to ${newRole}`);
                                fetchUsers();
                              } catch (err) {
                                toast.error("Failed to update user role");
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/5 transition-colors cursor-pointer"
                          >
                            {isAdminRole ? 'Demote to User' : 'Make Admin'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* --- POSTS / CONTENT PANEL --- */}
        {!loading && activeSubTab === 'posts' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-buildops-text-secondary" />
                <input
                  type="text"
                  placeholder="Search posts by title..."
                  value={postSearchQuery}
                  onChange={(e) => setPostSearchQuery(e.target.value)}
                  className="w-full bg-white/[0.02] border border-[rgba(255,255,255,0.05)] rounded-xl pl-11 pr-4 py-2.5 text-sm text-white outline-none focus:border-buildops-blue/50 placeholder-buildops-text-secondary"
                />
              </div>

              <div className="flex gap-1 bg-white/5 p-1 rounded-xl self-start">
                {[
                  { id: 'suspended', label: 'Suspended' },
                  { id: 'trashed', label: 'Trashed' },
                  { id: 'all', label: 'All Content' }
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setSelectedPostStatus(st.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      selectedPostStatus === st.id 
                        ? 'bg-buildops-blue text-white shadow' 
                        : 'text-buildops-text-secondary hover:text-white'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border border-[rgba(255,255,255,0.05)] rounded-2xl bg-white/[0.01] overflow-hidden divide-y divide-[rgba(255,255,255,0.05)]">
              {filteredPosts.length === 0 ? (
                <div className="text-center py-12 text-buildops-text-secondary text-sm">
                  No moderated content records matches criteria index.
                </div>
              ) : (
                filteredPosts.map((postNode) => {
                  const isSuspended = postNode.status === 'suspended';
                  const isTrashed = postNode.status === 'trashed';
                  return (
                    <div key={postNode.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/10 text-buildops-text">
                            {postNode.type || 'post'}
                          </span>
                          {isSuspended && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-400">
                              Suspended
                            </span>
                          )}
                          {isTrashed && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-yellow-500/20 text-yellow-400">
                              Trashed (Soft Delete)
                            </span>
                          )}
                          {!isSuspended && !isTrashed && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-500/20 text-green-400">
                              Active
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-white text-[15px] truncate">{postNode.title}</h4>
                        <p className="text-xs text-buildops-text-secondary truncate mt-0.5">
                          Author UID: {postNode.authorId} • Category: {postNode.category || 'none'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {isSuspended || isTrashed ? (
                          <button
                            onClick={() => handleRestorePost(postNode.id, postNode.authorId, postNode.title)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Resurrect Post
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedActionTarget({
                                type: 'post',
                                id: postNode.id,
                                data: postNode
                              });
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Suspend
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ACTION DIALOG MODAL (For Entering Reason & Safety Logging) */}
      {selectedActionTarget && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#0d1117] border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 shadow-2xl relative">
            <button 
              onClick={() => setSelectedActionTarget(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-buildops-text-secondary hover:text-white transition-colors hover:bg-white/5 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  Confirm Policy Action
                </h3>
                <p className="text-xs text-buildops-text-secondary mt-0.5">
                  Actioning: {selectedActionTarget.type === 'user' ? `@${selectedActionTarget.data?.handle || 'User'}` : `Post: ${selectedActionTarget.data?.title?.slice(0, 30)}...`}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-buildops-text-secondary mb-2">
                  Moderation Reason (Sent to User)
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Specify the guidelines policy violated, e.g., 'Violating guidelines section 3.2 regarding inappropriate links.'"
                  className="w-full h-24 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-red-500/50 placeholder-buildops-text-secondary/70 resize-none font-sans"
                />
              </div>

              <div className="flex justify-end gap-2.5">
                <button
                  onClick={() => setSelectedActionTarget(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10 text-buildops-text transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (selectedActionTarget.type === 'user') {
                      handleToggleBan(
                        selectedActionTarget.id, 
                        selectedActionTarget.data?.isBanned || false, 
                        selectedActionTarget.data?.handle || 'User'
                      );
                    } else {
                      handleSuspendPost(
                        selectedActionTarget.id, 
                        selectedActionTarget.data?.authorId || '', 
                        selectedActionTarget.data?.title || 'User Post'
                      );
                    }
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors cursor-pointer"
                >
                  Confirm Action
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
