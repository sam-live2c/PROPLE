import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/contexts/AuthContext";
import { handleFirestoreError, OperationType } from "@/src/lib/firestore-errors";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { Trash2, RotateCcw, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { ProblemCard } from "./ProblemCard";

export function TrashSettings() {
  const { user } = useAuth();
  const [trashedPosts, setTrashedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    
    const q = query(
      collection(db, "posts"),
      where("authorId", "==", user.uid),
      where("status", "==", "trashed")
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const posts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      posts.sort((a: any, b: any) => {
          const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
          const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
          return timeB - timeA;
      });
      setTrashedPosts(posts);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleRestore = async (id: string) => {
     try {
       await updateDoc(doc(db, "posts", id), {
         status: "open", // Fallback to open
         updatedAt: serverTimestamp()
       });
       toast.success("Post restored successfully");
     } catch (e) {
       toast.error("Failed to restore post");
       handleFirestoreError(e, OperationType.UPDATE, `posts/${id}`);
     }
  };

  const handleDeletePermanently = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const postData = trashedPosts.find(p => p.id === id);
      if (!postData) return;
      const { id: _, ...rest } = postData;
      const batch = writeBatch(db);
      batch.delete(doc(db, "posts", id));
      
      const { getDocs } = await import("firebase/firestore");
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
              restoreBatch.set(doc(db, "posts", id), rest);
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
    } catch (error) {
      toast.error("Failed to delete post");
      handleFirestoreError(error, OperationType.DELETE, `posts/${id}`);
    }
  };

  if (loading) {
    return (
      <div className="w-full space-y-4">
        {[1, 2, 3].map((i) => (
           <div key={i} className="border border-[rgba(255,255,255,0.05)] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[rgba(255,255,255,0.02)]">
              <div className="flex-1 space-y-3 w-full">
                 <div className="h-5 w-3/4 bg-[rgba(255,255,255,0.08)] rounded animate-pulse" />
                 <div className="h-3 w-1/3 bg-[rgba(255,255,255,0.08)] rounded animate-pulse" />
              </div>
              <div className="flex gap-2 shrink-0">
                 <div className="h-9 w-20 bg-[rgba(255,255,255,0.08)] rounded-lg animate-pulse" />
                 <div className="h-9 w-20 bg-[rgba(255,255,255,0.08)] rounded-lg animate-pulse" />
              </div>
           </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full">
      {trashedPosts.length === 0 ? (
        <div className="text-center py-12 px-6 border border-buildops-border rounded-xl bg-buildops-card flex flex-col items-center mx-4 my-6">
            <AlertCircle className="w-8 h-8 text-buildops-text-secondary mb-3" />
            <p className="text-buildops-text font-semibold">Your trash is empty</p>
            <p className="text-buildops-text-secondary text-sm mt-2 max-w-md leading-relaxed">
              Posts in trash will be permanently deleted after 30 days in accordance with our{" "}
              <Link to="/terms" className="text-buildops-blue hover:underline">Terms & Conditions</Link>{" "}
              and{" "}
              <Link to="/settings/guidance" className="text-buildops-blue hover:underline">User Guidance</Link>.
            </p>
        </div>
      ) : (
        <div className="w-full max-w-4xl mx-auto divide-y divide-buildops-border">
          {trashedPosts.map(post => {
            return (
              <ProblemCard 
                key={post.id} 
                post={post} 
                showTrashActions={true}
                onRestore={() => handleRestore(post.id)}
                onDeletePermanently={() => handleDeletePermanently(post.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
