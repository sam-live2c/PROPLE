const fs = require('fs');

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    content = content.replace(/No matching engineering problems found\./g, "No matching engineering posts found.");
    content = content.replace(/posting this as a new problem/g, "posting this as a new post");
    content = content.replace(/Post this problem/g, "Create this post");
    content = content.replace(/Can't find the problem\?/g, "Can't find the post?");
    content = content.replace(/Post New Problem/g, "Create New Post");
    content = content.replace(/Problem Activity/g, "Post Activity");
    content = content.replace(/Recent Problems/g, "Recent Posts");
    content = content.replace(/Saved Problems/g, "Saved Posts");
    content = content.replace(/Problems Posted/g, "Total Posts");
    content = content.replace(/Post Problem/g, "Create Post");
    
    // We already changed those tabs in Search.tsx
    
    fs.writeFileSync(filePath, content, 'utf-8');
}

['src/pages/Search.tsx', 'src/pages/Dashboard.tsx', 'src/pages/Profile.tsx', 'src/pages/SubmitProblem.tsx', 'src/components/layout/Header.tsx', 'src/components/layout/BottomNav.tsx', 'src/pages/Saved.tsx', 'src/components/ProblemCard.tsx', 'src/pages/ProblemDetail.tsx', 'src/pages/BoostSetup.tsx', 'src/pages/Settings.tsx'].forEach(file => {
    if (fs.existsSync(file)) {
        replaceInFile(file);
    }
});
