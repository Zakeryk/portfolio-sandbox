const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const PROJECTS_DIR = path.join(__dirname, 'projects');

console.log("--------------------------------------");
console.log("✨  NEW PROJECT GENERATOR");
console.log("--------------------------------------");

rl.question('1. Enter Folder Name (e.g. neon-test): ', (folderName) => {

    // Sanitize folder name (remove spaces, lowercase)
    const cleanFolder = folderName.trim().toLowerCase().replace(/\s+/g, '-');
    const targetPath = path.join(PROJECTS_DIR, cleanFolder);

    if (fs.existsSync(targetPath)) {
        console.log(`\n❌ Error: Folder "${cleanFolder}" already exists!`);
        rl.close();
        return;
    }

    rl.question('2. Enter Display Title (e.g. Neon V1): ', (title) => {

        // 1. Create Folder
        fs.mkdirSync(targetPath);
        console.log(`\n📂 Created folder: projects/${cleanFolder}`);

        // 2. Create meta.json
        const metaContent = {
            title: title || cleanFolder,
            tags: ["Experiment"],
            active: true
        };
        fs.writeFileSync(path.join(targetPath, 'meta.json'), JSON.stringify(metaContent, null, 2));
        console.log("📄 Created meta.json (active: true)");

        // 3. Create index.html (Boilerplate)
        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { margin: 0; background: #000; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; }
        h1 { font-weight: 200; letter-spacing: 2px; }
    </style>
</head>
<body>
    <h1>${title} // WORK IN PROGRESS</h1>
</body>
</html>`;

        // INJECT FAVICON SCRIPT
        const faviconScript = `
    <link id="favicon" rel="icon" href="data:,">
    <script>
        (function() {
            const link = document.getElementById('favicon');
            function loadFavicon(src, isFallback = false) {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 64; canvas.height = 64;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, 64, 64); // No circular clip for generic projects
                    link.href = canvas.toDataURL();
                };
                img.onerror = () => {
                    if (!isFallback) loadFavicon('./thumb.png', true);
                };
                img.src = src;
            }
            loadFavicon('./favicon.png');
        })();
    </script>`;

        // Insert script before closing head
        const finalHtml = htmlContent.replace('</head>', `${faviconScript}\n</head>`);

        fs.writeFileSync(path.join(targetPath, 'index.html'), finalHtml);
        console.log("📄 Created index.html (Boilerplate)");

        console.log("--------------------------------------");
        console.log("✅ READY. Go write some code.");
        console.log("--------------------------------------");

        rl.close();
    });
});