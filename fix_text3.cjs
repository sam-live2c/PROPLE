const fs = require('fs');

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    content = content.replace(/Push your problem to the top/g, "Push your post to the top");
    content = content.replace(/Removed from saved problems\./g, "Removed from saved posts.");
    content = content.replace(/prioritize problems/g, "prioritize posts");
    content = content.replace(/technical problems/g, "technical posts");
    content = content.replace(/convert failed search to problem/gi, "Convert failed search to post");
    // Any remaining 'Problem' or 'problem' string that affects UI.
    
    fs.writeFileSync(filePath, content, 'utf-8');
}

['src/pages/Search.tsx', 'src/pages/Dashboard.tsx', 'src/pages/Profile.tsx', 'src/pages/SubmitProblem.tsx', 'src/components/layout/Header.tsx', 'src/components/layout/BottomNav.tsx', 'src/pages/Saved.tsx', 'src/components/ProblemCard.tsx', 'src/pages/ProblemDetail.tsx', 'src/pages/BoostSetup.tsx', 'src/pages/Settings.tsx'].forEach(file => {
    if (fs.existsSync(file)) {
        replaceInFile(file);
    }
});
