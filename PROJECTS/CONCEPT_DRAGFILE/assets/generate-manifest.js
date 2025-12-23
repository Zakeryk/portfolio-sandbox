#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Project titles to match against
const projects = [
    'Reveo',
    'Snowie',
    'Green Philosophy Co',
    'Raveyard Sounds',
    'Shockwav Sound Co',
    'gothparade',
    'Rave Water',
    'Glass Heart',
    'Beat Secrets',
    'us2',
    'Polar Culture',
    'Lil Dusty G',
    'School of Bass',
    'Crywolf'
];

// Normalize string for matching (lowercase, remove spaces and special chars)
function normalize(str) {
    return str.toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

// Read all files from file-assets folder
const assetsDir = path.join(__dirname, 'file-assets');
const manifest = {};

// Initialize manifest for each project
projects.forEach(project => {
    manifest[project] = [];
});

try {
    const files = fs.readdirSync(assetsDir);

    files.forEach(file => {
        // Skip non-image files
        if (!file.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
            return;
        }

        const normalizedFilename = normalize(file);

        // Try to match file to a project
        projects.forEach(project => {
            const normalizedProject = normalize(project);

            // Check if project name appears in filename
            if (normalizedFilename.includes(normalizedProject)) {
                const relativePath = `./assets/file-assets/${file}`;
                manifest[project].push(relativePath);
            }
        });
    });

    // Write manifest to JSON file
    const manifestPath = path.join(__dirname, 'file-assets-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    console.log('✓ Manifest generated successfully!');
    console.log(`Found images for:`);
    Object.entries(manifest).forEach(([project, images]) => {
        if (images.length > 0) {
            console.log(`  - ${project}: ${images.length} image(s)`);
        }
    });

} catch (error) {
    console.error('Error generating manifest:', error.message);
    process.exit(1);
}
