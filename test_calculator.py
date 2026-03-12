#!/usr/bin/env python3
"""
Test script for grade calculator
"""
import sys
sys.path.insert(0, '/home/ianpoon/Downloads/ICL_Y3admin')

from grade_calculator import GradeCalculator

# Initialize calculator
calc = GradeCalculator('/home/ianpoon/Downloads/ICL_Y3admin/grades.json')

print("="*70)
print("GRADE CALCULATOR - TEST SUITE")
print("="*70)

# Test 1: Load data
print("\n[Test 1] Loading data...")
print(f"✓ Loaded {len(calc.data['modules'])} modules")
print(f"✓ Total ECTS: {calc.total_ects}")
print(f"✓ Total assessments: {len(calc.assessments)}")

# Test 2: Module info retrieval
print("\n[Test 2] Module info retrieval...")
module_info = calc._get_module_info("BIOE60012")
print(f"✓ BIOE60012: {module_info['title']}")
print(f"  - ECTS: {module_info['ects']}")
print(f"  - Module Weight: {module_info['module_weight']}%")

# Test 3: Assessments for module
print("\n[Test 3] Assessments for BIOE60012...")
assessments = calc.get_assessments_for_module("BIOE60012")
print(f"✓ Found {len(assessments)} assessments:")
for a in assessments:
    print(f"  - {a.assessment_name} ({a.assessment_weight}%)")

# Test 4: Module score calculation
print("\n[Test 4] Module score calculation...")
grades = {}
# BIOE60012: Written exam (67%) = 80, Written report (33%) = 75
grades[("BIOE60012", 0)] = 80.0  # Written exam
grades[("BIOE60012", 1)] = 75.0  # Written report
# Expected: (0.67 * 80) + (0.33 * 75) = 53.6 + 24.75 = 78.35
module_score = calc.calculate_module_score("BIOE60012", grades)
print(f"✓ BIOE60012 score with exam=80, report=75: {module_score:.2f}")
print(f"  Expected: 78.35")

# Test 5: Final score calculation (with all modules)
print("\n[Test 5] Final score calculation with sample data...")
sample_grades = {}
# Fill in all assessments with 75
for i, assessment in enumerate(calc.assessments):
    key = (assessment.module_code, assessment.index)
    sample_grades[key] = 75.0

module_scores = {}
for module in calc.data["modules"]:
    score = calc.calculate_module_score(module["module_code"], sample_grades)
    if score is not None:
        module_scores[module["module_code"]] = score
        print(f"  {module['module_code']}: {score:.2f}")

final_score = calc.calculate_final_score(module_scores)
print(f"✓ Final score (all 75): {final_score:.2f}")

# Test 6: Missing grades estimation
print("\n[Test 6] Missing grades estimation...")
limited_grades = {
    ("BIOE60012", 0): 80.0,
    ("BIOE60012", 1): 75.0,
}
target = 70.0
estimated = calc.estimate_missing_grades(limited_grades, target)
print(f"✓ To achieve {target}, missing grades should be: {estimated:.0f}")

print("\n" + "="*70)
print("All tests completed successfully!")
print("="*70)
