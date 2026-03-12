const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { loadGradesData, normalizeData, saveGradesData } = require('./lib/dataStore');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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
    if (module.pass_mark === 'pass/fail') return null;

    const scoredAssessments = this.getAssessmentsForModule(moduleCode)
      .filter(assessment => assessment.assessment_weight > 0);
    const totalWeight = scoredAssessments.reduce(
      (sum, assessment) => sum + assessment.assessment_weight,
      0
    );

    if (totalWeight === 0) return null;

    let totalWeightedScore = 0;
    let allGradesPresent = true;

    for (const assessment of scoredAssessments) {
      const key = `${moduleCode}_${assessment.assessmentIndex}`;
      const grade = grades[key];

      if (grade === null || grade === undefined) {
        allGradesPresent = false;
      } else {
        totalWeightedScore += (assessment.assessment_weight / totalWeight) * grade;
      }
    }

    if (!allGradesPresent) return null;
    return totalWeightedScore;
  }

  calculateFinalScore(moduleScores) {
    let finalScore = 0;
    let allScoresPresent = true;

    for (const module of this.data.modules) {
      if (module.pass_mark === 'pass/fail' || module.module_weight === 0) {
        continue;
      }

      const moduleScore = moduleScores[module.module_code];
      if (moduleScore === null || moduleScore === undefined) {
        allScoresPresent = false;
      } else {
        finalScore += (module.module_weight / 100) * moduleScore;
      }
    }

    if (!allScoresPresent) return null;
    return finalScore;
  }

  estimateMissingGrades(grades, targetGrade) {
    const missingKeys = [];

    for (const module of this.data.modules) {
      if (module.pass_mark === 'pass/fail' || module.module_weight === 0) {
        continue;
      }

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

    for (let estimatedGrade = 0; estimatedGrade <= 100; estimatedGrade++) {
      const testGrades = { ...grades };
      for (const key of missingKeys) {
        testGrades[key] = estimatedGrade;
      }

      const moduleScores = {};
      for (const module of this.data.modules) {
        const score = this.calculateModuleScore(module.module_code, testGrades);
        if (score !== null) {
          moduleScores[module.module_code] = score;
        }
      }

      const finalScore = this.calculateFinalScore(moduleScores);
      if (finalScore !== null && finalScore >= targetGrade - 0.01) {
        return estimatedGrade;
      }
    }

    return null;
  }
}

function getAssessmentWeightSummary(module) {
  const assessmentWeightTotal = module.assessments.reduce(
    (sum, assessment) => sum + Number(assessment.assessment_weight || 0),
    0
  );
  const assessmentWeightValid = Math.abs(assessmentWeightTotal - 100) < 0.01;

  return {
    assessmentWeightTotal,
    assessmentWeightValid,
    assessmentWeightWarning: assessmentWeightValid
      ? null
      : `Assessment weights total ${assessmentWeightTotal}% instead of 100%.`
  };
}

function getModuleWeightSummary(modules) {
  const moduleWeightTotal = modules.reduce(
    (sum, module) => sum + Number(module.module_weight || 0),
    0
  );
  const moduleWeightValid = Math.abs(moduleWeightTotal - 100) < 0.01;

  return {
    moduleWeightTotal,
    moduleWeightValid,
    moduleWeightWarning: moduleWeightValid
      ? null
      : `Module weights total ${moduleWeightTotal}% across all modules instead of 100%.`
  };
}

function buildModulePayload(module, grades = null, calculator = null) {
  const moduleCode = module.module_code;
  const weightSummary = getAssessmentWeightSummary(module);
  const assessments = calculator
    ? calculator.getAssessmentsForModule(moduleCode)
    : module.assessments.map((assessment, index) => ({
        ...assessment,
        moduleCode,
        assessmentIndex: index
      }));

  return {
    code: moduleCode,
    title: module.title,
    ects: module.ects,
    weight: module.module_weight,
    passMark: module.pass_mark,
    assessmentWeightTotal: weightSummary.assessmentWeightTotal,
    assessmentWeightValid: weightSummary.assessmentWeightValid,
    assessmentWeightWarning: weightSummary.assessmentWeightWarning,
    assessments: assessments.map(assessment => ({
      index: assessment.assessmentIndex,
      name: assessment.assessment_name,
      weight: assessment.assessment_weight,
      description: assessment.description,
      grade: grades ? grades[`${moduleCode}_${assessment.assessmentIndex}`] : assessment.grade
    }))
  };
}

function buildModulesResponse(data) {
  const moduleWeightSummary = getModuleWeightSummary(data.modules);

  return {
    modules: data.modules.map(module => buildModulePayload(module)),
    ...moduleWeightSummary
  };
}

function buildStoredGradesObject(data) {
  const grades = {};

  data.modules.forEach(module => {
    module.assessments.forEach((assessment, index) => {
      grades[`${module.module_code}_${index}`] = assessment.grade;
    });
  });

  return grades;
}

