// Global variables
let modulesData = [];
let configData = null;

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
    document.querySelector(`[data-page="${pageName}"]`).classList.add('active');

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
    fetch('/api/modules')
        .then(response => response.json())
        .then(data => {
            modulesData = data;
            renderInputForm();
        })
        .catch(error => {
            console.error('Error loading modules:', error);
            alert('Failed to load modules. Please refresh the page.');
        });
}

function loadConfigEditor() {
    fetch('/api/config')
        .then(response => response.json())
        .then(data => {
            configData = data;
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

    if (warnings.length === 0) {
        warningsDiv.innerHTML = '';
        return;
    }

    warningsDiv.innerHTML = `
        <div class="status-message status-warning">
            <strong>Warning:</strong> Some modules do not have assessment weights summing to 100%.
            <ul class="warning-list">
                ${warnings.map(item => `<li>${item.code}: ${item.total}%</li>`).join('')}
            </ul>
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

    renderConfigEditor();
}

function removeModule(moduleIndex) {
    if (!configData) return;
    configData.modules.splice(moduleIndex, 1);
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
    renderConfigEditor();
}

function removeAssessment(moduleIndex, assessmentIndex) {
    if (!configData) return;
    configData.modules[moduleIndex].assessments.splice(assessmentIndex, 1);
    renderConfigEditor();
}

function saveConfig() {
    if (!configData) {
        setEditorStatus('No editable data loaded.', 'warning');
        return;
    }

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
        setEditorStatus('Data saved successfully.', 'success');
        renderConfigEditor();
        loadModules();
        loadStoredData();
    })
    .catch(error => {
        console.error('Error saving config:', error);
        setEditorStatus(error.message || 'Failed to save changes.', 'danger');
    });
}

// Render input form with all modules and assessments
function renderInputForm() {
    const formContainer = document.getElementById('inputForm');
    let html = '';

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
            const existingGrade = assessment.grade !== null && assessment.grade !== undefined ? assessment.grade : '';
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

    // Send to server for calculation
    fetch('/api/calculate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            grades: grades,
            targetGrade: targetGrade
        })
    })
    .then(response => response.json())
    .then(results => {
        const saveRequests = Object.keys(grades)
            .map(key => {
                const [moduleCode, idx] = key.split('_');
                return saveGrade(moduleCode, parseInt(idx, 10), grades[key]);
            });

        return Promise.all(saveRequests)
            .then(() => {
                document.getElementById('storedTargetGrade').value = targetGrade;
                switchPage('stored');
            });
    })
    .catch(error => {
        console.error('Error calculating grades:', error);
        alert('Failed to calculate grades. Please try again.');
    });
}

// Load and display stored data
function loadStoredData() {
    const targetGrade = parseFloat(document.getElementById('storedTargetGrade').value) || 76;

    fetch(`/api/stored-data?target=${targetGrade}`)
        .then(response => response.json())
        .then(results => {
            displayStoredDataResults(results);
        })
        .catch(error => {
            console.error('Error loading stored data:', error);
        });
}

// Display stored data results
function displayStoredDataResults(results) {
    const resultsDiv = document.getElementById('storedResults');
    let html = `
        <div class="page-header" style="border: none; padding: 0;">
            <h3>Target Final Year Grade: ${results.targetGrade.toFixed(2)}</h3>
        </div>
    `;

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
                    <h4>📊 To Achieve Your Target</h4>
                    <p>All missing assessments should average:</p>
                    <div class="estimated-value">${results.estimatedGrade}/100</div>
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
