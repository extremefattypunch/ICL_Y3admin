// Global variables
let modulesData = [];
let configData = null;
const EDITOR_DRAFT_STORAGE_KEY = 'iclEditorDraftConfig';
const USER_CONFIG_STORAGE_KEY = 'iclUserSavedConfig';
let editorHasUnsavedChanges = false;

function setEditorSaveButtonState(isDirty) {
    const saveButton = document.getElementById('saveConfigBtn');
    if (!saveButton) return;
    saveButton.textContent = isDirty ? 'Save Data' : 'Data Saved';
}

function markEditorDirty() {
    editorHasUnsavedChanges = true;
    setEditorSaveButtonState(true);
}

function markEditorSaved() {
    editorHasUnsavedChanges = false;
    setEditorSaveButtonState(false);
}

function getSavedGradesFromStorage() {
    try {
        const parsed = JSON.parse(localStorage.getItem('iclSavedGrades') || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        return {};
    }
}

function setSavedGradeInStorage(key, value) {
    const savedGrades = getSavedGradesFromStorage();
    if (value === null || value === undefined || value === '') {
        savedGrades[key] = null;
    } else {
        savedGrades[key] = value;
    }
    localStorage.setItem('iclSavedGrades', JSON.stringify(savedGrades));
}

function getEditorDraftFromStorage() {
    try {
        const parsed = JSON.parse(localStorage.getItem(EDITOR_DRAFT_STORAGE_KEY) || 'null');
        if (!parsed || typeof parsed !== 'object') return null;
        if (!Array.isArray(parsed.modules)) return null;
        return parsed;
    } catch (error) {
        return null;
    }
}

function saveEditorDraftToStorage() {
    if (!configData || !Array.isArray(configData.modules)) return;
    localStorage.setItem(EDITOR_DRAFT_STORAGE_KEY, JSON.stringify(configData));
}

function clearEditorDraftFromStorage() {
    localStorage.removeItem(EDITOR_DRAFT_STORAGE_KEY);
}

function getSavedUserConfigFromStorage() {
    try {
        const parsed = JSON.parse(localStorage.getItem(USER_CONFIG_STORAGE_KEY) || 'null');
        if (!parsed || typeof parsed !== 'object') return null;
        if (!Array.isArray(parsed.modules)) return null;
        return parsed;
    } catch (error) {
        return null;
    }
}

function saveUserConfigToStorage(modules) {
    if (!Array.isArray(modules)) return;
    localStorage.setItem(USER_CONFIG_STORAGE_KEY, JSON.stringify({ modules }));
}

function buildModulesResponseFromConfigModules(modules) {
    const moduleWeightTotal = modules.reduce(
        (sum, module) => sum + Number(module.module_weight || 0),
        0
    );
    const moduleWeightValid = Math.abs(moduleWeightTotal - 100) < 0.01;

    const payload = modules.map(module => {
        const assessments = Array.isArray(module.assessments) ? module.assessments : [];
        const assessmentWeightTotal = assessments.reduce(
            (sum, assessment) => sum + Number(assessment.assessment_weight || 0),
            0
        );
        const assessmentWeightValid = Math.abs(assessmentWeightTotal - 100) < 0.01;

        return {
            code: module.module_code,
            title: module.title,
            ects: module.ects,
            weight: module.module_weight,
            passMark: module.pass_mark,
            assessmentWeightTotal,
            assessmentWeightValid,
            assessmentWeightWarning: assessmentWeightValid
                ? null
                : `Assessment weights total ${assessmentWeightTotal}% instead of 100%.`,
            assessments: assessments.map((assessment, index) => ({
                index,
                name: assessment.assessment_name,
                weight: assessment.assessment_weight,
                description: assessment.description,
                grade: assessment.grade ?? null
            }))
        };
    });

    payload.moduleWeightTotal = moduleWeightTotal;
    payload.moduleWeightValid = moduleWeightValid;
    payload.moduleWeightWarning = moduleWeightValid
        ? null
        : `Module weights total ${moduleWeightTotal}% across all modules instead of 100%.`;

    return payload;
}

// Initialize app on page load
document.addEventListener('DOMContentLoaded', function() {
    loadModules();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            switchPage(this.dataset.page);
        });
    });

    // Initial load of stored data
    loadStoredData();
}

