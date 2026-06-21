import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/src/contexts/AuthContext";
import { doc, getDocs, collection, query, where, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { ArrowRight, Loader2, User, AlertCircle, X, Scale, Shield } from "lucide-react";
import { handleFirestoreError, OperationType } from "@/src/lib/firestore-errors";
import { toast } from "sonner";

import { generateSearchData } from "@/src/lib/search";

export function Onboarding() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [handle, setHandle] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<"terms" | "privacy" | null>(null);

  useEffect(() => {
    if (userProfile?.onboardingCompleted) {
       navigate("/explore");
    }
  }, [userProfile, navigate]);

  useEffect(() => {
    if (user && suggestions.length === 0) {
      const baseHandle = user.email?.split('@')[0] || `user_${user.uid.slice(0,5)}`;
      setSuggestions([
         baseHandle,
         `${baseHandle}_dev`,
         `${baseHandle}${Math.floor(Math.random() * 999)}`
      ]);
    }
  }, [user, suggestions]);

  const checkUsername = async (username: string) => {
    if (!username) return false;
    if (username.length < 3 || username.length > 20) {
       setUsernameError("Username must be between 3 and 20 characters");
       return false;
    }
    if (!/^[a-zA-Z0-9.,_\-]+$/.test(username)) {
       setUsernameError("Only letters, numbers, and .,_,- characters allowed");
       return false;
    }

    setCheckingUsername(true);
    setUsernameError("");
    try {
      const q = query(collection(db, "users"), where("handle", "==", username));
      const querySnapshot = await getDocs(q);
      
      // If it's the current user's existing handle, that's fine
      const otherUsers = querySnapshot.docs.filter(d => d.id !== user?.uid);
      
      if (otherUsers.length > 0) {
        setUsernameError("This username is already taken");
        setCheckingUsername(false);
        return false;
      }
      setCheckingUsername(false);
      return true;
    } catch (e) {
      setCheckingUsername(false);
      console.error(e);
      setUsernameError("Error checking username");
      return false;
    }
  };

  const handleNextStep = async () => {
     const isValid = await checkUsername(handle);
     if (isValid) {
        await handleComplete();
     }
  };

  const handleQuickAutoComplete = async () => {
     if (!user) return;
     setSaving(true);
     try {
        const baseHandle = handle || suggestions[0] || `user_${user.uid.slice(0, 5)}`;
        let uniqueHandle = baseHandle;
        let isUnique = false;
        let attempts = 0;
        while (!isUnique && attempts < 10) {
          const q = query(collection(db, "users"), where("handle", "==", uniqueHandle));
          const querySnapshot = await getDocs(q);
          const otherUsers = querySnapshot.docs.filter(d => d.id !== user?.uid);
          if (otherUsers.length === 0) {
            isUnique = true;
          } else {
            attempts++;
            uniqueHandle = `${baseHandle}${Math.floor(Math.random() * 9999)}`;
          }
        }
        const searchData = generateSearchData({
           authorName: user.displayName || "Anonymous Explorer",
           authorHandle: uniqueHandle,
           tags: []
        });

        const userRef = doc(db, "users", user.uid);
        const { getDoc } = await import("firebase/firestore");
        const userSnap = await getDoc(userRef);
        const docExists = userSnap.exists();

        if (docExists) {
          await updateDoc(userRef, {
            handle: uniqueHandle,
            interests: [],
            search: searchData,
            onboardingCompleted: true,
            updatedAt: serverTimestamp()
          });
        } else {
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email || 'guest@buildops.dev',
            handle: uniqueHandle,
            displayName: user.displayName || 'Anonymous Explorer',
            photoURL: user.photoURL || null,
            role: 'user',
            trustScore: 0,
            interests: [],
            search: searchData,
            onboardingCompleted: true,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp()
          });
        }
        toast.success("Profile setup completed instantly!");
     } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, "users");
        setSaving(false);
     }
  };

  const handleComplete = async () => {
     if (!user) return;
     if (!handle.trim()) {
       toast.error("Please provide a username first.");
       return;
     }
     setSaving(true);
     try {
       // Enhanced validation checking if username is taken
       const isTakenQuery = query(collection(db, "users"), where("handle", "==", handle.trim()));
       const checkSnap = await getDocs(isTakenQuery);
       const otherUsers = checkSnap.docs.filter(d => d.id !== user?.uid);
       if (otherUsers.length > 0) {
         setUsernameError("This username is already taken");
         toast.error("This username is already taken. Please pick another one.");
         setSaving(false);
         return;
       }

       const searchData = generateSearchData({
          authorName: user.displayName || "",
          authorHandle: handle,
          tags: []
       });

       const userRef = doc(db, "users", user.uid);
       const { getDoc } = await import("firebase/firestore");
       const userSnap = await getDoc(userRef);
       const docExists = userSnap.exists();

       if (docExists) {
         await updateDoc(userRef, {
           handle: handle,
           interests: [],
           search: searchData,
           onboardingCompleted: true,
           updatedAt: serverTimestamp()
         });
       } else {
         await setDoc(userRef, {
           uid: user.uid,
           email: user.email,
           handle: handle,
           displayName: user.displayName || 'Anonymous Explorer',
           photoURL: user.photoURL || null,
           role: 'user',
           trustScore: 0,
           interests: [],
           search: searchData,
           onboardingCompleted: true,
           updatedAt: serverTimestamp(),
           createdAt: serverTimestamp()
         });
       }
       toast.success("Username saved successfully!");
     } catch (e) {
       handleFirestoreError(e, OperationType.UPDATE, "users");
       setSaving(false);
     }
  };

  return (
    <div className="flex-1 flex flex-col justify-center mx-auto w-full px-4 py-8 md:py-16 max-w-sm">
      <div className="w-full border border-buildops-border bg-buildops-card p-6 md:p-8 rounded-none">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2 text-center uppercase tracking-wide font-mono">
             Pick a username
          </h1>
          <p className="text-buildops-text-secondary text-xs text-center">
             This is how other builders will see you.
          </p>
          <div className="mt-4 flex flex-col items-center gap-2">
            <button
              onClick={handleQuickAutoComplete}
              disabled={saving || !acceptedTerms || !acceptedPrivacy}
              className="text-[10px] uppercase tracking-wider font-mono font-bold text-buildops-text-secondary border border-buildops-border bg-[rgba(255,255,255,0.01)] hover:border-white hover:text-white px-3.5 py-1.5 rounded-none transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Setting up..." : "Instant Auto-Setup (1-Click)"}
            </button>
          </div>
        </div>

        <div className="space-y-6">
           <div className="space-y-3">
              <label className="text-xs font-bold text-buildops-text-secondary flex items-center gap-2 uppercase tracking-wider font-mono">
                 <User className="w-4 h-4" /> Your Username
              </label>
              <div className="relative">
                 <span className="absolute left-3 top-2.5 text-buildops-text-secondary font-mono">@</span>
                 <input
                   type="text"
                   value={handle}
                   onChange={(e) => {
                      setHandle(e.target.value.replace(/\s+/g, ""));
                      setUsernameError("");
                   }}
                   placeholder="coder123"
                   maxLength={20}
                   className="w-full bg-buildops-bg border border-buildops-border rounded-none py-2.5 pl-8 pr-4 text-buildops-text focus:border-white transition-all outline-none font-mono text-sm"
                 />
                {checkingUsername && <Loader2 className="absolute right-3 top-2.5 w-5 h-5 text-buildops-text-secondary animate-spin" />}
              </div>
              {usernameError && (
                 <p className="text-xs text-red-400 font-mono flex items-center gap-1.5"><AlertCircle className="w-4 h-4 shrink-0" /> {usernameError}</p>
              )}
           </div>

           {suggestions.length > 0 && !handle && (
             <div className="space-y-2">
                <p className="text-[10px] text-[#5c6e82] font-semibold uppercase tracking-wider font-mono">Suggestions</p>
                <div className="flex flex-wrap gap-2">
                   {suggestions.map(s => (
                      <button 
                        key={s} 
                        onClick={() => setHandle(s)}
                        className="px-3 py-1.5 rounded-none bg-buildops-bg border border-buildops-border text-xs font-mono text-buildops-text hover:border-white hover:text-white transition-colors"
                      >
                         {s}
                      </button>
                   ))}
                </div>
             </div>
           )}

           {/* Legal Checkboxes Enforcer */}
           <div className="space-y-3 pt-4 border-t border-buildops-border">
              <label className="flex items-start gap-3 cursor-pointer group">
                 <input 
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                     className="mt-0.5 rounded-none border-buildops-border bg-buildops-bg text-white focus:ring-0 cursor-pointer accent-white w-4 h-4"
                 />
                 <span className="text-xs text-buildops-text-secondary group-hover:text-buildops-text transition-colors select-none font-sans">
                    I agree to the <button type="button" onClick={() => setViewingDoc("terms")} className="text-white hover:underline font-semibold focus:outline-none">Terms & Conditions</button>
                 </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer group">
                 <input 
                    type="checkbox"
                    checked={acceptedPrivacy}
                    onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                    className="mt-0.5 rounded-none border-buildops-border bg-buildops-bg text-white focus:ring-0 cursor-pointer accent-white w-4 h-4"
                 />
                 <span className="text-xs text-buildops-text-secondary group-hover:text-buildops-text transition-colors select-none font-sans">
                    I agree to the <button type="button" onClick={() => setViewingDoc("privacy")} className="text-white hover:underline font-semibold focus:outline-none">Privacy Policy</button>
                 </span>
              </label>
           </div>

           <button 
             onClick={handleNextStep}
             disabled={!handle || checkingUsername || saving || !acceptedTerms || !acceptedPrivacy}
             className="w-full py-3.5 rounded-none bg-white text-black hover:bg-neutral-200 disabled:opacity-40 font-bold flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed mt-4 uppercase tracking-wider text-xs font-mono"
           >
             {saving ? "Completing Setup..." : "Complete Setup"} <ArrowRight className="w-4 h-4" />
            </button>
         </div>
       </div>

       {/* Inline Terms/Privacy Modal Drawer */}
       {viewingDoc && (
         <div 
           className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
           onClick={() => setViewingDoc(null)}
         >
           <div 
             className="w-full max-w-2xl bg-[#0B0F19] border border-buildops-border p-6 shadow-2xl relative flex flex-col max-h-[85vh] text-[#F4F7FB]"
             onClick={(e) => e.stopPropagation()}
           >
             <button 
               onClick={() => setViewingDoc(null)}
               className="absolute top-4 right-4 text-[#A0AEC0] hover:text-white p-1 hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
               aria-label="Close"
             >
               <X className="w-5 h-5" />
             </button>
             
             <div className="flex-1 overflow-y-auto pr-2 mt-4 scrollbar-thin scrollbar-thumb-neutral-800">
               {viewingDoc === "terms" ? <TermsContent /> : <PrivacyContent />}
             </div>

             <div className="mt-6 pt-4 border-t border-buildops-border/50 flex justify-end">
               <button 
                 onClick={() => setViewingDoc(null)}
                 className="px-6 py-2.5 bg-white text-black hover:bg-neutral-200 font-bold font-mono text-xs uppercase tracking-wider rounded-none"
               >
                 I Understand & Close
               </button>
             </div>
           </div>
         </div>
       )}
     </div>
   );
}

