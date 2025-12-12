const fs = require('fs');
const path = require('path');

// 1. Setup Paths
const projectsDir = path.join(__dirname, 'projects');
const outputFile = path.join(__dirname, 'data.json');

// 2. Scan Function
const getProjects = () => {
    if (!fs.existsSync(projectsDir)) {
        console.log("⚠️  No /projects folder found.");
        return [];
    }
    
    const items = fs.readdirSync(projectsDir, { withFileTypes: true });
    
    const projects = items
        .filter(item => item.isDirectory())
        .map(dir => {
            const dirPath = path.join(projectsDir, dir.name);
            const files = fs.readdirSync(dirPath);

            if (files.includes('index.html')) {
                
                // CHECK: Does folder end with "-hide"?
                const isHidden = dir.name.endsWith('-hide');

                // Generate clean Title (Remove "-hide" suffix and hyphens)
                let cleanTitle = dir.name;
                if (isHidden) {
                    cleanTitle = cleanTitle.slice(0, -5); // Remove last 5 chars ("-hide")
                }
                cleanTitle = cleanTitle.replace(/-/g, ' ').toUpperCase().trim();

                // Default Metadata
                let meta = { 
                    title: cleanTitle, 
                    tags: ['Experiment'],
                    active: !isHidden // If suffix exists, active is FALSE
                };

                // Overwrite if meta.json exists
                if (files.includes('meta.json')) {
                    try {
                        const metaContent = fs.readFileSync(path.join(dirPath, 'meta.json'));
                        const parsed = JSON.parse(metaContent);
                        meta = { ...meta, ...parsed }; 
                    } catch (e) {
                        console.log(`⚠️  Error reading meta.json in ${dir.name}`);
                    }
                }

                return {
                    id: dir.name,
                    path: `./projects/${dir.name}/index.html`,
                    title: meta.title,
                    tags: meta.tags,
                    active: meta.active, // Passed to frontend
                    image: files.includes('thumb.jpg') ? `./projects/${dir.name}/thumb.jpg` : null,
                    date: fs.statSync(dirPath).birthtime
                };
            }
            return null;
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    return projects;
};

// 3. Execution
console.log("🔍 Scanning projects...");
const data = getProjects();
fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
console.log(`✅ Success! Added ${data.length} projects to data.json`);