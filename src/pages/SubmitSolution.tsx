import { Github, Video, Image as ImageIcon } from "lucide-react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import { collection, doc, writeBatch, getDoc, increment, serverTimestamp } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { handleFirestoreError, OperationType } from "@/src/lib/firestore-errors";

import { generateSearchData } from "@/src/lib/search";
import { notifyMentions } from "@/src/lib/mentions";
import { toast } from "sonner";
import { CodeEditor } from "@/src/components/CodeEditor";
import { useConfirmNavigation } from "@/src/hooks/useConfirmNavigation";
import { ConfirmNavigationDialog } from "@/src/components/ConfirmNavigationDialog";

export function SubmitSolution() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  // Guest & Logged Out user restriction
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        toast.error("Please sign in to submit comments.");
        navigate(`/problems/${id || 'explore'}`);
      } else if (user.isAnonymous) {
        toast.error("Guest users cannot submit solutions.");
        navigate(`/problems/${id || 'explore'}`);
      }
    }
  }, [user, authLoading, navigate, id]);
  
  const [postTitle, setPostTitle] = useState("Loading...");
  const [loading, setLoading] = useState(false);
  
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");

  const isDirty = body.trim() !== "" || title.trim() !== "";
  const blocker = useConfirmNavigation(isDirty && !loading);

  // Load draft on mount
  useEffect(() => {
    const saved = localStorage.getItem(`submit_solution_draft_full_${id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.body) setBody(parsed.body);
      } catch (e) {
        console.error("Failed to parse draft", e);
      }
    }
  }, [id]);

  useEffect(() => {
    if (id) {
       getDoc(doc(db, "posts", id)).then(snap => {
          if (snap.exists()) setPostTitle(snap.data().title);
       });
    }
  }, [id]);

  const handleSubmit = async () => {
    if (!id || !user || user.isAnonymous) {
      toast.error("Guest users cannot submit solutions.");
      return;
    }
    if (!body.trim()) return;
    setLoading(true);
    
    try {
       const postRef = doc(db, "posts", id);
       const postSnap = await getDoc(postRef);
       if (!postSnap.exists()) return;

       const batch = writeBatch(db);
       const commentRef = doc(collection(db, "comments"));
       
       const searchData = generateSearchData({
          title,
          body,
          authorName: user.displayName || "",
          authorHandle: user.displayName ? user.displayName.toLowerCase().replace(/\s+/g, '') : ""
       });

       batch.set(commentRef, {
          postId: id,
          authorId: user.uid,
          type: "solution",
          body: `${title ? `### ${title}\n\n` : ''}${body}`,
          search: searchData,
          createdAt: serverTimestamp()
       });
       
       batch.update(postRef, {
          "stats.commentsCount": increment(1),
          updatedAt: serverTimestamp()
       });
       
       if (postSnap.data()?.authorId && postSnap.data().authorId !== user.uid) {
          const notifRef = doc(collection(db, "notifications"));
          batch.set(notifRef, {
             userId: postSnap.data().authorId,
             fromUserId: user.uid,
             postId: id,
             type: 'comment',
             read: false,
             createdAt: serverTimestamp()
          });
       }
       await batch.commit();
       await notifyMentions(`${title ? `### ${title}\n\n` : ''}${body}`, id, user.uid, "mentioned you in a comment", commentRef.id);
       localStorage.removeItem(`submit_solution_draft_full_${id}`);
       navigate(`/problems/${id}`);
    } catch (e) {
       handleFirestoreError(e, OperationType.CREATE, 'comments');
       console.error("Failed to submit solution/comment", e);
    } finally {
       setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pt-4">
      <div>
        <h1 className="text-2xl font-bold text-buildops-text mb-1">Submit Comment</h1>
        <p className="text-sm text-buildops-text-secondary">Providing a comment for: <span className="font-medium text-buildops-text truncate">{postTitle}</span></p>
      </div>

      <form className="space-y-6 bg-buildops-card border border-buildops-border rounded-xl p-5 sm:p-6 shadow-sm">
        
        <div className="space-y-5">
           <div>
            <label className="block text-sm font-medium text-buildops-text mb-2">Title (Optional)</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-buildops-border bg-buildops-bg py-2.5 px-4 text-sm text-buildops-text focus:border-buildops-blue focus:outline-none focus:ring-1 focus:ring-buildops-blue placeholder:text-buildops-text-secondary" 
              placeholder="e.g., Offline AI attendance using NCNN on Pi Zero 2W" 
            />
          </div>

          <div>
             <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-buildops-text">Write your solution</label>
             </div>
             <CodeEditor
               value={body}
               onChange={setBody}
               placeholder={"Explain your architecture and steps...\nMarkdown and code blocks are supported."}
               height="150px"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-buildops-border">
          <button 
            type="button" 
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 text-sm font-medium text-buildops-text-secondary hover:text-white hover:bg-buildops-bg rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            type="button" 
            onClick={handleSubmit}
            disabled={!body.trim() || !user || loading}
            className="px-6 py-2.5 rounded-lg bg-buildops-green text-sm font-bold text-buildops-bg hover:bg-buildops-green/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Submitting..." : "Post Comment"}
          </button>
        </div>

      </form>
      <ConfirmNavigationDialog
        isOpen={blocker.state === 'blocked'}
        title="Discard changes?"
        description="You have unsaved edits."
        primaryActionText="Save Draft"
        secondaryActionText="Discard"
        onPrimaryAction={() => {
           localStorage.setItem(`submit_solution_draft_full_${id}`, JSON.stringify({ title, body }));
           blocker.proceed?.();
        }}
        onSecondaryAction={() => {
          localStorage.removeItem(`submit_solution_draft_full_${id}`);
          blocker.proceed?.();
        }}
        onDismiss={() => blocker.reset?.()}
      />
    </div>
  );
}