function TermsContent() {
  return (
    <div className="space-y-6 text-[#E2E8F0] font-sans leading-relaxed text-[14px]">
      <div className="flex items-center gap-3 text-[#A0AEC0] border-b border-[#21283B] pb-4 mb-4">
        <Scale className="w-5 h-5 text-[#A0AEC0]" />
        <div>
          <span className="text-xs uppercase tracking-widest font-mono block text-[#A0AEC0]">Terms of Service</span>
          <h2 className="text-xl font-bold text-white font-sans mt-0.5">Terms & Conditions</h2>
        </div>
      </div>
      <p className="text-[#A0AEC0] text-sm leading-relaxed">
        Welcome to PROPLE. By creating an account, selecting a unique username, and accessing our global feed platform, you represent that you have read, understood, and agreed to be legally bound by these terms. 
      </p>

      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-white tracking-tight border-b border-[#21283B] pb-1">
            1. Account Creation and Username
          </h3>
          <p className="text-[#CBD5E0]">
            To use the platform services, you must go through the registration process and select a unique handle. 
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[#CBD5E0] text-xs">
            <li>You are solely responsible for protecting your account credentials and monitoring access to your personal timeline and database state.</li>
            <li>You must select usernames that comply with our Community Guidelines (no offensive jargon, no impersonation of other developers, no trademark violations).</li>
            <li>Our administration reserves the right to reclaim, update, or suspend usernames that infringe on established commercial marks, trademarks, or public names.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-white tracking-tight border-b border-[#21283B] pb-1">
            2. User Content & Intellectual Property
          </h3>
          <p className="text-[#CBD5E0]">
            PROPLE operates as a shared community platform. You retain full ownership, copyrights, and intellectual rights associated with the project posts, reviews, updates, and solutions you submit.
          </p>
          <p className="text-[#CBD5E0]">
            However, by submitting text, code snippets, or showcase links on our application channels, you grant PROPLE a worldwide, non-exclusive, royalty-free, perpetual license to distribute, render, format, and display your publications across feed interfaces.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-white tracking-tight border-b border-[#21283B] pb-1">
            3. Prohibited platform Activities
          </h3>
          <p className="text-[#CBD5E0]">
            Users must preserve a constructive, safe, and comfortable community environment. Doing any of the following of these statements is grounds for service termination or account block:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[#CBD5E0] text-xs">
            <li>Spamming repetitive feed updates, bulk automated comments, or unrelated advertisements.</li>
            <li>Falsifying identification states or impersonating individual organization entities.</li>
            <li>Injecting malignant scripting code, executable security threats, or exploiting application architecture flaws.</li>
            <li>Harassing or verbally offending other developers and members of the community.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-white tracking-tight border-b border-[#21283B] pb-1">
            4. Disclaimer of Warranties
          </h3>
          <p className="italic text-xs text-[#A0AEC0]">
            Our web services are provided on an "as-is" and "as-available" basis without any express or implied guarantees. PROPLE makes no claims that community publications, uploaded media, or general posts are flawless, accurate, current, or continuously safe to access.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-white tracking-tight border-b border-[#21283B] pb-1">
            5. Limit of Liability
          </h3>
          <p className="text-[#CBD5E0]">
            In no event shall PROPLE, its administrators, or service infrastructure nodes be liable for database disruptions, missing data files, loss of account access, or financial discrepancies resulting from platform usage, project showcase downloads, or interactions with community content.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-white tracking-tight border-b border-[#21283B] pb-1">
            6. Terms Improvements & Termination
          </h3>
          <p className="text-[#CBD5E0]">
            We may edit or adjust these terms to represent regulatory improvements or platform revisions. If you do not accept future iterations of these conditions, you must immediately terminate platform activity and delete your account.
          </p>
        </section>
      </div>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="space-y-6 text-[#E2E8F0] font-sans leading-relaxed text-[14px]">
      <div className="flex items-center gap-3 text-[#A0AEC0] border-b border-[#21283B]/50 pb-4 mb-4">
        <Shield className="w-5 h-5 text-[#A0AEC0]" />
        <div>
          <span className="text-xs uppercase tracking-widest font-mono block text-[#A0AEC0]">Privacy & Safety</span>
          <h2 className="text-xl font-bold text-white font-sans mt-0.5">Privacy Policy</h2>
        </div>
      </div>
      <p className="text-[#A0AEC0] text-sm leading-relaxed">
        PROPLE is committed to protecting your privacy. This Privacy Policy describes how we collect, use, process, store, and share your information when you access our platform, use our communication channels, and publish showcases, ideas, and updates within our cozy community.
      </p>

      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-white tracking-tight border-b border-[#21283B]/50 pb-1">
            1. Information We Collect
          </h3>
          <p className="text-[#CBD5E0]">
            We collect information to provide efficient, comfortable, and responsive community interactions.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[#CBD5E0] text-xs">
            <li>
              <strong>Account Credentials:</strong> We log standard identity data including email addresses, unique display handles, public profile pictures, and registration time from secure third-party auth engines.
            </li>
            <li>
              <strong>User Content & Posts:</strong> All text posts, showcase files, comments, replies, saves, likes, and profile settings are recorded as part of your persistent account node on our decentralized database.
            </li>
            <li>
              <strong>Platform Logs & Metadata:</strong> When you browse or interact, we analyze anonymous diagnostics to improve layout scaling and performance routing.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-white tracking-tight border-b border-[#21283B]/50 pb-1">
            2. How We Utilize Collected Data
          </h3>
          <p className="text-[#CBD5E0]">
            We use your database records of account data, settings preferences, and content items exclusively to:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[#CBD5E0] text-xs">
            <li>Render dynamic main timelines, problem queries, custom feedback lists, and notifications.</li>
            <li>Filter repetitive spam or low-quality threads based on your chosen Settings configuration.</li>
            <li>Coordinate account security, preventing unauthorized profile edits.</li>
            <li>Provide personalized active states and online indication based on your opt-in privacy toggles.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-white tracking-tight border-b border-[#21283B]/50 pb-1">
            3. Storage, Database Resilience & Lifespan
          </h3>
          <p className="text-[#CBD5E0]">
            All customer preferences, database collections, and configuration elements are securely stored using redundant Firestore storage instances in secure server zones. We retain your public profiles, followers, activities, and structural comments for as long as your account exists on the platform.
          </p>
          <p className="text-[#CBD5E0]">
            You can modify or request deletions of your personal data inside your public Account profile or settings management console at any moment.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-white tracking-tight border-b border-[#21283B]/50 pb-1">
            4. Sharing Data & Privacy Controls
          </h3>
          <p className="text-[#CBD5E0]">
            We do not sell, distribute, rent, or lease your private credential lists or user identities to advertisements companies or third-party analytical brokers. Your content contributions are public by nature as structured social feed items which can be accessed by index algorithms depending on your specific profile visibility toggle.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-white tracking-tight border-b border-[#21283B]/50 pb-1">
            5. Amendments to Policy guidelines
          </h3>
          <p className="text-[#CBD5E0]">
            We may dynamically update this Privacy Policy as platform structures expand. New updates are announced transparently under the System Guidance console on our profile dashboard. Keeping your application account active represents approval of active revisions.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-white tracking-tight border-b border-[#21283B]/50 pb-1">
            6. Get In Touch
          </h3>
          <p className="text-[#CBD5E0]">
            For legal inquiries regarding data removal requests, structural database storage clarification, or privacy feedback, please reach out to our administration at <span className="text-white underline font-mono text-xs">support@prople.media</span>.
          </p>
        </section>
      </div>
    </div>
  );
}
