const fs = require('fs');
const path = require('path');
const ftp = require("basic-ftp");
const { execSync } = require("child_process");

// --- CONFIGURATION ---
const CONFIG = {
    host: "sandbox.zakknowlton.com", 
    user: "zakknowl",                
    password: "cpanel981084*****",  // <--- PASTE PASSWORD HERE
    remoteRoot: "sandbox.zakknowlton.com/" // <--- Now fully respected
};
// ---------------------

const CACHE_FILE = 'deploy-cache.json';

function getAllFiles(dirPath, arrayOfFiles) {
    if (!fs.existsSync(dirPath)) return arrayOfFiles || [];
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];
    files.forEach(function(file) {
        if (file === '.DS_Store' || file === 'node_modules') return;
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            getAllFiles(fullPath, arrayOfFiles);
        } else {
            arrayOfFiles.push(fullPath);
        }
    });
    return arrayOfFiles;
}

async function smartDeploy() {
    const client = new ftp.Client();

    try {
        console.log("---------------------------------------------------");
        console.log("🧠  SMART DEPLOY: CHECKING FILES...");
        
        // 1. Run Scan
        try { execSync("node scan.js", { stdio: 'ignore' }); } catch(e) {}

        // 2. Load Cache
        let cache = {};
        if(fs.existsSync(CACHE_FILE)) {
            try { cache = JSON.parse(fs.readFileSync(CACHE_FILE)); } 
            catch (e) { cache = {}; }
        }

        // 3. Gather Files
        let allFiles = getAllFiles("./projects");
        allFiles.push("index.html");
        allFiles.push("data.json");
        if(fs.existsSync("eyeball-favi.jpg")) allFiles.push("eyeball-favi.jpg");

        // 4. Compare with Cache
        const toUpload = [];
        allFiles.forEach(f => {
            const stats = fs.statSync(f);
            const mtime = stats.mtimeMs;
            if(!cache[f] || mtime > cache[f]) {
                toUpload.push({ path: f, mtime: mtime });
            }
        });

        if(toUpload.length === 0) {
            console.log("✅  No changes detected. Site is up to date.");
            return;
        }

        console.log(`📋  Found ${toUpload.length} file(s) to sync.`);
        console.log(`🚀  Connecting to ${CONFIG.host}...`);

        await client.access({
            host: CONFIG.host,
            user: CONFIG.user,
            password: CONFIG.password,
            secure: false
        });

        // 5. Upload Loop
        let counter = 0;
        for (const item of toUpload) {
            counter++;
            const localPath = item.path;
            
            // Clean paths
            const cleanPath = localPath.replace(/\\/g, '/'); 
            const fileName = path.basename(cleanPath);
            
            // COMBINE CONFIG ROOT + LOCAL FOLDER
            // Example: "sandbox.zakknowlton.com/" + "projects/test"
            const finalDir = CONFIG.remoteRoot + path.dirname(cleanPath);

            // 1. Reset to Absolute Home
            await client.cd("/");
            
            // 2. Dig down into the correct full path
            await client.ensureDir(finalDir);

            // Log progress
            const percent = Math.round((counter / toUpload.length) * 100);
            process.stdout.write(`    [${percent}%] Uploading: ${cleanPath} ... `);
            
            // 3. Upload file (we are already in the right directory now)
            await client.uploadFrom(localPath, fileName);
            console.log("OK");

            // Update cache
            cache[localPath] = item.mtime;
        }

        // 6. Save Cache
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));

        console.log("---------------------------------------------------");
        console.log("✨  SYNC COMPLETE.");
        console.log("---------------------------------------------------");

    } catch(err) {
        console.log("\n❌ ERROR:", err);
    }
    client.close();
}

smartDeploy();