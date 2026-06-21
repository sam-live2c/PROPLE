const fs = require('fs');
let content = fs.readFileSync('src/pages/Search.tsx', 'utf-8');

const target = `                 <div className="flex flex-col py-2">
                   {unifiedSuggestions.map((sug, idx) => (
                      <div key={\`m-sug-\${idx}\`} onClick={() => { navigate(\`/search?q=\${encodeURIComponent(sug.text)}\`); }} className="flex items-center gap-4 px-4 py-3 active:bg-buildops-card transition-colors cursor-pointer group">
                         {sug.isHistory ? (
                            <Clock className="w-5 h-5 text-buildops-text-secondary shrink-0" />
                         ) : (
                            <SearchIcon className="w-5 h-5 text-buildops-text-secondary shrink-0" />
                         )}
                         <span className="flex-1 text-buildops-text text-[15px] font-medium line-clamp-1 break-all">{sug.text}</span>
                         <button onClick={(e) => { e.stopPropagation(); setSearchInput(sug.text); }} className="p-1 -mr-1 text-buildops-text-secondary">
                           <ArrowUp className="w-5 h-5 -rotate-45 shrink-0" />
                         </button>
                      </div>
                   ))}
                </div>`;

const replace = `                 <div className="flex flex-col py-2">
                   {unifiedSuggestions.map((sug, idx) => {
                     if (sug.type === 'user') {
                       const u = sug.user;
                       return (
                         <div key={\`m-sug-user-\${idx}\`} onClick={() => { navigate(\`/profile/\${u.id}\`); }} className="flex items-center gap-3 px-4 py-3 active:bg-buildops-card transition-colors cursor-pointer">
                            <div className="w-8 h-8 rounded-full border border-buildops-border bg-buildops-bg overflow-hidden flex items-center justify-center shrink-0">
                               {u.photoURL ? (
                                 <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" />
                               ) : (
                                 <User className="w-4 h-4 text-buildops-text-secondary" />
                               )}
                            </div>
                            <div className="flex flex-col flex-1 min-w-0">
                               <span className="text-buildops-text text-[15px] line-clamp-1 font-medium">{u.displayName}</span>
                               {u.username && <span className="text-sm text-buildops-text-secondary line-clamp-1">@{u.username}</span>}
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setSearchInput(u.displayName || u.username || ''); }} className="p-4 -mr-4 text-buildops-text-secondary">
                               <ArrowUp className="w-5 h-5 -rotate-45 shrink-0" />
                            </button>
                         </div>
                       );
                     }
                     return (
                        <div key={\`m-sug-\${idx}\`} onClick={() => { navigate(\`/search?q=\${encodeURIComponent(sug.text)}\`); }} className="flex items-center gap-4 px-4 py-3 active:bg-buildops-card transition-colors cursor-pointer group">
                           {sug.isHistory ? (
                              <Clock className="w-5 h-5 text-buildops-text-secondary shrink-0" />
                           ) : (
                              <SearchIcon className="w-5 h-5 text-buildops-text-secondary shrink-0" />
                           )}
                           <span className="flex-1 text-buildops-text text-[15px] font-medium line-clamp-1 break-all">{sug.text}</span>
                           <button onClick={(e) => { e.stopPropagation(); setSearchInput(sug.text); }} className="p-4 -mr-4 text-buildops-text-secondary">
                             <ArrowUp className="w-5 h-5 -rotate-45 shrink-0" />
                           </button>
                        </div>
                     );
                   })}
                </div>`;

if(content.includes(target)) {
    content = content.replace(target, replace);
    fs.writeFileSync('src/pages/Search.tsx', content);
    console.log("Success");
} else {
    console.log("Could not find the target to replace");
}
