const fs = require('fs');
const path = require('path');

const projectsDir = path.join(__dirname, 'projects');
const outputFile = path.join(__dirname, 'data.json');

const getProjects = () => {
    if (!fs.existsSync(projectsDir)) return [];

    const items = fs.readdirSync(projectsDir, { withFileTypes: true });

    return items
        .filter(item => item.isDirectory())
        .map(dir => {
            const dirPath = path.join(projectsDir, dir.name);
            const files = fs.readdirSync(dirPath);

            if (files.includes('index.html')) {
                // Default Data
                let meta = { title: dir.name.toUpperCase().replace(/-/g, ' '), tags: [], active: true };

                // Meta Override
                if (files.includes('meta.json')) {
                    try { meta = { ...meta, ...JSON.parse(fs.readFileSync(path.join(dirPath, 'meta.json'))) }; } catch (e) {}
                }

                if (meta.active === false) return null;

                return {
                    id: dir.name,
                    path: `./projects/${dir.name}/index.html`,
                    title: meta.title,
                    tags: meta.tags,
                    active: true,
                    image: files.includes('thumb.jpg') ? `./projects/${dir.name}/thumb.jpg` : null,
                    date: fs.statSync(dirPath).birthtime
                };
            }
            return null;
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
};

console.log("🔍 Scanning projects...");
const data = getProjects();
fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
console.log(`✅ Success! Added ${data.length} projects.`);