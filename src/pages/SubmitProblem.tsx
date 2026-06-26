import { LinkIcon, Plus, Terminal, ChevronDown, ArrowLeft, Users, Heart, MessageSquare, Shield, Globe, Search, MoreVertical, Trash2, Save, Info } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import { cn } from "@/src/lib/utils";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { handleFirestoreError, OperationType } from "@/src/lib/firestore-errors";
import { toast } from "sonner";

import { generateSearchData } from "@/src/lib/search";

import { extractTags, notifyMentions } from "@/src/lib/mentions";
import { useConfirmNavigation } from "@/src/hooks/useConfirmNavigation";
import { ConfirmNavigationDialog } from "@/src/components/ConfirmNavigationDialog";
import { useSettings } from "@/src/contexts/SettingsContext";
import { syncPostToRtdb } from "@/src/lib/rtdb-sync";

export function SubmitProblem() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [category, setCategory] = useState("none");
  const [loading, setLoading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // Guest & Logged Out restriction to prevent posting
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        toast.error("Please sign in to create posts.");
        navigate("/explore");
      } else if (user.isAnonymous) {
        toast.error("Guest users cannot create posts.");
        navigate("/explore");
      }
    }
  }, [user, authLoading, navigate]);

  // Auto resize the text input area
  useEffect(() => {
    if (descriptionRef.current) {
      descriptionRef.current.style.height = "auto";
      descriptionRef.current.style.height = `${Math.max(160, descriptionRef.current.scrollHeight)}px`;
    }
  }, [description]);

  // Load draft on mount
  useEffect(() => {
    const saved = localStorage.getItem('submit_problem_draft_full');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.description) setDescription(parsed.description);
        if (parsed.tags) setTags(parsed.tags);
        if (parsed.tagInput) setTagInput(parsed.tagInput);

      } catch (e) {
        console.error("Failed to parse draft", e);
      }
    }
  }, []);

  const isDirty = title.trim() !== "" || description.trim() !== "" || tags.length > 0 || tagInput.trim() !== "";
  const blocker = useConfirmNavigation(isDirty && !loading);


  
  const submitPost = async () => {
    if (!user || user.isAnonymous) {
      toast.error("Guest users cannot create posts.");
      return;
    }
    if (!title.trim()) return;
    setLoading(true);
    
    try {
      const finalTags = extractTags(description, tags, tagInput);
      
      const postRef = doc(collection(db, "posts")); // Auto-generate ID
      
      const searchData = generateSearchData({
        title: title.trim(),
        body: description.trim(),
        tags: finalTags,
        authorName: user.displayName || "",
        authorHandle: user.displayName ? user.displayName.toLowerCase().replace(/\s+/g, '') : ""
      });

      const payload: any = {
        title: title.trim(),
        body: description.trim(),
        authorId: user.uid,
        type: "problem",
        status: "open", // Default to open
        search: searchData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        stats: {
          likesCount: 0,
          dislikesCount: 0,
          commentsCount: 0,
          viewsCount: 0,
          sharesCount: 0,
          savesCount: 0
        },
        ranking: {
          feedScore: 0,
          searchScore: 50
        }
      };

      if (finalTags && finalTags.length > 0) {
          payload.tags = finalTags;
      }



      await setDoc(postRef, payload);
      
      // Sync to Realtime Database
      await syncPostToRtdb(postRef.id, payload);
      
      await notifyMentions(`${title.trim()}\n\n${description.trim()}`, postRef.id, user.uid, "mentioned you in a post");
      
      localStorage.removeItem('submit_problem_draft_full');
      navigate(`/problems/${postRef.id}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'posts');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto pb-12 flex flex-col md:flex-row gap-8 relative">
      {/* Main Post Column */}
      <div className="flex-1 min-w-0">
        <div className="sticky top-0 z-40 bg-buildops-bg/95 backdrop-blur-md h-14 mb-6 border-b border-[rgba(255,255,255,0.05)] flex items-center justify-between px-4 sm:px-0">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-buildops-text-secondary hover:text-white transition-colors cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-mono font-bold text-buildops-text">post</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/search" className="p-2 rounded-full text-buildops-text-secondary hover:text-buildops-text hover:bg-white/5 transition-colors flex items-center justify-center">
              <Search className="w-5 h-5" />
            </Link>
            <div className="relative">
              <button 
                type="button" 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-full text-buildops-text-secondary hover:text-buildops-text hover:bg-white/5 transition-colors flex items-center justify-center cursor-pointer"
                title="Options"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {isMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-[55]" 
                    onClick={() => setIsMenuOpen(false)} 
                  />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-buildops-card border border-buildops-border rounded-xl shadow-xl z-[60] py-1.5 text-left font-sans animate-fade-in">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        localStorage.setItem('submit_problem_draft_full', JSON.stringify({ title, description, tags, tagInput }));
                        toast.success("Draft saved successfully!");
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-buildops-text hover:bg-white/5 transition-colors flex items-center gap-2.5 cursor-pointer border-x-0 border-t-0 border-b border-buildops-border/20 bg-transparent font-medium"
                    >
                      <Save className="w-4 h-4 text-buildops-text-secondary" />
                      Save Draft
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setTitle("");
                        setDescription("");
                        setTags([]);
                        setTagInput("");
                        localStorage.removeItem('submit_problem_draft_full');
                        toast.info("Form cleared completely.");
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-buildops-text hover:bg-white/5 transition-colors flex items-center gap-2.5 cursor-pointer border-0 bg-transparent font-medium"
                    >
                      <Trash2 className="w-4 h-4 text-buildops-text-secondary" />
                      Clear Form
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        toast.info("Tip: Mention other builders using @username and categorize posts with #tags.", {
                          duration: 5500
                        });
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-buildops-text hover:bg-white/5 transition-colors flex items-center gap-2.5 cursor-pointer border-x-0 border-b-0 border-t border-buildops-border/20 bg-transparent font-medium"
                    >
                      <Info className="w-4 h-4 text-buildops-text-secondary" />
                      Writing Tips
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            {/* Title Input */}
            <div className="group relative">
              <input 
                type="text" 
                maxLength={300}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent border-b border-buildops-border py-4 text-xl font-medium text-buildops-text placeholder:text-buildops-text-secondary/50 focus:outline-none focus:border-buildops-blue transition-colors rounded-none" 
                placeholder="What's on your mind? Share an update..." 
              />
              <div className="absolute right-0 -top-1 text-xs font-mono text-buildops-text-secondary/40 opacity-0 group-focus-within:opacity-100 transition-opacity">
                {title.length}/300
              </div>
            </div>

            {/* Text Input Section */}
            <div className="rounded-lg border border-buildops-border bg-buildops-card focus-within:border-buildops-blue/60 focus-within:ring-1 focus-within:ring-buildops-blue/20 transition-all overflow-hidden shadow-sm">
              <textarea
                ref={descriptionRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What details or updates would you like to share? Write your post here... Mention builders with @username and use #tags."
                className="w-full bg-transparent text-buildops-text p-4 font-sans text-base sm:text-lg resize-none focus:outline-none placeholder:text-buildops-text-secondary/40 min-h-[160px] leading-relaxed"
              />
            </div>

            {/* Metadata Inputs */}
            <div>
              <div className="space-y-2 mb-6">
                <label className="text-xs font-mono text-buildops-text-secondary ml-1">tags ({tags.length}/5)</label>
                <div className="flex font-mono flex-wrap gap-2 items-center min-h-[46px] rounded bg-buildops-card border border-buildops-border p-2 focus-within:border-buildops-blue transition-colors cursor-text" onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target === e.currentTarget) {
                     const input = e.currentTarget.querySelector('input');
                     if (input) input.focus();
                  }
                }}>
                  {tags.map((tag, index) => (
                    <span key={index} className="flex items-center gap-1 bg-buildops-bg border border-buildops-border px-2 py-1 rounded text-sm text-buildops-text">
                      {tag}
                      <button 
                        type="button" 
                        onClick={() => setTags(tags.filter((_, i) => i !== index))}
                        className="text-buildops-text-secondary hover:text-buildops-text ml-1 focus:outline-none"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                  <input 
                    type="text" 
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const newTag = tagInput.trim().toLowerCase();
                        if (newTag) {
                          if (tags.includes(newTag)) {
                            setTagInput('');
                            return;
                          }
                          if (tags.length >= 5) {
                            toast.error("You can add a maximum of 5 tags.");
                            return;
                          }
                          setTags([...tags, newTag]);
                          setTagInput('');
                        }
                      } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
                        setTags(tags.slice(0, -1));
                      }
                    }}
                    className="flex-1 min-w-[120px] bg-transparent border-none py-1 px-1 text-sm text-buildops-text focus:outline-none placeholder:text-buildops-text-secondary/40" 
                    placeholder={tags.length === 0 ? "Type and press enter e.g. tech, thought, design (max 5)" : tags.length >= 5 ? "Max tags reached" : ""} 
                    disabled={tags.length >= 5}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center sm:justify-between pt-6 border-t border-buildops-border gap-4 min-w-0">
            <div className="flex-1" />
            <div className="flex gap-2 sm:gap-3 shrink-0 w-full sm:w-auto justify-stretch sm:justify-end">
              <button 
                type="button" 
                className="flex-1 sm:flex-none px-4 sm:px-5 py-2 rounded text-sm font-mono font-medium text-buildops-text-secondary hover:text-buildops-text hover:bg-buildops-card transition-colors text-center"
                onClick={() => navigate("/")}
              >
                cancel
              </button>
              <button 
                type="button" 
                onClick={submitPost}
                disabled={!title.trim() || !user || loading}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded bg-buildops-blue text-sm font-mono font-bold text-white hover:bg-buildops-blue/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(37,99,235,0.2)] text-center"
              >
                {loading ? "posting..." : "post"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-full md:w-72 shrink-0 pt-8 md:pt-[80px]">
         <div className="bg-buildops-card/50 p-5 rounded-lg border border-buildops-border space-y-4 shadow-sm font-mono text-sm">
            <div className="flex items-center gap-2 mb-4 text-buildops-text">
               <Users className="w-4 h-4 text-buildops-blue" />
               <span className="font-bold">social rules</span>
            </div>
            <ul className="space-y-3 text-buildops-text-secondary/80 animate-fade-in">
               <li className="flex gap-2.5 items-start">
                 <Heart className="w-4 h-4 text-buildops-blue shrink-0 mt-0.5" /> 
                 <span>Be respectful, positive, and constructive in all social interactions.</span>
               </li>
               <li className="flex gap-2.5 items-start">
                 <MessageSquare className="w-4 h-4 text-buildops-blue shrink-0 mt-0.5" /> 
                 <span>Share authentic updates, thoughts, and connect with other builders.</span>
               </li>
               <li className="flex gap-2.5 items-start">
                 <Shield className="w-4 h-4 text-buildops-blue shrink-0 mt-0.5" /> 
                 <span>Keep feed clean—no spam, hate speech, or harassment.</span>
               </li>
               <li className="flex gap-2.5 items-start">
                 <Globe className="w-4 h-4 text-buildops-blue shrink-0 mt-0.5" /> 
                 <span>Protect personal privacy and make this a safe space for everyone.</span>
               </li>
            </ul>
         </div>
      </div>

      <ConfirmNavigationDialog
        isOpen={blocker.state === 'blocked'}
        title="Discard changes?"
        description="You have unsaved edits."
        primaryActionText="Save Draft"
        secondaryActionText="Discard"
        onPrimaryAction={() => {
          localStorage.setItem('submit_problem_draft_full', JSON.stringify({
             title, description, tags, tagInput, category
          }));
          blocker.proceed?.();
        }}
        onSecondaryAction={() => {
          localStorage.removeItem('submit_problem_draft_full');
          blocker.proceed?.();
        }}
        onDismiss={() => blocker.reset?.()}
      />
    </div>
  );
}
