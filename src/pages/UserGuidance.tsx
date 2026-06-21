import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, HelpCircle } from "lucide-react";

export function UserGuidance() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#11141B] text-[#F4F7FB] selection:bg-white selection:text-black">
      {/* Top Header-styled Back bar */}
      <div className="sticky top-0 z-50 w-full h-14 border-b border-[rgba(255,255,255,0.05)] bg-[rgba(5,8,15,0.92)] backdrop-blur-xl flex items-center pr-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-6 h-full text-base font-semibold text-[#A0AEC0] hover:text-white hover:bg-[rgba(255,255,255,0.03)] transition-all focus:outline-none"
          id="back-btn-guidance"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        {/* Title Block */}
        <div className="border-b border-[#2D3748] pb-8 mb-10">
          <div className="flex items-center gap-3 text-[#A0AEC0] mb-3">
            <HelpCircle className="w-5 h-5 text-[#A0AEC0]" />
            <span className="text-xs uppercase tracking-widest font-mono">Platform Documentation</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white font-sans">
            User Guidance Manual
          </h1>
          <p className="text-sm text-[#A0AEC0] mt-2 font-mono">
            How to navigate, share, and personalize PROPLE
          </p>
        </div>

        {/* Legal Text Content Body */}
        <div className="space-y-8 text-[#E2E8F0] font-sans leading-relaxed text-[15px]">
          <p className="text-[#A0AEC0] text-base leading-relaxed">
            Welcome to PROPLE. This guidance handbook provides an overview of available features, custom user preferences, navigation loops, and feed tools to help you get started as comfortably as possible.
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white tracking-tight border-b border-[#2D3748]/50 pb-2">
              1. Customizing Your Home Timeline
            </h2>
            <p>
              Your home feed display is fully controlled by your personal preference settings. Inside the "Content & Feed Preferences" drawer matching your active profile, you can utilize the following toggles:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-[#CBD5E0]">
              <li>
                <strong>Home Feed Filter:</strong> Restricts spam and unvetted content automatically for a comfortable reading stream.
              </li>
              <li>
                <strong>Show Cozy Thoughts:</strong> Option to display personal casual thoughts, discussions, and text updates from authors you follow alongside technical project uploads.
              </li>
              <li>
                <strong>Favorite Topics:</strong> Target custom areas of interest such as AI, Cybersecurity, DevOps, and more to ensure those posts appear on top.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white tracking-tight border-b border-[#2D3748]/50 pb-2">
              2. Publishing Project Showcases and Thoughts
            </h2>
            <p>
              Every registered developer can contribute two main categories of content on the platform:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-[#CBD5E0]">
              <li>
                <strong>Project Showcases (Builds):</strong> High-fidelity submissions documenting your built solutions, live web deployments, and systems designs. 
              </li>
              <li>
                <strong>Thoughts (Micro-posts):</strong> Quick, conversational messages, thoughts, updates, and community questions regarding ongoing ideas.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white tracking-tight border-b border-[#2D3748]/50 pb-2">
              3. Privacy and Status settings
            </h2>
            <p>
              Under your Settings and Safety tab, you can enable or disable Search Index features, configure direct messaging rights, and hide or display your live active status indicators to ensure a private browsing experience.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white tracking-tight border-b border-[#2D3748]/50 pb-2">
              4. Community Etiquette rules
            </h2>
            <p>
              We strive to keep this space respectful, warm, and highly constructive. Please avoid uploading uncredited intellectual properties, posting off-topic spam, or engaging in aggressive public debates. You can utilize the reporting trigger inside any post's dropdown menu to flag violations to moderators.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
