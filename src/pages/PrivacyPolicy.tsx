import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";

export function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#11141B] text-[#F4F7FB] selection:bg-white selection:text-black">
      {/* Top Header-styled Back bar */}
      <div className="sticky top-0 z-50 w-full h-14 border-b border-[rgba(255,255,255,0.05)] bg-[rgba(5,8,15,0.92)] backdrop-blur-xl flex items-center pr-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-6 h-full text-base font-semibold text-[#A0AEC0] hover:text-white hover:bg-[rgba(255,255,255,0.03)] transition-all focus:outline-none"
          id="back-btn-privacy"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        {/* Title Block */}
        <div className="border-b border-[#2D3748] pb-8 mb-10">
          <div className="flex items-center gap-3 text-[#A0AEC0] mb-3">
            <Shield className="w-5 h-5 text-[#A0AEC0]" />
            <span className="text-xs uppercase tracking-widest font-mono">Legal & Compliance</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white font-sans">
            Privacy Policy
          </h1>
          <p className="text-sm text-[#A0AEC0] mt-2 font-mono">
            Last Updated: June 21, 2026
          </p>
        </div>

        {/* Legal Text Content Body */}
        <div className="space-y-8 text-[#E2E8F0] font-sans leading-relaxed text-[15px]">
          <p className="text-[#A0AEC0] text-base leading-relaxed">
            PROPLE is committed to protecting your privacy. This Privacy Policy describes how we collect, use, process, store, and share your information when you access our platform, use our communication channels, and publish showcases, ideas, and updates within our cozy community.
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white tracking-tight border-b border-[#2D3748]/50 pb-2">
              1. Information We Collect
            </h2>
            <p>
              We collect information to provide efficient, comfortable, and responsive community interactions.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-[#CBD5E0]">
              <li>
                <strong>Account Credentials:</strong> We log standard identity data including email addresses, unique display handles, public profile pictures, and registration time from secure third-party auth engines.
              </li>
              <li>
                <strong>User Content & Posts:</strong> All text posts, showcase files, comments, replies, saves, likes, and profile settings are recorded as part of your persistent account node on our decentralized database.
              </li>
              <li>
                <strong>Platform Log Logs & Metadata:</strong> When you browse or interact, we analyze anonymous diagnostics (e.g. active durations on sections) to improve layout scaling and performance routing.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white tracking-tight border-b border-[#2D3748]/50 pb-2">
              2. How We Utilize Collected Data
            </h2>
            <p>
              We use your database records of account data, settings preferences, and content items exclusively to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-[#CBD5E0]">
              <li>Render dynamic main timelines, problem queries, custom feedback lists, and notifications.</li>
              <li>Filter repetitive spam or low-quality threads based on your chosen Settings configuration.</li>
              <li>Coordinate account security, preventing unauthorized profile edits.</li>
              <li>Provide personalized active states and online indication based on your opt-in privacy toggles.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white tracking-tight border-b border-[#2D3748]/50 pb-2">
              3. Storage, Database Resilience & Lifespan
            </h2>
            <p>
              All customer preferences, database collections, and configuration elements are securely stored using redundant Firestore storage instances in secure server zones. We retain your public profiles, followers, activities, and structural comments for as long as your account exists on the platform.
            </p>
            <p>
              You can modify or request deletions of your personal data inside your public Account profile or settings management console at any moment.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white tracking-tight border-b border-[#2D3748]/50 pb-2">
              4. Sharing Data & Privacy Controls
            </h2>
            <p>
              We do not sell, distribute, rent, or lease your private credential lists or user identities to advertisements companies or third-party analytical brokers. Your content contributions are public by nature as structured social feed items which can be accessed by index algorithms depending on your specific profile visibility toggle.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white tracking-tight border-b border-[#2D3748]/50 pb-2">
              5. Amendments to Policy guidelines
            </h2>
            <p>
              We may dynamically update this Privacy Policy as platform structures expand. New updates are announced transparently under the System Guidance console on our profile dashboard. Keeping your application account active represents approval of active revisions.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white tracking-tight border-b border-[#2D3748]/50 pb-2">
              6. Get In Touch
            </h2>
            <p>
              For legal inquiries regarding data removal requests, structural database storage clarification, or privacy feedback, please reach out to our administration at <span className="text-white underline font-mono text-[14px]">support@prople.media</span>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
