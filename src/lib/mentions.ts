import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";

export function processContent(text: string): string {
  if (!text) return "";
  
  // This replaces @handle and #tag with markdown links, but avoids inside code blocks and existing links
  const parts = text.split(/(```[\s\S]*?```|`[^`]*?`|\[.*?\]\(.*?\))/g);
  
  return parts.map(part => {
    if (part.startsWith('`') || part.startsWith('[')) return part;
    
    // Replace @handle
    let processed = part.replace(/@([a-zA-Z0-9_\-\.]*[a-zA-Z0-9_\-])/g, '[@$1](/profile/$1)');
    // Replace #tag
    processed = processed.replace(/#([a-zA-Z0-9_\-\.]*[a-zA-Z0-9_\-])/g, '[#$1](/search?q=%23$1)');
    return processed;
  }).join('');
}

export function extractTags(text: string, currentTags: string[], tagInput: string): string[] {
  let finalTags = [...currentTags];

  if (tagInput.trim()) {
    const splitTags = tagInput.split(/[\s,#]+/).map(t => t.trim()).filter(Boolean);
    finalTags = [...finalTags, ...splitTags];
  }

  // Extract hashtags from body, excluding ones inside code blocks
  const textWithoutCode = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*?`/g, '');
  const bodyTags = textWithoutCode.match(/#([a-zA-Z0-9_\-\.]*[a-zA-Z0-9_\-])/g)?.map(t => t.substring(1)) || [];
  
  finalTags = [...new Set([...finalTags, ...bodyTags])].map(t => t.toLowerCase());

  if (finalTags.length > 5) {
    finalTags = finalTags.slice(0, 5);
  }

  return finalTags;
}

export async function notifyMentions(text: string, postId: string, fromUserId: string, message: string = "mentioned you in a comment", commentId?: string) {
  // Find mentions excluding ones inside code blocks
  const textWithoutCode = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*?`/g, '');
  const mentionMatches = textWithoutCode.match(/@([a-zA-Z0-9_\-\.]*[a-zA-Z0-9_\-])/g);
  
  if (!mentionMatches || mentionMatches.length === 0) return;

  const handles = Array.from(new Set(mentionMatches.map(m => m.substring(1))));

  try {
     const { writeBatch, doc, collection, serverTimestamp } = await import("firebase/firestore");
     const batch = writeBatch(db);
     let batchCount = 0;

     // Limit to max 10 mentions to prevent massive queries/spam
     for (const handle of handles.slice(0, 10)) {
         const possibleHandles = Array.from(new Set([
             handle,
             handle.toLowerCase(),
             handle.toUpperCase(),
             handle.charAt(0).toUpperCase() + handle.slice(1).toLowerCase()
         ]));
         const q = query(collection(db, "users"), where("handle", "in", possibleHandles));
         const snapshot = await getDocs(q);
         
         if (!snapshot.empty) {
            const mentionedUser = snapshot.docs[0];
            const targetUserId = mentionedUser.id;
            
            if (targetUserId !== fromUserId) {
               const notifRef = doc(collection(db, "notifications"));
               const notifData: any = {
                  userId: targetUserId,
                  type: 'mention',
                  fromUserId: fromUserId,
                  postId: postId,
                  message: message,
                  read: false,
                  createdAt: serverTimestamp()
               };
               if (commentId) {
                  notifData.commentId = commentId;
               }
               batch.set(notifRef, notifData);
               batchCount++;
            }
         }
     }
     
     if (batchCount > 0) {
        await batch.commit();
     }
  } catch (err) {
     console.error("Failed to notify mentions", err);
  }
}
