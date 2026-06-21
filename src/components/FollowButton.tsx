import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/contexts/AuthContext";
import { cn } from "@/src/lib/utils";
import { toast } from "sonner";

interface FollowButtonProps {
  targetId: string;
  className?: string;
  variant?: "text" | "button";
}

export function FollowButton({ targetId, className, variant = "text" }: FollowButtonProps) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollower, setIsFollower] = useState(false);
  const [initialIsFollowing, setInitialIsFollowing] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.uid === targetId) {
      setLoading(false);
      return;
    }
    const checkFollow = async () => {
      try {
        const [followDoc, followerDoc] = await Promise.all([
          getDoc(doc(db, "followers", `${user.uid}_${targetId}`)),
          getDoc(doc(db, "followers", `${targetId}_${user.uid}`))
        ]);
        
        const following = followDoc.exists();
        setIsFollowing(following);
        setInitialIsFollowing(following);
        setIsFollower(followerDoc.exists());
      } catch (e: any) {
        if (e?.message?.includes("offline") || e?.code === "unavailable") {
          console.warn("Firestore client is offline. Follow status loaded in offline mode.");
        } else {
          console.warn("Failed to check follow status:", e);
        }
      } finally {
        setLoading(false);
      }
    };
    checkFollow();
  }, [user, targetId]);

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || user.isAnonymous) {
      toast.error("Guest users cannot follow other users.");
      return;
    }
    if (user.uid === targetId) return;

    const followId = `${user.uid}_${targetId}`;
    const followRef = doc(db, "followers", followId);
    
    const previousState = isFollowing;
    setIsFollowing(!isFollowing);

    try {
      if (previousState) {
        await deleteDoc(followRef);
      } else {
        await setDoc(followRef, { followerId: user.uid, followingId: targetId, createdAt: serverTimestamp() });
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
      setIsFollowing(previousState);
    }
  };

  if (user?.uid === targetId) return null;

  if (variant === "text" && initialIsFollowing === true) return null;
  
  const buttonText = isFollowing ? "Following" : (isFollower ? "Follow Back" : "Follow");

  if (variant === "text") {
    return (
      <button
        type="button"
        disabled={loading}
        onClick={handleFollow}
        className={cn(
          "text-sm font-semibold hover:underline",
          isFollowing ? "text-buildops-text-secondary" : "text-buildops-blue",
          loading ? "opacity-50 pointer-events-none" : "",
          className
        )}
      >
        {buttonText}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleFollow}
      className={cn(
        "px-4 py-1.5 rounded-full text-sm font-semibold transition-colors",
        isFollowing 
          ? "bg-buildops-border text-buildops-text hover:bg-buildops-border/80" 
          : "bg-buildops-blue text-white hover:bg-buildops-blue/90",
        loading ? "opacity-50 pointer-events-none" : "",
        className
      )}
    >
      {buttonText}
    </button>
  );
}
