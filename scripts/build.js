#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n' + '='.repeat(70));
console.log('ICL Y3 GRADE CALCULATOR - BUILD PROCESS');
console.log('='.repeat(70) + '\n');

// Step 1: Check and install dependencies
console.log('🔧 Step 1: Checking dependencies...');
const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
  console.log('   ⚠️  node_modules not found');
  console.log('   Please install dependencies first:');
  console.log('   $ npm install\n');
  console.log('   Then run build again:');
  console.log('   $ npm run build\n');
  process.exit(1);
} else {
  console.log('✓ Dependencies checked\n');
}

// Step 2: Validate grades.json
console.log('📋 Step 2: Validating grades.json...');
const gradesPath = path.join(__dirname, '..', 'grades.json');
try {
  const gradesData = JSON.parse(fs.readFileSync(gradesPath, 'utf8'));
  
  // Check required fields
  if (!gradesData.year) throw new Error('Missing "year" field');
  if (!gradesData.total_ects) throw new Error('Missing "total_ects" field');
  if (!gradesData.modules || !Array.isArray(gradesData.modules)) throw new Error('Missing or invalid "modules" array');
  
  const moduleCount = gradesData.modules.length;
  const assessmentCount = gradesData.modules.reduce((sum, m) => sum + (m.assessments ? m.assessments.length : 0), 0);
  const computedTotalEcts = gradesData.modules.reduce((sum, m) => sum + Number(m.ects || 0), 0);
  const moduleWeightTotal = gradesData.modules.reduce((sum, m) => sum + Number(m.module_weight || 0), 0);
  const invalidAssessmentWeightModules = gradesData.modules
    .map(module => ({
      code: module.module_code,
      total: (module.assessments || []).reduce((sum, a) => sum + Number(a.assessment_weight || 0), 0)
    }))
    .filter(module => Math.abs(module.total - 100) >= 0.01);
  
  console.log(`✓ grades.json validated`);
  console.log(`   - Year: ${gradesData.year}`);
  console.log(`   - Total ECTS: ${computedTotalEcts}`);
  console.log(`   - Modules: ${moduleCount}`);
  console.log(`   - Assessments: ${assessmentCount}`);

  if (Math.abs(moduleWeightTotal - 100) >= 0.01) {
    console.log(`   ⚠ Module weights total ${moduleWeightTotal}% instead of 100%`);
  }

  if (invalidAssessmentWeightModules.length > 0) {
    console.log('   ⚠ Modules with assessment totals not equal to 100%:');
    invalidAssessmentWeightModules.forEach(module => {
      console.log(`     - ${module.code}: ${module.total}%`);
    });
  }

  console.log('');
} catch (error) {
  console.error(`✗ grades.json validation failed: ${error.message}`);
  process.exit(1);
}

// Step 3: Validate server.js
console.log('⚙️  Step 3: Validating server.js...');
const serverPath = path.join(__dirname, '..', 'server.js');
try {
  require.cache = {}; // Clear cache
  require(serverPath);
  console.log('✓ server.js syntax validated\n');
} catch (error) {
  // Server module executes on require, so we'll just check if it exists and is valid JavaScript
  try {
    const code = fs.readFileSync(serverPath, 'utf8');
    new Function(code); // Check if it's valid JS
    console.log('✓ server.js syntax validated\n');
  } catch (syntaxError) {
    console.error(`✗ server.js syntax error: ${syntaxError.message}`);
    process.exit(1);
  }
}

// Step 4: Validate public assets
console.log('🎨 Step 4: Checking public assets...');
const publicDir = path.join(__dirname, '..', 'public');
const requiredFiles = ['index.html', 'style.css', 'app.js'];
const missingFiles = [];

for (const file of requiredFiles) {
  const filePath = path.join(publicDir, file);
  if (!fs.existsSync(filePath)) {
    missingFiles.push(file);
  }
}

if (missingFiles.length > 0) {
  console.error(`✗ Missing required files: ${missingFiles.join(', ')}`);
  process.exit(1);
}

console.log(`✓ All public assets present`);
console.log(`   - index.html: ${fs.statSync(path.join(publicDir, 'index.html')).size} bytes`);
console.log(`   - style.css: ${fs.statSync(path.join(publicDir, 'style.css')).size} bytes`);
console.log(`   - app.js: ${fs.statSync(path.join(publicDir, 'app.js')).size} bytes\n`);

// Step 5: Summary
console.log('='.repeat(70));
console.log('✓ BUILD SUCCESSFUL');
console.log('='.repeat(70));
console.log('\nNext steps:');
console.log('1. Run the application: npm start');
console.log('2. Open browser: http://localhost:3000');
console.log('3. Start using the grade calculator\n');
