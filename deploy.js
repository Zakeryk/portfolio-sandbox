const ftp = require("basic-ftp");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// --- CONFIGURATION ---
const CONFIG = {
    host: "sandbox.zakknowlton.com", // Your domain
    user: "zakknowl",                // Your cPanel username
    password: "cpanel981084*****",  // <--- TYPE YOUR CPANEL PASSWORD HERE
    remoteRoot: "/public_html/"      // We'll auto-detect the right folder below
};
// ---------------------

async function deploy() {
    const client = new ftp.Client();
     client.ftp.verbose = true; // Uncomment to see every single command (debug)

    try {
        console.log("---------------------------------------------------");
        console.log("🔍  STEP 1: SCANNING LOCAL PROJECTS...");
        // Run your existing scan.js first
        execSync("node scan.js", { stdio: "inherit" });
        console.log("---------------------------------------------------");

        console.log(`🚀  STEP 2: CONNECTING TO ${CONFIG.host}...`);
        
        await client.access({
            host: CONFIG.host,
            user: CONFIG.user,
            password: CONFIG.password,
            secure: false // Standard FTP for shared hosting
        });

        console.log("✅  CONNECTED.");
        
        // 1. Upload the Index and Data file
        console.log("📤  Uploading System Files (index.html, data.json)...");
        await client.uploadFrom("index.html", "index.html");
        await client.uploadFrom("data.json", "data.json");

        // 2. Upload the Projects Folder
        // This is a "Smart Upload" - it checks if files exist first
        console.log("📂  Syncing Projects Folder (This might take a moment)...");
        //await client.ensureDir("projects");
        await client.uploadFromDir("projects", "projects");

        console.log("---------------------------------------------------");
        console.log("✨  DEPLOY COMPLETE! Your site is live.");
        console.log("---------------------------------------------------");

    } catch(err) {
        console.log("❌  ERROR:");
        console.log(err);
    }
    client.close();
}

deploy();