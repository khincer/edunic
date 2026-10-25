const fs = require('fs');
const path = require('path');
const routesDir = 'apps/edunic-api/src/routes';
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'));
for (const f of files) {
  const p = path.join(routesDir, f);
  let c = fs.readFileSync(p, 'utf8');
  c = c.replace(/authorizeRoles\(\[\s*'admin'\s*\]\)/g, "authorizeRoles(['director', 'vice_director', 'subdirector'])");
  c = c.replace(/authorizeRoles\(\[\s*'admin'\s*,\s*'teacher'\s*\]\)/g, "authorizeRoles(['director', 'vice_director', 'subdirector', 'teacher'])");
  c = c.replace(/authorizeRoles\(\[\s*'admin'\s*,\s*'teacher'\s*,\s*'parent'\s*\]\)/g, "authorizeRoles(['director', 'vice_director', 'subdirector', 'teacher', 'parent'])");
  c = c.replace(/authorizeRoles\(\[\s*'admin'\s*,\s*'parent'\s*\]\)/g, "authorizeRoles(['director', 'vice_director', 'subdirector', 'parent'])");
  fs.writeFileSync(p, c);
}
console.log('done');
