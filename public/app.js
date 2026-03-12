// Global variables
let modulesData = [];

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

// Render input form with all modules and assessments
function renderInputForm() {
    const formContainer = document.getElementById('inputForm');
    let html = '';

    modulesData.forEach(module => {
        html += `
            <div class="module-section">
                <div class="module-header">
                    <h3>${module.code}: ${module.title}</h3>
                    <div class="module-info">
                        ECTS: ${module.ects} | Weight: ${module.weight}% | Pass Mark: ${module.passMark}
                    </div>
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
        alert('Please enter a valid target grade between 0 and 100');
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
            <h3>Target Grade: ${results.targetGrade.toFixed(2)}</h3>
        </div>
    `;

    // Display each module's results
    results.modules.forEach(module => {
        const isComplete = module.score !== null;
        const scoreClass = isComplete ? '' : 'missing';

        html += `
            <div class="module-result ${isComplete ? '' : 'missing'}">
                <div class="result-header">
                    <h3>${module.code}: ${module.title}</h3>
                    <div class="result-score ${scoreClass}">
                        ${isComplete ? module.score.toFixed(2) : 'INCOMPLETE'}
                    </div>
                </div>
                <div class="module-info" style="margin-bottom: 10px;">
                    ECTS: ${module.ects} | Module Weight: ${module.weight}%
                </div>
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
                    <p>This will help you reach a final grade of ${results.targetGrade.toFixed(2)}</p>
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
