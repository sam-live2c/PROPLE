import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowLeft, ChevronRight, Info, Award, CheckCircle2, User } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/src/lib/firebase';
import { collection, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/src/contexts/AuthContext';

interface UserActionModalsProps {
  user: any;
  isOpen: 'report' | 'about' | 'none' | 'stats';
  onClose: () => void;
}

export function UserActionModals({ user, isOpen, onClose }: UserActionModalsProps) {
  const { user: currentUser } = useAuth();

  if (isOpen === 'none') return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClose(); }}>
      <div 
        className="w-full max-w-md bg-buildops-card border border-buildops-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95" 
        onClick={e => { e.stopPropagation(); e.preventDefault(); }}
      >
        {isOpen === 'about' && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
               <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClose(); }} className="p-1 -ml-1 text-buildops-text-secondary hover:text-buildops-text transition-colors">
                  <ArrowLeft className="w-5 h-5" />
               </button>
               <h2 className="text-xl font-bold text-buildops-text">About this account</h2>
            </div>
            
            <div className="flex items-center gap-4 mb-8">
               <div className="w-16 h-16 rounded-full border border-buildops-border overflow-hidden bg-buildops-bg flex items-center justify-center shrink-0">
                  {user?.photoURL ? (
                     <img src={user.photoURL} alt={user?.displayName || "User"} className="w-full h-full object-cover" />
                  ) : (
                     <User className="w-8 h-8 text-buildops-text-secondary" />
                  )}
               </div>
               <div className="font-bold text-lg text-buildops-text">
                  {user?.displayName || user?.handle || "Anonymous Explorer"}
               </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-buildops-border/50 pb-4">
                 <div>
                    <div className="text-sm text-buildops-text-secondary mb-1">Date joined</div>
                    <div className="text-base font-medium text-buildops-text">
                      {user?.createdAt 
                        ? (typeof user.createdAt === 'string' 
                            ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) 
                            : (user.createdAt?.toDate 
                                ? user.createdAt.toDate().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) 
                                : new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })))
                        : "Unknown"}
                    </div>
                 </div>
              </div>
              <div className="flex items-center justify-between border-b border-buildops-border/50 pb-4">
                 <div>
                    <div className="text-sm text-buildops-text-secondary mb-1">Account located in</div>
                    <div className="text-base font-medium text-buildops-text">{user?.location || "Unknown"}</div>
                 </div>
              </div>
              <div className="flex items-center justify-between pb-2">
                 <div>
                    <div className="text-sm text-buildops-text-secondary mb-1">Gender</div>
                    <div className="text-base font-medium text-buildops-text">{user?.gender || "Prefer not to say"}</div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {isOpen === 'report' && (
          <div className="p-0">
            <div className="p-6 border-b border-buildops-border">
               <div className="flex items-center gap-3">
                  <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClose(); }} className="p-1 -ml-1 text-buildops-text-secondary hover:text-buildops-text transition-colors">
                     <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-xl font-bold text-buildops-text">Report Account</h2>
               </div>
            </div>
            
            <div className="p-6">
                <div className="text-center mb-6">
                   <AlertTriangle className="w-10 h-10 text-buildops-orange mx-auto mb-3" />
                   <p className="text-sm text-buildops-text-secondary">Your report is anonymous, except if you're reporting an intellectual property infringement.</p>
                </div>
                
                <h3 className="font-bold text-buildops-text mb-3 px-1 text-sm">Why are you reporting this account?</h3>
                <div className="space-y-1 max-h-[40vh] overflow-y-auto no-scrollbar pb-2">
                   {[
                     "It's spam", 
                     "I just don't like it", 
                     "Suicide or self-injury", 
                     "Sale of illegal or regulated goods", 
                     "Nudity or sexual activity", 
                     "Hate speech or symbols", 
                     "Violence or dangerous organizations", 
                     "Bullying or harassment", 
                     "Intellectual property violation"
                   ].map((reason) => (
                      <button 
                         key={reason} 
                         onClick={async (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (!currentUser || currentUser.isAnonymous) {
                               toast.error("Guest users cannot report accounts.");
                               return;
                            }
                            const reportRefParam = doc(collection(db, "reports"));
                            try {
                               await setDoc(reportRefParam, {
                                  postId: 'account_report',
                                  userId: currentUser.uid,
                                  userName: currentUser.displayName || 'Unknown User',
                                  uname: currentUser.displayName ? currentUser.displayName.toLowerCase().replace(/\s+/g, '') : "unknown",
                                  reason: `[Account: ${user?.displayName || user?.handle}] - ${reason}`,
                                  recentActivity: { targetType: "account", targetUserId: user?.uid || user?.id },
                                  createdAt: serverTimestamp()
                               });
                               toast('Report submitted successfully.', {
                                  action: {
                                    label: 'Undo',
                                    onClick: async () => {
                                       try {
                                          await deleteDoc(doc(db, "reports", reportRefParam.id));
                                          toast.success("Report undone");
                                       } catch(err) {
                                          toast.error("Failed to undo");
                                       }
                                    }
                                  }
                               });
                            } catch (err) {
                               console.error(err);
                               toast.error("Failed to submit report");
                            }
                            onClose();
                         }} 
                         className="w-full text-left py-3 px-3 rounded-lg hover:bg-buildops-bg transition-colors flex items-center justify-between group"
                      >
                         <span className="text-sm text-buildops-text font-medium">{reason}</span>
                         <ChevronRight className="w-4 h-4 text-buildops-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                   ))}
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
