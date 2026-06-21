import React, { useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';

interface CodeEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  height?: string;
  draftKey?: string;
}

export function CodeEditor({ value, onChange, placeholder, height = "150px", draftKey }: CodeEditorProps) {
  const [saveStatus, setSaveStatus] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  // Load draft on mount
  useEffect(() => {
    if (draftKey) {
      const saved = localStorage.getItem(draftKey);
      if (saved && saved !== value) {
        onChange(saved);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // Auto save draft explicitly
  useEffect(() => {
    if (draftKey && value) {
      const timeoutId = setTimeout(() => {
        localStorage.setItem(draftKey, value);
        setSaveStatus('Draft saved');
        setTimeout(() => setSaveStatus(''), 2000);
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [value, draftKey]);

  return (
    <div className="rounded-lg border border-buildops-border bg-[#1e1e1e] overflow-hidden flex flex-col focus-within:ring-1 focus-within:ring-buildops-blue transition-all">
      <div className="px-4 py-2 flex items-center justify-between bg-buildops-card border-b border-buildops-border">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-buildops-text-secondary/60">Compose</span>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus && (
            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1 bg-emerald-400/10 px-2 py-0.5 rounded">
              <Check className="w-3 h-3" /> {saveStatus}
            </span>
          )}
        </div>
      </div>
      <div className="relative flex-1 flex">
        <textarea
          ref={textareaRef}
          style={{ minHeight: height, maxHeight: '40vh' }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-full bg-transparent text-buildops-text p-4 font-mono text-sm resize-none focus:outline-none placeholder:text-buildops-text-secondary/50 overflow-y-auto"
        />
      </div>
    </div>
  );
}