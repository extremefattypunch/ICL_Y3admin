const fs = require('fs');
const path = require('path');

const gradesFile = path.join(__dirname, '..', 'grades.json');
const BLOB_FILE_NAME = 'grades.json';

function getBlobClient() {
  return require('@vercel/blob');
}

function parseNumericValue(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOptionalGrade(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePassMark(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.toLowerCase() === 'pass/fail') return 'pass/fail';
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : trimmed;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

function normalizeAssessment(assessment = {}) {
  return {
    assessment_name: String(assessment.assessment_name ?? '').trim(),
    assessment_weight: parseNumericValue(assessment.assessment_weight),
    description: String(assessment.description ?? '').trim(),
    grade: parseOptionalGrade(assessment.grade)
  };
}

function normalizeModule(module = {}) {
  return {
    module_code: String(module.module_code ?? '').trim(),
    title: String(module.title ?? '').trim(),
    ects: parseNumericValue(module.ects),
    module_weight: parseNumericValue(module.module_weight),
    pass_mark: normalizePassMark(module.pass_mark),
    assessments: Array.isArray(module.assessments)
      ? module.assessments.map(normalizeAssessment)
      : []
  };
}

function computeTotalEcts(modules = []) {
  return modules.reduce((sum, module) => sum + parseNumericValue(module.ects), 0);
}

function normalizeData(data = {}) {
  const modules = Array.isArray(data.modules) ? data.modules.map(normalizeModule) : [];
  return {
    year: String(data.year ?? '').trim(),
    total_ects: computeTotalEcts(modules),
    modules
  };
}

function isBlobStorageEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function loadFromBlob() {
  const { list } = getBlobClient();
  const { blobs } = await list({ prefix: BLOB_FILE_NAME, limit: 10 });
  const blob = blobs.find(item => item.pathname === BLOB_FILE_NAME);

  if (!blob) {
    const localData = normalizeData(JSON.parse(fs.readFileSync(gradesFile, 'utf8')));
    await saveToBlob(localData);
    return localData;
  }

  const response = await fetch(blob.url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load blob data: ${response.status} ${response.statusText}`);
  }

  return normalizeData(await response.json());
}

async function saveToBlob(data) {
  const { put } = getBlobClient();
  const normalized = normalizeData(data);
  await put(BLOB_FILE_NAME, JSON.stringify(normalized, null, 2), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json'
  });
  return normalized;
}

async function loadGradesData() {
  if (isBlobStorageEnabled()) {
    return loadFromBlob();
  }

  return normalizeData(JSON.parse(fs.readFileSync(gradesFile, 'utf8')));
}

async function saveGradesData(data) {
  const normalized = normalizeData(data);

  if (isBlobStorageEnabled()) {
    return saveToBlob(normalized);
  }

  fs.writeFileSync(gradesFile, JSON.stringify(normalized, null, 2));
  return normalized;
}

module.exports = {
  computeTotalEcts,
  loadGradesData,
  normalizeData,
  saveGradesData
};