function buildResults(data, grades, targetGrade, includeTargetGrade = false) {
  const calculator = new GradeCalculator(data);
  const moduleWeightSummary = getModuleWeightSummary(data.modules);
  const results = {
    modules: [],
    finalScore: null,
    estimatedGrade: null,
    achievesTarget: null,
    missingModules: [],
    completeModules: [],
    ...moduleWeightSummary
  };

  if (includeTargetGrade) {
    results.targetGrade = targetGrade;
  }

  const moduleScores = {};

  for (const module of data.modules) {
    const modulePayload = buildModulePayload(module, grades, calculator);
    const countsTowardsFinal = module.pass_mark !== 'pass/fail' && module.module_weight > 0;
    const moduleScore = calculator.calculateModuleScore(module.module_code, grades);

    modulePayload.score = moduleScore;
    results.modules.push(modulePayload);

    if (!countsTowardsFinal) {
      continue;
    }

    if (moduleScore !== null) {
      moduleScores[module.module_code] = moduleScore;
      results.completeModules.push(module.module_code);
    } else {
      results.missingModules.push(module.module_code);
    }
  }

  results.finalScore = calculator.calculateFinalScore(moduleScores);

  if (results.finalScore !== null) {
    results.achievesTarget = results.finalScore >= targetGrade - 0.01;
  } else {
    results.estimatedGrade = calculator.estimateMissingGrades(grades, targetGrade);
    results.achievesTarget = results.estimatedGrade !== null;
  }

  return results;
}

function validateEditableModules(modules) {
  if (!Array.isArray(modules)) {
    return 'Modules must be an array.';
  }

  const seenModuleCodes = new Set();

  for (let moduleIndex = 0; moduleIndex < modules.length; moduleIndex++) {
    const module = modules[moduleIndex];
    const moduleCode = String(module.module_code ?? '').trim();
    const title = String(module.title ?? '').trim();

    if (!moduleCode) {
      return `Module ${moduleIndex + 1} is missing a module code.`;
    }

    if (seenModuleCodes.has(moduleCode)) {
      return `Duplicate module code found: ${moduleCode}.`;
    }
    seenModuleCodes.add(moduleCode);

    if (!title) {
      return `Module ${moduleCode} is missing a title.`;
    }

    if (!Array.isArray(module.assessments)) {
      return `Module ${moduleCode} must contain an assessments array.`;
    }

    for (let assessmentIndex = 0; assessmentIndex < module.assessments.length; assessmentIndex++) {
      const assessment = module.assessments[assessmentIndex];
      const assessmentName = String(assessment.assessment_name ?? '').trim();

      if (!assessmentName) {
        return `Assessment ${assessmentIndex + 1} in module ${moduleCode} is missing a name.`;
      }
    }
  }

  return null;
}

app.get('/api/modules', async (req, res) => {
  try {
    const gradesData = await loadGradesData();
    res.json(buildModulesResponse(gradesData));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/config', async (req, res) => {
  try {
    const gradesData = await loadGradesData();
    const normalized = normalizeData(gradesData);
    const warnings = normalized.modules
      .map(module => ({ code: module.module_code, ...getAssessmentWeightSummary(module) }))
      .filter(module => !module.assessmentWeightValid);

    const moduleWeightSummary = getModuleWeightSummary(normalized.modules);

    res.json({ ...normalized, warnings, ...moduleWeightSummary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/config', async (req, res) => {
  try {
    const currentData = await loadGradesData();
    const modules = Array.isArray(req.body.modules) ? req.body.modules : [];
    const validationError = validateEditableModules(modules);

    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const updatedData = await saveGradesData({
      year: currentData.year,
      modules
    });

    const warnings = updatedData.modules
      .map(module => ({ code: module.module_code, ...getAssessmentWeightSummary(module) }))
      .filter(module => !module.assessmentWeightValid);

    const moduleWeightSummary = getModuleWeightSummary(updatedData.modules);

    return res.json({ success: true, data: updatedData, warnings, ...moduleWeightSummary });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/calculate', async (req, res) => {
  try {
    const gradesData = await loadGradesData();
    const { grades = {}, targetGrade, modules } = req.body;
    const numericTargetGrade = Number.isFinite(Number(targetGrade)) ? Number(targetGrade) : 76;

    let calculationData = gradesData;
    if (Array.isArray(modules)) {
      const validationError = validateEditableModules(modules);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      calculationData = normalizeData({
        year: gradesData.year,
        modules
      });
    }

    res.json(buildResults(calculationData, grades, numericTargetGrade));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stored-data', async (req, res) => {
  try {
    const gradesData = await loadGradesData();
    const targetGrade = req.query.target ? parseFloat(req.query.target) : 76;
    const grades = buildStoredGradesObject(gradesData);
    res.json(buildResults(gradesData, grades, targetGrade, true));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/save-grade', async (req, res) => {
  try {
    const { moduleCode, assessmentIndex, grade } = req.body;
    const gradesData = await loadGradesData();
    const module = gradesData.modules.find(m => m.module_code === moduleCode);

    if (!module || !module.assessments[assessmentIndex]) {
      return res.status(400).json({ success: false, error: 'Module or assessment not found' });
    }

    module.assessments[assessmentIndex].grade = grade;
    await saveGradesData(gradesData);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n${'='.repeat(70)}`);
    console.log('ICL Y3 GRADE CALCULATOR - WEB APPLICATION');
    console.log(`${'='.repeat(70)}`);
    console.log(`\nServer running at http://localhost:${PORT}`);
    console.log(`\nOpen your browser and navigate to: http://localhost:${PORT}`);
    console.log('\nPress Ctrl+C to stop the server\n');
  });
}

module.exports = app;