// Switch between pages
function switchPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // Show selected page
    const selectedPage = document.getElementById(pageName);
    if (selectedPage) {
        selectedPage.classList.add('active');
    }

    // Update active nav button
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll(`[data-page="${pageName}"]`).forEach(btn => {
        btn.classList.add('active');
    });

    // Refresh data if viewing stored data
    if (pageName === 'stored') {
        loadStoredData();
    }

    if (pageName === 'editor') {
        loadConfigEditor();
    }
}

// Load modules from server
function loadModules() {
    const savedConfig = getSavedUserConfigFromStorage();
    if (savedConfig) {
        modulesData = buildModulesResponseFromConfigModules(savedConfig.modules);
        renderInputForm();
        return;
    }

    fetch('/api/modules')
        .then(response => response.json())
        .then(data => {
            modulesData = data.modules;
            modulesData.moduleWeightTotal = data.moduleWeightTotal;
            modulesData.moduleWeightValid = data.moduleWeightValid;
            modulesData.moduleWeightWarning = data.moduleWeightWarning;
            renderInputForm();
        })
        .catch(error => {
            console.error('Error loading modules:', error);
            alert('Failed to load modules. Please refresh the page.');
        });
}

function loadConfigEditor() {
    const editorDraft = getEditorDraftFromStorage();
    if (editorDraft) {
        configData = editorDraft;
        markEditorDirty();
        renderConfigEditor();
        return;
    }

    const savedConfig = getSavedUserConfigFromStorage();
    if (savedConfig) {
        configData = savedConfig;
        markEditorSaved();
        renderConfigEditor();
        return;
    }

    fetch('/api/config')
        .then(response => response.json())
        .then(data => {
            configData = data;
            markEditorSaved();
            renderConfigEditor();
        })
        .catch(error => {
            console.error('Error loading config:', error);
            setEditorStatus('Failed to load editable data.', 'danger');
        });
}

function setEditorStatus(message, type = 'success') {
    const statusDiv = document.getElementById('editorStatus');
    if (!message) {
        statusDiv.innerHTML = '';
        return;
    }

    statusDiv.innerHTML = `<div class="status-message status-${type}">${message}</div>`;
}

function computeAssessmentWeightTotal(module) {
    return module.assessments.reduce((sum, assessment) => sum + (parseFloat(assessment.assessment_weight) || 0), 0);
}

function renderEditorWarnings() {
    const warningsDiv = document.getElementById('editorWarnings');
    if (!configData || !configData.modules) {
        warningsDiv.innerHTML = '';
        return;
    }

    const warnings = configData.modules
        .map((module, index) => {
            const total = computeAssessmentWeightTotal(module);
            return {
                index,
                code: module.module_code || `Module ${index + 1}`,
                total,
                valid: Math.abs(total - 100) < 0.01
            };
        })
        .filter(item => !item.valid);

    const moduleWeightTotal = configData.modules.reduce(
        (sum, module) => sum + (parseFloat(module.module_weight) || 0),
        0
    );
    const hasModuleWeightWarning = Math.abs(moduleWeightTotal - 100) >= 0.01;

    if (warnings.length === 0 && !hasModuleWeightWarning) {
        warningsDiv.innerHTML = '';
        return;
    }

    warningsDiv.innerHTML = `
        <div class="status-message status-warning">
            <strong>Warning:</strong> Some modules do not have assessment weights summing to 100%.
            ${hasModuleWeightWarning ? `<p class="warning-paragraph">Module weights across all modules total ${moduleWeightTotal}% instead of 100%.</p>` : ''}
            <ul class="warning-list">
                ${warnings.map(item => `<li>${item.code}: ${item.total}%</li>`).join('')}
            </ul>
        </div>
    `;
}

function buildModuleWeightWarningHtml(total, warning) {
    if (warning === null || warning === undefined) {
        return '';
    }

    return `
        <div class="status-message status-warning global-warning">
            ⚠️ Module weights across all modules total ${total}% instead of 100%.
        </div>
    `;
}

