#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy markdown directory
const markdownSrc = path.join(__dirname, '..', 'src', 'markdown');
const markdownDest = path.join(__dirname, '..', 'dist', 'markdown');

if (fs.existsSync(markdownSrc)) {
  copyDir(markdownSrc, markdownDest);
  console.log('✓ Copied markdown files');
}

// Copy resources directory (MCP resources for workflow guides)
const resourcesSrc = path.join(__dirname, '..', 'src', 'resources');
const resourcesDest = path.join(__dirname, '..', 'dist', 'resources');

if (fs.existsSync(resourcesSrc)) {
  copyDir(resourcesSrc, resourcesDest);
  console.log('✓ Copied resource files');
}

// Copy locales directory
const localesSrc = path.join(__dirname, '..', 'src', 'locales');
const localesDest = path.join(__dirname, '..', 'dist', 'locales');

if (fs.existsSync(localesSrc)) {
  copyDir(localesSrc, localesDest);
  console.log('✓ Copied locale files');
}

// Copy icons from old dashboard (we still need these)
const iconsSrc = path.join(__dirname, '..', 'src', 'dashboard', 'public');
const publicDest = path.join(__dirname, '..', 'dist', 'dashboard', 'public');

// Ensure public directory exists
if (!fs.existsSync(publicDest)) {
  fs.mkdirSync(publicDest, { recursive: true });
}

// Copy only the icon files from old dashboard
const iconFiles = ['claude-icon.svg', 'claude-icon-dark.svg'];
if (fs.existsSync(iconsSrc)) {
  for (const iconFile of iconFiles) {
    const srcPath = path.join(iconsSrc, iconFile);
    const destPath = path.join(publicDest, iconFile);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
  console.log('✓ Copied dashboard icon files');
}

// Copy dashboard build as the main dashboard
const newDashSrc = path.join(__dirname, '..', 'src', 'dashboard_frontend', 'dist');

if (fs.existsSync(newDashSrc)) {
  // Copy all files from new dashboard to public root
  copyDir(newDashSrc, publicDest);
  console.log('✓ Copied dashboard as main dashboard');
}