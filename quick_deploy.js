const ftp = require("basic-ftp");
const { execSync } = require("child_process");

// --- COPY YOUR CONFIG FROM deploy.js ---
const CONFIG = {
    host: "sandbox.zakknowlton.com", 
    user: "zakknowl",                
    password: "cpanel981084*****",  // <--- PASTE PASSWORD HERE
    remoteRoot: "sandbox.zakknowlton.com/"
};
// -------------------------------------

async function quickDeploy() {
    const client = new ftp.Client();

    try {
        console.log("---------------------------------------------------");
        console.log("⚡️  QUICK MODE: UPDATING UI ONLY...");
        
        // 1. Re-scan (in case you renamed a project)
        execSync("node scan.js", { stdio: "inherit" });
        
        console.log(`📡  Connecting to ${CONFIG.host}...`);
        await client.access({
            host: CONFIG.host,
            user: CONFIG.user,
            password: CONFIG.password,
            secure: false
        });

        // 2. Upload ONLY the root files
        console.log("📤  Uploading index.html...");
        await client.uploadFrom("index.html", "index.html");
        
        console.log("µ  Uploading data.json...");
        await client.uploadFrom("data.json", "data.json");

        console.log("---------------------------------------------------");
        console.log("✨  UI UPDATE COMPLETE (3s)");
        console.log("---------------------------------------------------");

    } catch(err) {
        console.log("❌ ERROR:", err);
    }
    client.close();
}

quickDeploy();