function renderConfigEditor() {
    const formContainer = document.getElementById('editorForm');
    if (!configData || !configData.modules) {
        formContainer.innerHTML = '<div class="status-message status-warning">No editable data loaded.</div>';
        return;
    }

    renderEditorWarnings();

    let html = '';

    configData.modules.forEach((module, moduleIndex) => {
        const weightTotal = computeAssessmentWeightTotal(module);
        const weightWarning = Math.abs(weightTotal - 100) < 0.01 ? '' : `
            <div class="module-warning">
                ⚠️ Assessment weights total ${weightTotal}% for this module, not 100%.
            </div>
        `;

        html += `
            <div class="editor-module-card">
                <div class="editor-module-header">
                    <h3>Module ${moduleIndex + 1}</h3>
                    <button class="btn btn-danger" onclick="removeModule(${moduleIndex})">Delete Module</button>
                </div>

                <div class="editor-grid">
                    <div class="form-group">
                        <label>Module Code</label>
                        <input type="text" value="${escapeHtml(module.module_code || '')}" onchange="updateModuleField(${moduleIndex}, 'module_code', this.value)">
                    </div>
                    <div class="form-group">
                        <label>Module Title</label>
                        <input type="text" value="${escapeHtml(module.title || '')}" onchange="updateModuleField(${moduleIndex}, 'title', this.value)">
                    </div>
                    <div class="form-group">
                        <label>ECTS</label>
                        <input type="number" step="0.1" value="${module.ects ?? 0}" onchange="updateModuleField(${moduleIndex}, 'ects', this.value)">
                    </div>
                    <div class="form-group">
                        <label>Module Weight %</label>
                        <input type="number" step="0.1" value="${module.module_weight ?? 0}" onchange="updateModuleField(${moduleIndex}, 'module_weight', this.value)">
                    </div>
                    <div class="form-group">
                        <label>Pass Mark</label>
                        <input type="text" value="${escapeHtml(String(module.pass_mark ?? ''))}" onchange="updateModuleField(${moduleIndex}, 'pass_mark', this.value)">
                    </div>
                    <div class="form-group">
                        <label>Assessment Weight Total</label>
                        <input type="text" value="${weightTotal}%" disabled>
                    </div>
                </div>

                ${weightWarning}

                <div class="editor-assessment-list">
                    ${module.assessments.map((assessment, assessmentIndex) => `
                        <div class="editor-assessment-card">
                            <div class="editor-assessment-header">
                                <h4>Assessment ${assessmentIndex + 1}</h4>
                                <button class="btn btn-danger btn-small" onclick="removeAssessment(${moduleIndex}, ${assessmentIndex})">Delete Item</button>
                            </div>
                            <div class="editor-grid editor-grid-assessment">
                                <div class="form-group">
                                    <label>Name</label>
                                    <input type="text" value="${escapeHtml(assessment.assessment_name || '')}" onchange="updateAssessmentField(${moduleIndex}, ${assessmentIndex}, 'assessment_name', this.value)">
                                </div>
                                <div class="form-group">
                                    <label>Weight %</label>
                                    <input type="number" step="0.1" value="${assessment.assessment_weight ?? 0}" onchange="updateAssessmentField(${moduleIndex}, ${assessmentIndex}, 'assessment_weight', this.value)">
                                </div>
                                <div class="form-group">
                                    <label>Grade</label>
                                    <input type="number" step="0.1" value="${assessment.grade ?? ''}" placeholder="Leave blank for null" onchange="updateAssessmentField(${moduleIndex}, ${assessmentIndex}, 'grade', this.value)">
                                </div>
                                <div class="form-group editor-description-field">
                                    <label>Description</label>
                                    <input type="text" value="${escapeHtml(assessment.description || '')}" onchange="updateAssessmentField(${moduleIndex}, ${assessmentIndex}, 'description', this.value)">
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <button class="btn btn-primary" onclick="addAssessment(${moduleIndex})">Add Item</button>
            </div>
        `;
    });

    formContainer.innerHTML = html;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function updateModuleField(moduleIndex, field, value) {
    if (!configData) return;
    const numericFields = ['ects', 'module_weight'];
    configData.modules[moduleIndex][field] = numericFields.includes(field)
        ? (value === '' ? 0 : parseFloat(value))
        : value;
    markEditorDirty();
    saveEditorDraftToStorage();
    renderConfigEditor();
}

function updateAssessmentField(moduleIndex, assessmentIndex, field, value) {
    if (!configData) return;
    if (field === 'assessment_weight') {
        configData.modules[moduleIndex].assessments[assessmentIndex][field] = value === '' ? 0 : parseFloat(value);
    } else if (field === 'grade') {
        configData.modules[moduleIndex].assessments[assessmentIndex][field] = value === '' ? null : parseFloat(value);
    } else {
        configData.modules[moduleIndex].assessments[assessmentIndex][field] = value;
    }
    markEditorDirty();
    saveEditorDraftToStorage();
    renderConfigEditor();
}

function addModule() {
    if (!configData) {
        configData = { modules: [] };
    }

    configData.modules.push({
        module_code: '',
        title: '',
        ects: 5,
        module_weight: 0,
        pass_mark: 40,
        assessments: [
            {
                assessment_name: '',
                assessment_weight: 100,
                description: '',
                grade: null
            }
        ]
    });

    markEditorDirty();
    saveEditorDraftToStorage();
    renderConfigEditor();
}

function removeModule(moduleIndex) {
    if (!configData) return;
    configData.modules.splice(moduleIndex, 1);
    markEditorDirty();
    saveEditorDraftToStorage();
    renderConfigEditor();
}

function addAssessment(moduleIndex) {
    if (!configData) return;
    configData.modules[moduleIndex].assessments.push({
        assessment_name: '',
        assessment_weight: 0,
        description: '',
        grade: null
    });
    markEditorDirty();
    saveEditorDraftToStorage();
    renderConfigEditor();
}

function removeAssessment(moduleIndex, assessmentIndex) {
    if (!configData) return;
    configData.modules[moduleIndex].assessments.splice(assessmentIndex, 1);
    markEditorDirty();
    saveEditorDraftToStorage();
    renderConfigEditor();
}

function saveConfig() {
    if (!configData) {
        setEditorStatus('No editable data loaded.', 'warning');
        return;
    }

    saveUserConfigToStorage(configData.modules);
    clearEditorDraftFromStorage();
    markEditorSaved();
    setEditorStatus('Changes saved and applied in this browser.', 'success');
    loadModules();
    loadStoredData();

    fetch('/api/config', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            modules: configData.modules
        })
    })
    .then(async response => {
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to save changes.');
        }
        return data;
    })
    .then(data => {
        configData = data.data;
        saveUserConfigToStorage(data.data.modules);
        clearEditorDraftFromStorage();
        markEditorSaved();
        setEditorStatus('Data saved and synced successfully.', 'success');
        renderConfigEditor();
        loadModules();
        loadStoredData();
    })
    .catch(error => {
        console.error('Error saving config:', error);
        setEditorStatus(
            'Changes are saved and working in this browser. Cloud sync is unavailable on this deployment.',
            'success'
        );
    });
}

// Render input form with all modules and assessments
function renderInputForm() {
    const formContainer = document.getElementById('inputForm');
    const savedGrades = getSavedGradesFromStorage();
    let html = buildModuleWeightWarningHtml(
        modulesData.moduleWeightTotal,
        modulesData.moduleWeightWarning
    );

    modulesData.forEach(module => {
        const weightWarningHtml = module.assessmentWeightValid
            ? ''
            : `
                <div class="module-warning">
                    ⚠️ Assessment weights total ${module.assessmentWeightTotal}% for this module, not 100%.
                </div>
            `;

        html += `
            <div class="module-section">
                <div class="module-header">
                    <h3>${module.code}: ${module.title}</h3>
                    <div class="module-info">
                        ECTS: ${module.ects} | Weight: ${module.weight}% | Pass Mark: ${module.passMark} | Assessment Total: ${module.assessmentWeightTotal}%
                    </div>
                    ${weightWarningHtml}
                </div>
        `;

        module.assessments.forEach((assessment, idx) => {
            const gradeKey = `${module.code}_${idx}`;
            const storedGrade = savedGrades[gradeKey];
            const existingGrade = storedGrade !== null && storedGrade !== undefined
                ? storedGrade
                : (assessment.grade !== null && assessment.grade !== undefined ? assessment.grade : '');
            html += `
                <div class="assessment-group">
                    <div class="assessment-label">
                        <label>${assessment.name}</label>
                        <span class="assessment-weight">${assessment.weight}%</span>
                    </div>
                    <div class="assessment-desc">${assessment.description}</div>
                    <input 
                        type="number" 
                        id="grade_${module.code}_${idx}"
                        min="0" 
                        max="100" 
                        step="0.1"
                        placeholder="Enter grade (0-100)"
                        value="${existingGrade}"
                    >
                </div>
            `;
        });

        html += '</div>';
    });

    formContainer.innerHTML = html;

    modulesData.forEach(module => {
        module.assessments.forEach((assessment, idx) => {
            const inputId = `grade_${module.code}_${idx}`;
            const inputElement = document.getElementById(inputId);
            if (!inputElement) return;

            inputElement.addEventListener('change', function() {
                const rawValue = this.value.trim();
                if (rawValue === '') {
                    setSavedGradeInStorage(`${module.code}_${idx}`, null);
                    return;
                }

                const parsed = parseFloat(rawValue);
                if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
                    setSavedGradeInStorage(`${module.code}_${idx}`, parsed);
                }
            });
        });
    });
}

// Submit grades and calculate results
function submitGrades() {
    const targetGrade = parseFloat(document.getElementById('targetGradeInput').value);

    if (isNaN(targetGrade) || targetGrade < 0 || targetGrade > 100) {
        alert('Please enter a valid desired final year grade between 0 and 100');
        return;
    }

    // Collect grades from form
    const grades = {};
    modulesData.forEach(module => {
        module.assessments.forEach((assessment, idx) => {
            const inputId = `grade_${module.code}_${idx}`;
            const inputElement = document.getElementById(inputId);
            const value = inputElement.value.trim();

            if (value !== '') {
                const grade = parseFloat(value);
                if (!isNaN(grade) && grade >= 0 && grade <= 100) {
                    grades[`${module.code}_${idx}`] = grade;
                } else {
                    alert(`Invalid grade for ${assessment.name}`);
                    return;
                }
            } else {
                grades[`${module.code}_${idx}`] = null;
            }
        });
    });

    // Save grades locally — works on Vercel without server-side persistence
    localStorage.setItem('iclSavedGrades', JSON.stringify(grades));
    localStorage.setItem('iclSavedTargetGrade', String(targetGrade));
    document.getElementById('storedTargetGrade').value = targetGrade;
    switchPage('stored');
}

// Load and display stored data
function loadStoredData() {
    const targetGrade = parseFloat(document.getElementById('storedTargetGrade').value) || 77;
    const savedGrades = JSON.parse(localStorage.getItem('iclSavedGrades') || '{}');
    const savedConfig = getSavedUserConfigFromStorage();
    const requestBody = { grades: savedGrades, targetGrade: targetGrade };

    if (savedConfig && Array.isArray(savedConfig.modules)) {
        requestBody.modules = savedConfig.modules;
    }

    fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    })
    .then(response => response.json())
    .then(results => {
        displayStoredDataResults({ ...results, targetGrade: targetGrade });
    })
    .catch(error => {
        console.error('Error loading stored data:', error);
    });
}

function toggleMinimumGradeInfo() {
    const panel = document.getElementById('minimumGradeInfoPanel');
    const button = document.getElementById('minimumGradeInfoToggle');
    if (!panel || !button) return;

    const isHidden = panel.hasAttribute('hidden');
    if (isHidden) {
        panel.removeAttribute('hidden');
        button.setAttribute('aria-expanded', 'true');
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise([panel]).catch(() => {});
        }
    } else {
        panel.setAttribute('hidden', 'hidden');
        button.setAttribute('aria-expanded', 'false');
    }
}

// Display stored data results
function displayStoredDataResults(results) {
    const resultsDiv = document.getElementById('storedResults');
    let html = `
        <div class="page-header" style="border: none; padding: 0;">
            <h3>Target Final Year Grade: ${results.targetGrade.toFixed(2)}</h3>
        </div>
    `;

    html += buildModuleWeightWarningHtml(results.moduleWeightTotal, results.moduleWeightWarning);

    // Display each module's results
    results.modules.forEach(module => {
        const isComplete = module.score !== null;
        const scoreClass = isComplete ? '' : 'missing';
        const weightWarningHtml = module.assessmentWeightValid
            ? ''
            : `
                <div class="module-warning" style="margin-bottom: 10px;">
                    ⚠️ Assessment weights total ${module.assessmentWeightTotal}% for this module, not 100%.
                </div>
            `;

        html += `
            <div class="module-result ${isComplete ? '' : 'missing'}">
                <div class="result-header">
                    <h3>${module.code}: ${module.title}</h3>
                    <div class="result-score ${scoreClass}">
                        ${isComplete ? module.score.toFixed(2) : 'INCOMPLETE'}
                    </div>
                </div>
                <div class="module-info" style="margin-bottom: 10px;">
                    ECTS: ${module.ects} | Module Weight: ${module.weight}% | Assessment Total: ${module.assessmentWeightTotal}%
                </div>
                ${weightWarningHtml}
        `;

        module.assessments.forEach(assessment => {
            const gradeDisplay = assessment.grade !== null && assessment.grade !== undefined 
                ? assessment.grade.toFixed(2) 
                : 'NOT PROVIDED';
            const gradeClass = assessment.grade !== null ? '' : 'missing';

            html += `
                <div class="assessment-result">
                    <span class="assessment-name">
                        ${assessment.name} (${assessment.weight}%) - ${assessment.description}
                    </span>
                    <span class="assessment-value ${gradeClass}">${gradeDisplay}</span>
                </div>
            `;
        });

        html += '</div>';
    });

    // Final score section
    if (results.finalScore !== null) {
        html += `
            <div class="final-score-box">
                <h3>Final Year Score</h3>
                <div class="final-score-value">${results.finalScore.toFixed(2)}</div>
            </div>
        `;
    } else {
        html += `
            <div class="status-message status-warning">
                ⚠️ Cannot calculate final score - missing grades in modules: ${results.missingModules.join(', ')}
            </div>
            <div class="module-result">
                <h3>Modules with Complete Data</h3>
        `;

        if (results.completeModules.length > 0) {
            results.completeModules.forEach(moduleCode => {
                const module = results.modules.find(m => m.code === moduleCode);
                html += `
                    <div class="assessment-result">
                        <span class="assessment-name">${module.code}: ${module.title}</span>
                        <span class="assessment-value">${module.score.toFixed(2)}</span>
                    </div>
                `;
            });
        } else {
            html += '<p style="color: var(--text-light);">No modules with complete data</p>';
        }

        html += '</div>';

        if (results.estimatedGrade !== null) {
            html += `
                <div class="estimated-box">
                    <div class="estimated-header">
                        <h4>📊 Minimum Required for Missing Assessments</h4>
                        <button
                            id="minimumGradeInfoToggle"
                            class="info-toggle"
                            type="button"
                            onclick="toggleMinimumGradeInfo()"
                            aria-expanded="false"
                            title="Show calculation details"
                        >ⓘ</button>
                    </div>
                    <p>Minimum average needed across all missing assessments:</p>
                    <div class="estimated-value">${results.estimatedGrade}/100</div>
                    <div id="minimumGradeInfoPanel" class="calc-info-panel" hidden>
                        <p><strong>How this is calculated (exactly):</strong></p>
                        <p>The app tests every integer grade from 0 to 100 for all missing assessments. The first grade that reaches your desired final year grade is shown.</p>
                        <p><strong>Variables used:</strong></p>
                        <ul>
                            <li><strong>\\(g\\)</strong>: trial grade percentage in brackets \\([0,100]\\), applied to every missing assessment.</li>
                            <li><strong>\\(W_m\\)</strong>: module weight percentage for module \\(m\\).</li>
                            <li><strong>\\(w_{m,k}\\)</strong>: assessment weight percentage for assessment \\(k\\) inside module \\(m\\).</li>
                            <li><strong>\\(a_{m,k}\\)</strong>: known assessment grade percentage for assessment \\(k\\) in module \\(m\\).</li>
                            <li><strong>\\(S_m(g)\\)</strong>: module grade percentage for module \\(m\\), after replacing missing assessments by \\(g\\).</li>
                            <li><strong>\\(F(g)\\)</strong>: final year grade percentage from all module grades and module weights.</li>
                        </ul>
                        <p class="calc-equation">$$S_m(g)=\\sum_{k\\in K_m}\\left(\\frac{w_{m,k}}{100}a_{m,k}\\right)+\\sum_{k\\in M_m}\\left(\\frac{w_{m,k}}{100}g\\right)$$</p>
                        <p class="calc-equation">$$F(g)=\\sum_m\\left(\\frac{W_m}{100}S_m(g)\\right)$$</p>
                        <p class="calc-equation">$$g^*=\\min\\left\\{g\\in\\{0,1,2,\\ldots,100\\}:F(g)\\ge target\\_grade-0.01\\right\\}$$</p>
                        <p><strong>Sample calculation:</strong></p>
                        <p>Use two modules with explicit bracketed module-weight terms:</p>
                        <p class="calc-equation">$$F(g)=\\left[\\frac{W_1}{100}S_1(g)\\right]+\\left[\\frac{W_2}{100}S_2(g)\\right]$$</p>
                        <p>Here, \\(W_1\\) is the module weight percentage of Module 1 and \\(W_2\\) is the module weight percentage of Module 2. In this sample, \\(W_1=60\\), \\(W_2=40\\), and desired final year grade \\(=77\\).</p>
                        <p>Module 1: known assessments contribute \\(50\\%\\) at grade \\(72\\), missing assessments contribute \\(50\\%\\) at trial grade \\(g\\):</p>
                        <p class="calc-equation">$$S_1(g)=\\left[\\frac{50}{100}\\cdot72\\right]+\\left[\\frac{50}{100}\\cdot g\\right]=36+0.5g$$</p>
                        <p>Module 2: known assessments contribute \\(70\\%\\) at grade \\(68\\), missing assessments contribute \\(30\\%\\) at trial grade \\(g\\):</p>
                        <p class="calc-equation">$$S_2(g)=\\left[\\frac{70}{100}\\cdot68\\right]+\\left[\\frac{30}{100}\\cdot g\\right]=47.6+0.3g$$</p>
                        <p class="calc-equation">$$F(g)=\\left[\\frac{60}{100}(36+0.5g)\\right]+\\left[\\frac{40}{100}(47.6+0.3g)\\right]=40.64+0.42g$$</p>
                        <p class="calc-equation">$$40.64+0.42g\\ge77\\Rightarrow g\\ge\\frac{77-40.64}{0.42}=86.57$$</p>
                        <p class="calc-equation">$$g^*=87$$</p>
                    </div>
                    <p>This will help you reach a final year grade of ${results.targetGrade.toFixed(2)}</p>
                </div>
            `;
        } else {
            html += `
                <div class="status-message status-danger">
                    ❌ Target of ${results.targetGrade.toFixed(2)} is NOT ACHIEVABLE even with perfect grades
                </div>
            `;
        }
    }

    resultsDiv.innerHTML = html;

    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([resultsDiv]).catch(() => {});
    }
}

// Save individual grade to server
function saveGrade(moduleCode, assessmentIndex, grade) {
    return fetch('/api/save-grade', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            moduleCode: moduleCode,
            assessmentIndex: assessmentIndex,
            grade: grade
        })
    })
    .catch(error => {
        console.error('Error saving grade:', error);
        throw error;
    });
}
