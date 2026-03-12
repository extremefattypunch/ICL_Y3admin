const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Load grades data
const gradesFile = path.join(__dirname, 'grades.json');
let gradesData = JSON.parse(fs.readFileSync(gradesFile, 'utf8'));

// Grade Calculator Logic
class GradeCalculator {
  constructor(data) {
    this.data = data;
    this.totalEcts = data.modules.reduce((sum, m) => sum + m.ects, 0);
  }

  getModuleInfo(moduleCode) {
    return this.data.modules.find(m => m.module_code === moduleCode);
  }

  getAssessmentsForModule(moduleCode) {
    const module = this.getModuleInfo(moduleCode);
    if (!module) return [];
    return module.assessments.map((assessment, index) => ({
      ...assessment,
      moduleCode,
      assessmentIndex: index
    }));
  }

  calculateModuleScore(moduleCode, grades) {
    const module = this.getModuleInfo(moduleCode);
    if (!module) return null;

    const assessments = this.getAssessmentsForModule(moduleCode);
    
    // Special handling for pass/fail
    if (module.pass_mark === "pass/fail") {
      const key = `${moduleCode}_0`;
      const grade = grades[key];
      if (grade !== null && grade !== undefined) {
        return grade >= 50 ? 100 : 0;
      }
      return null;
    }

    // Only consider assessments with non-zero weight
    const scoredAssessments = assessments.filter(a => a.assessment_weight > 0);
    const totalWeight = scoredAssessments.reduce((sum, a) => sum + a.assessment_weight, 0);
    if (totalWeight === 0) return null;

    let totalWeightedScore = 0;
    let allGradesPresent = true;

    for (const assessment of scoredAssessments) {
      const key = `${moduleCode}_${assessment.assessmentIndex}`;
      const grade = grades[key];

      if (grade === null || grade === undefined) {
        allGradesPresent = false;
      } else {
        // Normalize by actual weight sum so scores always reflect true performance
        const weightedContribution = (assessment.assessment_weight / totalWeight) * grade;
        totalWeightedScore += weightedContribution;
      }
    }

    if (!allGradesPresent) return null;
    return totalWeightedScore;
  }

  calculateFinalScore(moduleScores) {
    let finalScore = 0;
    let allScoresPresent = true;

    for (const module of this.data.modules) {
      // Pass/fail modules don't contribute to the final score
      if (module.pass_mark === 'pass/fail') continue;

      const moduleCode = module.module_code;
      const moduleScore = moduleScores[moduleCode];

      if (moduleScore === null || moduleScore === undefined) {
        allScoresPresent = false;
      } else {
        const moduleWeight = module.module_weight / 100;
        const contribution = moduleWeight * moduleScore;
        finalScore += contribution;
      }
    }

    if (!allScoresPresent) return null;
    return finalScore;
  }

  estimateMissingGrades(grades, targetGrade) {
    // Find all missing grades, excluding pass/fail modules and zero-weight assessments
    const missingKeys = [];
    for (const module of this.data.modules) {
      if (module.pass_mark === 'pass/fail') continue;
      const assessments = this.getAssessmentsForModule(module.module_code);
      for (const assessment of assessments) {
        if (assessment.assessment_weight === 0) continue;
        const key = `${module.module_code}_${assessment.assessmentIndex}`;
        if (grades[key] === null || grades[key] === undefined) {
          missingKeys.push(key);
        }
      }
    }

    if (missingKeys.length === 0) return null;

    // Try different estimated grades
    for (let estimatedGrade = 0; estimatedGrade <= 100; estimatedGrade++) {
      const testGrades = { ...grades };
      for (const key of missingKeys) {
        testGrades[key] = estimatedGrade;
      }

      const moduleScores = {};
      for (const module of this.data.modules) {
        const score = this.calculateModuleScore(module.module_code, testGrades);
        if (score !== null) moduleScores[module.module_code] = score;
      }

      const finalScore = this.calculateFinalScore(moduleScores);
      if (finalScore !== null && finalScore >= targetGrade - 0.01) {
        return estimatedGrade;
      }
    }

    return null;
  }
}

// Routes

// Get all modules
app.get('/api/modules', (req, res) => {
  const modules = gradesData.modules.map(m => ({
    code: m.module_code,
    title: m.title,
    ects: m.ects,
    weight: m.module_weight,
    passMark: m.pass_mark,
    assessments: m.assessments.map((a, idx) => ({
      index: idx,
      name: a.assessment_name,
      weight: a.assessment_weight,
      description: a.description,
      grade: a.grade
    }))
  }));
  res.json(modules);
});

