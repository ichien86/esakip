const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const hookMap = {
  // Auth
  user: 'useAuth',
  setUser: 'useAuth',
  loading: 'useAuth',
  login: 'useAuth',
  logout: 'useAuth',
  
  // Metadata
  allEmployees: 'useMetadata',
  systemSettings: 'useMetadata',
  refreshMetadata: 'useMetadata',
  
  // UI
  activeRole: 'useUI',
  activeBidang: 'useUI',
  activeYear: 'useUI',
  switchRole: 'useUI',
  switchBidang: 'useUI',
  switchYear: 'useUI',
  updateCurrentUserBidang: 'useUI',
  
  // Simulation
  simulatedUser: 'useSimulationInternal',
  currentUser: 'useSimulationInternal',
  isSimulating: 'useSimulationInternal',
  simulate: 'useSimulationInternal',
  activeEmployeeId: 'useSimulationInternal', // Wait, activeEmployeeId was mapped from where? Let me check how activeEmployeeId was implemented in SimulationContext. Ah, there was no activeEmployeeId in the new shim, but let me check if it was used. Oh wait!
  
  // Fetch
  fetchWithAuth: 'useFetchWithAuth'
};

const importPaths = {
  useAuth: '@/context/AuthContext',
  useMetadata: '@/context/MetadataContext',
  useUI: '@/context/UIContext',
  useSimulationInternal: '@/context/SimulationInternalContext',
  useFetchWithAuth: '@/context/useFetchWithAuth'
};

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file));
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        walk(path.join(dir, file), fileList);
      }
    } else {
      if (file.endsWith('.js') || file.endsWith('.jsx')) {
        fileList.push(path.join(dir, file));
      }
    }
  }
  return fileList;
}

const files = walk(srcDir);

for (const file of files) {
  if (file.includes('context\\SimulationContext.js') || 
      file.includes('context/SimulationContext.js') ||
      file.includes('SimulationInternalContext.js') ||
      file.includes('useFetchWithAuth.js') ||
      file.includes('AuthContext.js') ||
      file.includes('UIContext.js') ||
      file.includes('MetadataContext.js') ||
      file.includes('AppProviders.js')) {
    continue;
  }

  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('useSimulation')) continue;

  console.log('Processing', file);

  // Extract variables from const { ... } = useSimulation();
  const match = content.match(/const\s+\{([^}]+)\}\s*=\s*useSimulation\(\);/);
  if (!match) {
    console.log('  Skipped: could not find useSimulation destructuring pattern.');
    continue;
  }

  const vars = match[1].split(',').map(v => v.trim()).filter(v => v);
  
  // Wait! Some pages used 'activeEmployeeId'. But SimulationContext didn't export 'activeEmployeeId'. 
  // Wait, let's fix activeEmployeeId if it exists by replacing it with 'currentUser?.id' or simulatedUser?.id... 
  // Let's replace 'activeEmployeeId' with 'currentUser?.id' in the file itself, and add 'currentUser' to the list if not present.
  let hasActiveEmployeeId = false;
  let finalVars = [];
  for (let v of vars) {
    if (v === 'activeEmployeeId') {
      hasActiveEmployeeId = true;
      if (!vars.includes('currentUser')) {
        finalVars.push('currentUser');
      }
    } else {
      if (!finalVars.includes(v)) finalVars.push(v);
    }
  }

  const hookGroups = {};
  for (const v of finalVars) {
    let hook = hookMap[v];
    if (!hook) {
        console.error(`  ERROR: Unknown variable ${v} from useSimulation()`);
        // Default to useSimulationInternal if unknown? Or just useAuth?
        hook = 'useAuth'; 
    }
    if (!hookGroups[hook]) hookGroups[hook] = [];
    hookGroups[hook].push(v);
  }

  // Generate new hooks calls
  let newHooksCode = '';
  const newImports = [];
  for (const hook of Object.keys(hookGroups)) {
    newHooksCode += `  const { ${hookGroups[hook].join(', ')} } = ${hook}();\n`;
    newImports.push(`import { ${hook} } from '${importPaths[hook]}';`);
  }

  // Handle activeEmployeeId
  if (hasActiveEmployeeId) {
    newHooksCode += `  const activeEmployeeId = currentUser?.id;\n`;
  }

  // Replace hook calls
  content = content.replace(/^[ \t]*const\s+\{([^}]+)\}\s*=\s*useSimulation\(\);\s*$/m, newHooksCode.trimEnd());

  // Replace import
  content = content.replace(/import\s+\{\s*useSimulation\s*\}\s*from\s*['"]@\/context\/SimulationContext['"];?/m, newImports.join('\n'));

  fs.writeFileSync(file, content, 'utf8');
  console.log('  Updated.');
}
