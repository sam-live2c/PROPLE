const fs = require('fs');

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    content = content.replace(/Problems and builds you save will appear here\./g, "Posts and builds you save will appear here.");
    content = content.replace(/Problem saved to dashboard!/g, "Post saved to dashboard!");
    content = content.replace(/Save Problem/g, "Save Post");
    
    fs.writeFileSync(filePath, content, 'utf-8');
}

['src/pages/Saved.tsx', 'src/pages/ProblemDetail.tsx'].forEach(file => {
    if (fs.existsSync(file)) {
        replaceInFile(file);
    }
});