// Calculate grades
app.post('/api/calculate', (req, res) => {
  const { grades, targetGrade } = req.body;
  const calculator = new GradeCalculator(gradesData);

  const results = {
    modules: [],
    finalScore: null,
    estimatedGrade: null,
    achievesTarget: null,
    missingModules: []
  };

  const moduleScores = {};

  // Calculate each module
  for (const module of gradesData.modules) {
    const moduleCode = module.module_code;
    const moduleScore = calculator.calculateModuleScore(moduleCode, grades);
    
    const moduleResult = {
      code: moduleCode,
      title: module.title,
      weight: module.module_weight,
      ects: module.ects,
      assessments: [],
      score: moduleScore
    };

    const assessments = calculator.getAssessmentsForModule(moduleCode);
    for (const assessment of assessments) {
      const key = `${moduleCode}_${assessment.assessmentIndex}`;
      const grade = grades[key];
      moduleResult.assessments.push({
        name: assessment.assessment_name,
        weight: assessment.assessment_weight,
        grade: grade,
        description: assessment.description
      });
    }

    results.modules.push(moduleResult);
    if (moduleScore !== null) moduleScores[moduleCode] = moduleScore;
    else results.missingModules.push(moduleCode);
  }

  // Calculate final score
  const finalScore = calculator.calculateFinalScore(moduleScores);
  results.finalScore = finalScore;

  if (finalScore !== null) {
    results.achievesTarget = finalScore >= targetGrade - 0.01;
  } else {
    // Estimate required grade
    const estimatedGrade = calculator.estimateMissingGrades(grades, targetGrade);
    results.estimatedGrade = estimatedGrade;
    if (estimatedGrade !== null) {
      results.achievesTarget = true; // Achievable with estimated grade
    } else {
      results.achievesTarget = false; // Not achievable
    }
  }

  res.json(results);
});

// Get stored data with target grade estimation
app.get('/api/stored-data', (req, res) => {
  const targetGrade = req.query.target ? parseFloat(req.query.target) : 76.0;
  const calculator = new GradeCalculator(gradesData);

  const results = {
    targetGrade,
    modules: [],
    finalScore: null,
    estimatedGrade: null,
    completeModules: [],
    missingModules: []
  };

  // Build grades object from stored data
  const grades = {};
  for (const module of gradesData.modules) {
    const assessments = calculator.getAssessmentsForModule(module.module_code);
    for (const assessment of assessments) {
      const key = `${module.module_code}_${assessment.assessmentIndex}`;
      grades[key] = assessment.grade;
    }
  }

  const moduleScores = {};

  // Calculate each module
  for (const module of gradesData.modules) {
    const moduleCode = module.module_code;
    const moduleScore = calculator.calculateModuleScore(moduleCode, grades);
    
    const moduleResult = {
      code: moduleCode,
      title: module.title,
      weight: module.module_weight,
      ects: module.ects,
      assessments: [],
      score: moduleScore
    };

    const assessments = calculator.getAssessmentsForModule(moduleCode);
    for (const assessment of assessments) {
      const key = `${moduleCode}_${assessment.assessmentIndex}`;
      const grade = grades[key];
      moduleResult.assessments.push({
        name: assessment.assessment_name,
        weight: assessment.assessment_weight,
        grade: grade,
        description: assessment.description
      });
    }

    results.modules.push(moduleResult);
    if (moduleScore !== null) {
      moduleScores[moduleCode] = moduleScore;
      results.completeModules.push(moduleCode);
    } else {
      results.missingModules.push(moduleCode);
    }
  }

  // Calculate final score
  const finalScore = calculator.calculateFinalScore(moduleScores);
  results.finalScore = finalScore;

  // Estimate if needed
  if (finalScore === null) {
    const estimatedGrade = calculator.estimateMissingGrades(grades, targetGrade);
    results.estimatedGrade = estimatedGrade;
  }

  res.json(results);
});

// Save grade
app.post('/api/save-grade', (req, res) => {
  const { moduleCode, assessmentIndex, grade } = req.body;
  
  const module = gradesData.modules.find(m => m.module_code === moduleCode);
  if (module && module.assessments[assessmentIndex]) {
    module.assessments[assessmentIndex].grade = grade;
    fs.writeFileSync(gradesFile, JSON.stringify(gradesData, null, 2));
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, error: 'Module or assessment not found' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`ICL Y3 GRADE CALCULATOR - WEB APPLICATION`);
  console.log(`${'='.repeat(70)}`);
  console.log(`\nServer running at http://localhost:${PORT}`);
  console.log(`\nOpen your browser and navigate to: http://localhost:${PORT}`);
  console.log(`\nPress Ctrl+C to stop the server\n`);
});
