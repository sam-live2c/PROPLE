import { Link } from 'react-router-dom';
import React from 'react';

export function renderTextWithMentions(text: string, useMarkdown: boolean = true) {
  if (!text) return null;
  
  // Split by code blocks, inline code, URLs, @handles, and #tags
  const parts = text.split(/(```[\s\S]*?```|`[^`]*?`|https?:\/\/[^\s]+|@[a-zA-Z0-9_\-\.]*[a-zA-Z0-9_\-]|#[a-zA-Z0-9_\-\.]*[a-zA-Z0-9_\-])/g);

  return parts.map((part, i) => {
    if (!part) return null;
    
    if (useMarkdown && part.startsWith('```')) {
       // Multi-line code block
       const codeContent = part.replace(/^```(\w+)?\n?|```$/g, '');
       return (
         <pre key={i} className="bg-buildops-bg p-3 rounded-lg overflow-x-auto text-sm my-2 border border-buildops-border">
           <code className="font-mono text-buildops-text/90 whitespace-pre text-sm">
             {codeContent}
           </code>
         </pre>
       );
    }
    if (useMarkdown && part.startsWith('`') && !part.startsWith('```')) {
      return (
        <code key={i} className="font-mono bg-buildops-bg px-1.5 py-0.5 rounded text-sm text-buildops-text/90 border border-buildops-border whitespace-pre-wrap">
          {part.replace(/`/g, '')}
        </code>
      );
    }
    if (part.match(/^https?:\/\//)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-buildops-blue hover:underline break-all" onClick={e => e.stopPropagation()}>
          {part}
        </a>
      );
    }
    if (part.startsWith('@')) {
      const handle = part.substring(1);
      return <Link key={i} to={`/profile/${handle}`} onClick={e => e.stopPropagation()} className="font-semibold text-buildops-blue hover:underline bg-buildops-blue/10 px-1 py-0.5 mx-0.5 rounded transition-colors inline-block">{part}</Link>;
    }
    if (part.startsWith('#')) {
      const tag = part.substring(1);
      return <Link key={i} to={`/search?q=%23${tag}`} onClick={e => e.stopPropagation()} className="font-semibold text-buildops-blue hover:underline bg-buildops-blue/10 px-1 py-0.5 mx-0.5 rounded transition-colors inline-block">{part}</Link>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}
