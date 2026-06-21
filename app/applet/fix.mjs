import fs from 'fs';
let code = fs.readFileSync('src/pages/ProblemDetail.tsx', 'utf8');

code = code.replace(
`                                  {post.authorId === user?.uid && post.type === 'problem' && (
                                    <button 
                                      onClick={async () => {
                                         try {
                                            await updateDoc(doc(db, "posts", post.id), { status: "solved" });
                                            alert("Marked as solution!");
                                         } catch(e) {
                                            console.error(e);
                                         }
                                      }}
                                      className="text-xs font-semibold text-buildops-text-secondary hover:text-buildops-green transition-colors flex items-center gap-1 shrink-0"
                                    >
                                       <CheckCircle2 className="w-3.5 h-3.5" /> Mark Solution
                                    </button>
                                  )}`,
`                                  {post.authorId === user?.uid && post.type === 'problem' && !comment.isSolution && (
                                    <button 
                                      onClick={async () => {
                                         try {
                                            await updateDoc(doc(db, "comments", comment.id), { isSolution: true });
                                            await updateDoc(doc(db, "posts", post.id), { status: "solved" });
                                            alert("Marked as solution!");
                                         } catch(e) {
                                            console.error(e);
                                         }
                                      }}
                                      className="text-xs font-semibold text-buildops-text-secondary hover:text-buildops-green transition-colors flex items-center gap-1 shrink-0"
                                    >
                                       <CheckCircle2 className="w-3.5 h-3.5" /> Mark Solution
                                    </button>
                                  )}`
);

let targetLinkBlock = `                                  <Link to={\`/profile/\${comment.authorId}\`} className="font-bold text-sm text-buildops-text hover:underline truncate max-w-[120px] sm:max-w-[200px]">
                                    {author?.displayName || 'Unknown User'}
                                  </Link>
                                  {author?.handle && <span className="text-xs text-buildops-text-secondary truncate max-w-[100px] sm:max-w-none">@{author.handle}</span>}
                                  <span className="text-xs text-buildops-text-secondary ml-auto shrink-0">`;

let replaceLinkBlock = `                                  <Link to={\`/profile/\${comment.authorId}\`} className="font-bold text-sm text-buildops-text hover:underline truncate max-w-[120px] sm:max-w-[200px]">
                                    {author?.displayName || 'Unknown User'}
                                  </Link>
                                  {author?.handle && <span className="text-xs text-buildops-text-secondary truncate max-w-[100px] sm:max-w-none">@{author.handle}</span>}
                                  {comment.isSolution && (
                                    <span className="text-[10px] font-bold text-buildops-green bg-buildops-green/10 px-2 py-0.5 rounded-full shrink-0 border border-buildops-green/20">
                                      Solution
                                    </span>
                                  )}
                                  {isMostLiked && (
                                    <span className="text-[10px] font-bold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full shrink-0 border border-yellow-500/20">
                                      Top Comment
                                    </span>
                                  )}
                                  <span className="text-xs text-buildops-text-secondary ml-auto shrink-0">`;

code = code.replace(targetLinkBlock, replaceLinkBlock);

fs.writeFileSync('src/pages/ProblemDetail.tsx', code);
console.log('done replacing');
