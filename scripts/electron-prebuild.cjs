/**
 * Copy hoisted node_modules into backend/node_modules for Electron packaging.
 *
 * npm workspaces hoists dependencies to the root node_modules/, but
 * electron-builder only packages backend/node_modules/. This script
 * resolves all backend production dependencies and copies them from
 * wherever npm installed them (usually root) into backend/node_modules/.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const backendDir = path.join(__dirname, '..', 'backend');
const backendNodeModules = path.join(backendDir, 'node_modules');
const rootNodeModules = path.join(__dirname, '..', 'node_modules');

// Get production dependencies for backend
const backendPkg = JSON.parse(fs.readFileSync(path.join(backendDir, 'package.json'), 'utf8'));
const prodDeps = Object.keys(backendPkg.dependencies || {});

// Recursively collect all transitive dependencies
function collectDeps(pkgName, visited = new Set()) {
  if (visited.has(pkgName)) return;
  visited.add(pkgName);

  // Find the package - check backend first, then root
  let pkgDir = path.join(backendNodeModules, pkgName);
  if (!fs.existsSync(pkgDir)) {
    pkgDir = path.join(rootNodeModules, pkgName);
  }
  if (!fs.existsSync(pkgDir)) return;

  // Read its dependencies
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) return;

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const deps = [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.optionalDependencies || {}),
    ];
    for (const dep of deps) {
      collectDeps(dep, visited);
    }
  } catch (e) {
    // Skip unreadable packages
  }

  return visited;
}

// Collect all transitive deps
const allDeps = new Set();
for (const dep of prodDeps) {
  collectDeps(dep, allDeps);
}

// Copy from root node_modules to backend/node_modules
let copied = 0;
for (const dep of allDeps) {
  const src = path.join(rootNodeModules, dep);
  const dst = path.join(backendNodeModules, dep);

  if (fs.existsSync(src) && !fs.existsSync(dst)) {
    // Handle scoped packages (@scope/name)
    const dstParent = path.dirname(dst);
    if (!fs.existsSync(dstParent)) {
      fs.mkdirSync(dstParent, { recursive: true });
    }
    fs.cpSync(src, dst, { recursive: true });
    copied++;
  }
}

console.log(`[electron-prebuild] Copied ${copied} hoisted dependencies to backend/node_modules/`);
console.log(`[electron-prebuild] Total deps: ${allDeps.size}`);
