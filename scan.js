const fs = require('fs');
const path = require('path');

const projectsDir = path.join(__dirname, 'projects');
const outputFile = path.join(__dirname, 'data.json');

const getProjects = () => {
    // 1. Check if Projects folder exists
    if (!fs.existsSync(projectsDir)) {
        console.log("❌ ERROR: Could not find a 'projects' folder at:", projectsDir);
        return [];
    }
    
    const items = fs.readdirSync(projectsDir, { withFileTypes: true });
    
    const projects = items
        .filter(item => item.isDirectory())
        .map(dir => {
            const dirPath = path.join(projectsDir, dir.name);
            const files = fs.readdirSync(dirPath);

            console.log(`\n📂 Checking: ${dir.name}`);

            // 2. Check for index.html
            if (!files.includes('index.html')) {
                console.log(`   ❌ SKIPPED: No index.html found inside.`);
                return null;
            }

            // 3. Check Meta
            let meta = { title: dir.name, active: true };
            if (files.includes('meta.json')) {
                try { 
                    const m = JSON.parse(fs.readFileSync(path.join(dirPath, 'meta.json')));
                    meta = { ...meta, ...m };
                    console.log(`   📄 Found meta.json (Active: ${meta.active})`);
                } catch (e) {
                    console.log(`   ⚠️ Error reading meta.json`);
                }
            }

            // 4. Check Active Status
            if (meta.active === false) {
                console.log(`   ⛔ SKIPPED: active is set to false.`);
                return null;
            }

            console.log(`   ✅ INCLUDED!`);

            return {
                id: dir.name,
                path: `./projects/${dir.name}/index.html`,
                title: meta.title.toUpperCase().replace(/-/g, ' '),
                tags: meta.tags || ['Experiment'],
                active: true,
                image: files.includes('thumb.jpg') ? `./projects/${dir.name}/thumb.jpg` : null,
                date: fs.statSync(dirPath).birthtime
            };
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    return projects;
};

console.log("---------------------------------------------------");
console.log("🔍 DIAGNOSTIC SCAN STARTED");
console.log("---------------------------------------------------");
const data = getProjects();
console.log("---------------------------------------------------");
fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
console.log(`📝 Wrote ${data.length} items to data.json`);