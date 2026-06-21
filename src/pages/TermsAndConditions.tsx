import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Scale } from "lucide-react";

export function TermsAndConditions() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#11141B] text-[#F4F7FB] selection:bg-white selection:text-black">
      {/* Top Header-styled Back bar */}
      <div className="sticky top-0 z-50 w-full h-14 border-b border-[rgba(255,255,255,0.05)] bg-[rgba(5,8,15,0.92)] backdrop-blur-xl flex items-center pr-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-6 h-full text-base font-semibold text-[#A0AEC0] hover:text-white hover:bg-[rgba(255,255,255,0.03)] transition-all focus:outline-none"
          id="back-btn-terms"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        {/* Title Block */}
        <div className="border-b border-[#2D3748] pb-8 mb-10">
          <div className="flex items-center gap-3 text-[#A0AEC0] mb-3">
            <Scale className="w-5 h-5 text-[#A0AEC0]" />
            <span className="text-xs uppercase tracking-widest font-mono">Terms of Service</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white font-sans">
            Terms & Conditions
          </h1>
          <p className="text-sm text-[#A0AEC0] mt-2 font-mono">
            Last Updated: June 21, 2026
          </p>
        </div>

        {/* Legal Text Content Body */}
        <div className="space-y-8 text-[#E2E8F0] font-sans leading-relaxed text-[15px]">
          <p className="text-[#A0AEC0] text-base leading-relaxed">
            Welcome to PROPLE. By creating an account, selecting a unique username, and accessing our global feed platform, you represent that you have read, understood, and agreed to be legally bound by these terms. 
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white tracking-tight border-b border-[#2D3748]/50 pb-2">
              1. Account Creation and Username
            </h2>
            <p>
              To use the platform services, you must go through the registration process and select a unique handle. 
            </p>
            <ul className="list-disc pl-6 space-y-2 text-[#CBD5E0]">
              <li>You are solely responsible for protecting your account credentials and monitoring access to your personal timeline and database state.</li>
              <li>You must select usernames that comply with our Community Guidelines (no offensive jargon, no impersonation of other developers, no trademark violations).</li>
              <li>Our administration reserves the right to reclaim, update, or suspend usernames that infringe on established commercial marks, trademarks, or public names.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white tracking-tight border-b border-[#2D3748]/50 pb-2">
              2. User Content & Intellectual Property
            </h2>
            <p>
              PROPLE operates as a shared community platform. You retain full ownership, copyrights, and intellectual rights associated with the project posts, reviews, updates, and solutions you submit.
            </p>
            <p>
              However, by submitting text, code snippets, or showcase links on our application channels, you grant PROPLE a worldwide, non-exclusive, royalty-free, perpetual license to distribute, render, format, and display your publications across feed interfaces.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white tracking-tight border-b border-[#2D3748]/50 pb-2">
              3. Prohibited platform Activities
            </h2>
            <p>
              Users must preserve a constructive, safe, and comfortable community environment. Doing any of the following of these statements is grounds for service termination or account block:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-[#CBD5E0]">
              <li>Spamming repetitive feed updates, bulk automated comments, or unrelated advertisements.</li>
              <li>Falsifying identification states or impersonating individual organization entities.</li>
              <li>Injecting malignant scripting code, executable security threats, or exploiting application architecture flaws.</li>
              <li>Harassing or verbally offending other developers and members of the community.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white tracking-tight border-b border-[#2D3748]/50 pb-2">
              4. Disclaimer of Warranties
            </h2>
            <p className="italic">
              Our web services are provided on an "as-is" and "as-available" basis without any express or implied guarantees. PROPLE makes no claims that community publications, uploaded media, or general posts are flawless, accurate, current, or continuously safe to access.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white tracking-tight border-b border-[#2D3748]/50 pb-2">
              5. Limit of Liability
            </h2>
            <p>
              In no event shall PROPLE, its administrators, or service infrastructure nodes be liable for database disruptions, missing data files, loss of account access, or financial discrepancies resulting from platform usage, project showcase downloads, or interactions with community content.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white tracking-tight border-b border-[#2D3748]/50 pb-2">
              6. Terms Improvements & Termination
            </h2>
            <p>
              We may edit or adjust these terms to represent regulatory improvements or platform revisions. If you do not accept future iterations of these conditions, you must immediately terminate platform activity and delete your account.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
