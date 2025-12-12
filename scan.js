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

            // 2. Check for index.html
            if (!files.includes('index.html')) {
                return null;
            }

            // 3. Check Meta
            let meta = { title: dir.name, active: true };
            if (files.includes('meta.json')) {
                try { 
                    const m = JSON.parse(fs.readFileSync(path.join(dirPath, 'meta.json')));
                    meta = { ...meta, ...m };
                } catch (e) {}
            }

            // 4. Check Active Status
            if (meta.active === false) {
                return null;
            }

            // 5. Get Last Modified Date (Check both folder and index.html)
            const folderStats = fs.statSync(dirPath);
            const indexStats = fs.statSync(path.join(dirPath, 'index.html'));
            
            // Use whichever is newer (usually the file)
            const lastUpdated = indexStats.mtime > folderStats.mtime ? indexStats.mtime : folderStats.mtime;

            return {
                id: dir.name,
                path: `./projects/${dir.name}/index.html`,
                title: meta.title.toUpperCase().replace(/-/g, ' '),
                tags: meta.tags || ['Experiment'],
                active: true,
                image: files.includes('thumb.jpg') ? `./projects/${dir.name}/thumb.jpg` : null,
                date: lastUpdated // <--- CHANGED TO MODIFIED DATE
            };
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    return projects;
};

console.log("---------------------------------------------------");
console.log("🔍 SCANNING FOR UPDATES...");
const data = getProjects();
fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
console.log(`✅ Success! Index updated with ${data.length} projects.`);