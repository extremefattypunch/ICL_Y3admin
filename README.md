# ICL Y3 Grade Calculator

A comprehensive grade calculation system for Imperial College London Year 3 Bioengineering modules (2025-26).

## Overview

This system calculates your final year grade based on individual assessment marks across 9 modules. It handles:
- Weighted assessment calculations within each module
- Final year score calculation based on module weights
- Estimation of required grades for unsubmitted assessments
- Pass/Fail modules (I-EXPLORE)
- Target grade achievement analysis

## Files

- `grades.json` - Contains all module and assessment data
- `grade_calculator.py` - Main calculator application
- `test_calculator.py` - Unit tests for verification

## Getting Started

### Run the Application

```bash
python3 grade_calculator.py
```

This will launch an interactive menu where you can:
1. Input your grades for each assessment
2. View stored module data
3. Exit

## How It Works

### Grade Calculation Formula

The final year grade is calculated as:

```
Final Score = Σ (Module Weight % / 100) × (Module Score / 100)
```

Where **Module Score** for each module is:

```
Module Score = Σ (Assessment Weight % / 100) × (Assessment Grade)
```

### Example Calculation

For BIOE60012 (Foundations of Synthetic Biology):
- Assessment 1: Written exam (67% weight) - You scored 80/100
- Assessment 2: Written report (33% weight) - You scored 75/100

Module Score = (0.67 × 80) + (0.33 × 75) = 53.6 + 24.75 = **78.35/100**

Then this module score contributes to the final grade:
- Contribution = 9.1% × 78.35 = **7.13 points**

## Modules Included

| Code | Module | ECTS | Weight % | Pass Mark |
|------|--------|------|----------|-----------|
| BIOE60012 | Foundations of Synthetic Biology | 5 | 9.1 | 40 |
| BIOE60005 | Bioengineering Group Project | 20 | 36.3 | 40 |
| BIOE60003 | Biomedical Instrumentation | 5 | 9.1 | 40 |
| BIOE60006 | Digital Biosignal Processing | 5 | 9.1 | 40 |
| BIOE60008 | Image Processing | 5 | 9.1 | 40 |
| BIOE60011 | Probability, Statistics and Data Analysis | 5 | 9.1 | 40 |
| BIOE60024 | Modelling in Biology | 5 | 9.1 | 40 |
| I-EXPLORE | I-Explore | 5 | 0 | Pass/Fail |
| BIOE7012 | Biomimetics | 5 | 9.1 | 50 |

**Total ECTS: 75**

## Feature: Missing Grade Estimation

When you haven't submitted all assessments, the calculator can estimate what grade you'd need on the missing ones to achieve your target overall grade.

### How It Works

1. You enter your target grade (e.g., 70)
2. The calculator identifies which assessments have no grade
3. It calculates: "What grade on all missing assessments would get you to 70?"
4. If that estimated grade is 100 or less, it's achievable
5. If you'd need >100, the target is unachievable

### Example

If you've only submitted:
- BIOE60012: Both assessments completed
- Everything else: Not yet submitted

The system will tell you: "You need an average of 76/100 on all missing assessments to achieve a final grade of 70"

## Usage Examples

### Interactive Input Session

```
ICL Y3 GRADE CALCULATOR
=======================================================================

Options:
1. Input grades and calculate final score
2. View stored data
3. Exit

Select option (1-3): 1

Enter desired overall year grade: 70

GRADE INPUT
=======================================================================

Enter grades for each assessment (0-100)
Press Enter to skip (use existing value if available)

BIOE60012: Foundations of Synthetic Biology
  ECTS: 5, Pass Mark: 40
  Module Weight: 9.1%
----------------------------------------------------------------------
  Written exam (67%) - Main exam
    [Existing: None] 
  85  ← You enter 85
  Written report (33%) - Experimental lab report
    [Existing: None]
  78  ← You enter 78
```

### Display of Results

The system will show:
1. **Individual Assessment Marks** - Your entered grades for each assessment
2. **Module Scores** - Calculated weighted scores for each module
3. **Final Year Score** - Your overall calculated grade
4. **Achievement Analysis** - Whether you met your target
5. **Estimation** (if needed) - What grade you need on missing assessments

## Special Cases

### Pass/Fail Modules (I-EXPLORE)

- Enter any grade from 0-100
- Grades ≥50 count as PASS (converted to 100)
- Grades <50 count as FAIL (converted to 0)
- Module weight is 0% (doesn't contribute to final grade)

### Missing Assessments

- If you skip input without providing a grade:
  - System uses existing value if stored
  - If no existing value, marks as missing
- System can still calculate estimates for missing assessments

### When Target Is Unachievable

If all missing assessments are worth 100/100 and you still can't reach your target:
- System will notify: "Target NOT ACHIEVABLE"
- Shows how close you can get (maximum possible score)

## Technical Details

### Grade Data Storage

All grades are stored in `grades.json` with structure:

```json
{
  "year": "2025-26",
  "total_ects": 75,
  "modules": [
    {
      "module_code": "BIOE60012",
      "title": "Foundations of Synthetic Biology",
      "ects": 5,
      "module_weight": 9.1,
      "pass_mark": 40,
      "assessments": [
        {
          "assessment_name": "Written exam",
          "assessment_weight": 67,
          "description": "Main exam",
          "grade": null
        },
        ...
      ]
    },
    ...
  ]
}
```

### Running Tests

```bash
python3 test_calculator.py
```

This verifies:
- Data loading
- Module information retrieval
- Module score calculations
- Final score calculations
- Grade estimation logic

## Requirements

- Python 3.6+
- No external dependencies

## Notes

- All calculations are done to 2 decimal places
- Assessment weights within a module may not always sum to 100% (use actual weights as provided)
- The Pass Mark column indicates the minimum grade needed to pass each module
- For group projects with 0% assessment weight, these represent activities that don't directly affect grading

## Support

For issues or questions about the calculator:
1. Check that your input grades are between 0-100
2. Verify the JSON file has valid module data
3. Ensure you're using Python 3.6 or later
4. Run `test_calculator.py` to verify system functionality
