#!/usr/bin/env python3
"""
Grade Calculator for ICL Y3 Admin
Calculates final year grade based on module assessments
"""

import json
import os
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
import copy

@dataclass
class Assessment:
    module_code: str
    assessment_name: str
    assessment_weight: float
    description: str
    grade: Optional[float] = None
    index: int = 0  # Index within module for unique identification

class GradeCalculator:
    def __init__(self, json_file: str = "grades.json"):
        self.json_file = json_file
        self.data = self._load_data()
        self.assessments = self._flatten_assessments()
        self.total_ects = sum(m["ects"] for m in self.data["modules"])
        self.user_grades = copy.deepcopy(self.assessments)
        
    def _load_data(self) -> dict:
        """Load grade data from JSON file"""
        with open(self.json_file, 'r') as f:
            return json.load(f)
    
    def _flatten_assessments(self) -> List[Assessment]:
        """Flatten module structure into individual assessments"""
        assessments = []
        for module in self.data["modules"]:
            module_code = module["module_code"]
            for idx, assessment in enumerate(module["assessments"]):
                assessments.append(Assessment(
                    module_code=module_code,
                    assessment_name=assessment["assessment_name"],
                    assessment_weight=assessment["assessment_weight"],
                    description=assessment["description"],
                    grade=assessment.get("grade"),
                    index=idx
                ))
        return assessments
    
    def _get_module_info(self, module_code: str) -> Optional[dict]:
        """Get module information by code"""
        for module in self.data["modules"]:
            if module["module_code"] == module_code:
                return module
        return None
    
    def get_assessments_for_module(self, module_code: str) -> List[Assessment]:
        """Get all assessments for a specific module"""
        return [a for a in self.assessments if a.module_code == module_code]
    
    def _validate_weights_for_module(self, module_code: str) -> bool:
        """Check if assessment weights for a module sum to 100"""
        assessments = self.get_assessments_for_module(module_code)
        total_weight = sum(a.assessment_weight for a in assessments)
        return abs(total_weight - 100) < 0.01
    
    def calculate_module_score(self, module_code: str, grades: Dict[Tuple[str,int], float]) -> Optional[float]:
        """
        Calculate module score as: sum(assessment_weight * grade) / 100
        Returns None if any required grade is missing
        """
        assessments = self.get_assessments_for_module(module_code)
        
        # Check for pass/fail module
        module_info = self._get_module_info(module_code)
        if module_info and module_info["pass_mark"] == "pass/fail":
            # For pass/fail, grade should be 0 or 100
            key = (module_code, 0)
            if key in grades:
                grade = grades[key]
                if grade is not None:
                    return 100 if grade >= 50 else 0
            return None
        
        # Only consider assessments with non-zero weight
        scored_assessments = [a for a in assessments if a.assessment_weight > 0]
        total_weight = sum(a.assessment_weight for a in scored_assessments)
        if total_weight == 0:
            return None

        total_weighted_score = 0
        all_grades_present = True

        for assessment in scored_assessments:
            key = (assessment.module_code, assessment.index)
            grade = grades.get(key)

            if grade is None:
                all_grades_present = False
            else:
                # Normalize by actual weight sum so scores always reflect true performance
                weighted_contribution = (assessment.assessment_weight / total_weight) * grade
                total_weighted_score += weighted_contribution

        if not all_grades_present:
            return None

        return total_weighted_score
    
    def calculate_final_score(self, module_scores: Dict[str, float]) -> Optional[float]:
        """
        Calculate final year score
        formula: sum((module_weight% / 100) * module_score)
        where module_weight% are the pre-defined weights that sum to 100
        """
        final_score = 0
        all_scores_present = True
        
        for module in self.data["modules"]:
            # Pass/fail modules don't contribute to the final score
            if module["pass_mark"] == "pass/fail":
                continue

            module_code = module["module_code"]
            module_score = module_scores.get(module_code)
            
            if module_score is None:
                all_scores_present = False
            else:
                module_weight = module["module_weight"] / 100
                contribution = module_weight * module_score
                final_score += contribution
        
        if not all_scores_present:
            return None
        
        return final_score
    
    def estimate_missing_grades(self, grades: Dict[Tuple[str,int], float], 
                               target_grade: float) -> Optional[float]:
        """
        Estimate a grade that all missing assessments should have to meet target
        Returns the estimated grade, or None if target is unachievable
        """
        # Create copy of grades to work with
        test_grades = grades.copy()
        
        # Find all missing grades, excluding pass/fail modules and zero-weight assessments
        missing_keys = []
        for m in self.assessments:
            module_info = self._get_module_info(m.module_code)
            if module_info and module_info["pass_mark"] == "pass/fail":
                continue
            if m.assessment_weight == 0:
                continue
            key = (m.module_code, m.index)
            if test_grades.get(key) is None:
                missing_keys.append(key)
        
        if not missing_keys:
            return None  # No missing grades
        
        # Try to find the required grade (0-100)
        # We'll use binary search or direct calculation
        
        # Get all modules with missing grades
        modules_with_missing = set(key[0] for key in missing_keys)
        
        # Try different estimated grades from 0 to 100
        for estimated_grade in range(101):
            test_grades_copy = test_grades.copy()
            
            # Set all missing grades to estimated_grade
            for key in missing_keys:
                test_grades_copy[key] = estimated_grade
            
            # Calculate module scores
            module_scores = {}
            for module in self.data["modules"]:
                module_code = module["module_code"]
                score = self.calculate_module_score(module_code, test_grades_copy)
                if score is not None:
                    module_scores[module_code] = score
            
            # Calculate final score
            final_score = self.calculate_final_score(module_scores)
            
            if final_score is not None and final_score >= target_grade - 0.01:
                return estimated_grade
        
        return None  # Target is unachievable
    
    def display_stored_data_formatted(self, target_grade: float = 76.0):
        """Display stored data in formatted table with calculations and estimated grades for missing assessments"""
        print("\n" + "="*70)
        print("STORED DATA - FORMATTED VIEW")
        print(f"Target Grade: {target_grade:.2f}")
        print("="*70)
        
        # Create grades dict from stored data
        grades = {}
        for assessment in self.assessments:
            key = (assessment.module_code, assessment.index)
            grades[key] = assessment.grade
        
        # Create detailed results for each module
        all_module_scores = {}
        missing_modules = []
        
        for module in self.data["modules"]:
            module_code = module["module_code"]
            assessments = self.get_assessments_for_module(module_code)
            
            print(f"\n{module_code}: {module['title']}")
            print(f"  ECTS: {module['ects']}, Module Weight: {module['module_weight']}%")
            print("-" * 70)
            
            # Display individual assessments
            total_weight = 0
            weighted_score = 0
            all_present = True
            
            # Special handling for pass/fail
            if module["pass_mark"] == "pass/fail":
                key = (module_code, 0)
                grade = grades.get(key)
                if grade is not None:
                    result = "PASS" if grade >= 50 else "FAIL"
                    print(f"  Pass/Fail Assessment: {grade:6.2f}/100 -> {result}")
                    all_present = True
                else:
                    print(f"  Pass/Fail Assessment: NOT PROVIDED")
                    all_present = False
            else:
                for assessment in assessments:
                    key = (assessment.module_code, assessment.index)
                    grade = grades.get(key)
                    
                    if grade is not None:
                        weighted_contribution = (assessment.assessment_weight / 100) * grade
                        weighted_score += weighted_contribution
                        total_weight += assessment.assessment_weight
                        print(f"  {assessment.assessment_name:30} ({assessment.assessment_weight}%): {grade:6.2f}/100")
                    else:
                        print(f"  {assessment.assessment_name:30} ({assessment.assessment_weight}%): NOT PROVIDED")
                        all_present = False
            
            # Calculate module score
            module_score = self.calculate_module_score(module_code, grades)
            
            if module_code != "I-EXPLORE":  # Skip calculation for I-EXPLORE
                if module_score is not None:
                    print(f"  Module Score: {module_score:.2f}/100")
                    all_module_scores[module_code] = module_score
                else:
                    print(f"  Module Score: CANNOT CALCULATE (missing grades)")
                    missing_modules.append(module_code)
                    all_module_scores[module_code] = None
            else:
                # I-EXPLORE handling
                if grades.get((module_code, 0)) is not None:
                    all_module_scores[module_code] = grades[(module_code, 0)]
        
        # Calculate final score
        final_score = self.calculate_final_score(all_module_scores)
        
        print("\n" + "="*70)
        print("FINAL YEAR SCORE")
        print("="*70)
        
        if final_score is not None:
            print(f"Final Score: {final_score:.2f}/100")
            if final_score >= target_grade - 0.01:
                print(f"✓ Target of {target_grade:.2f} ACHIEVED!")
            else:
                print(f"✗ Target of {target_grade:.2f} NOT ACHIEVED (shortfall: {target_grade - final_score:.2f} points)")
        else:
            print(f"Cannot calculate final score due to missing grades for modules: {', '.join(missing_modules)}")
            print("\nModules with complete grades:")
            for module in self.data["modules"]:
                module_code = module["module_code"]
                if all_module_scores.get(module_code) is not None:
                    print(f"  {module_code}: {all_module_scores[module_code]:.2f}/100")
            
            # Estimate required grade for missing assessments
            print("\nEstimating required grade for missing assessments...")
            estimated_grade = self.estimate_missing_grades(grades, target_grade)
            
            if estimated_grade is not None:
                print(f"\nEstimated grade for ALL missing assessments: {estimated_grade:.0f}/100")
                if estimated_grade <= 100:
                    print(f"To achieve target of {target_grade:.2f}, all missing assessments should be {estimated_grade:.0f} or above")
            else:
                print(f"\n✗ Target of {target_grade:.2f} is NOT ACHIEVABLE")
                print(f"even with perfect grades (100/100) on all missing assessments")

def display_menu():
    """Display main menu"""
    print("\n" + "="*70)
    print("ICL Y3 GRADE CALCULATOR")
    print("="*70)
    print("\nOptions:")
    print("1. Input grades and calculate final score")
    print("2. View stored data")
    print("3. Exit")
    return input("\nSelect option (1-3): ").strip()

def input_grades(calculator: GradeCalculator, target_grade: float) -> Dict[Tuple[str,int], float]:
    """
    Interactive grade input for all assessments
    """
    print("\n" + "="*70)
    print("GRADE INPUT")
    print("="*70)
    print("\nEnter grades for each assessment (0-100)")
    print("Press Enter to skip (use existing value if available)\n")
    
    grades = {}
    current_module = ""
    
    for assessment in calculator.assessments:
        if assessment.module_code != current_module:
            current_module = assessment.module_code
            module_info = calculator._get_module_info(current_module)
            print(f"\n{current_module}: {module_info['title']}")
            print(f"  ECTS: {module_info['ects']}, Pass Mark: {module_info['pass_mark']}")
            print(f"  Module Weight: {module_info['module_weight']}%")
            print("-" * 70)
        
        key = (assessment.module_code, assessment.index)
        existing_grade = assessment.grade
        
        prompt = f"  {assessment.assessment_name} ({assessment.assessment_weight}%) - {assessment.description}"
        if existing_grade is not None:
            prompt += f"\n    [Existing: {existing_grade}] "
        else:
            prompt += "\n    "
        
        user_input = input(prompt).strip()
        
        if user_input:
            try:
                grade = float(user_input)
                if grade < 0 or grade > 100:
                    print("    Invalid! Grade must be 0-100. Skipping...")
                    if existing_grade is not None:
                        grades[key] = existing_grade
                    else:
                        grades[key] = None
                else:
                    grades[key] = grade
            except ValueError:
                print("    Invalid input! Skipping...")
                if existing_grade is not None:
                    grades[key] = existing_grade
                else:
                    grades[key] = None
        else:
            # User skipped
            if existing_grade is not None:
                grades[key] = existing_grade
            else:
                grades[key] = None
    
    return grades

def calculate_and_display_results(calculator: GradeCalculator, 
                                  grades: Dict[Tuple[str,int], float],
                                  target_grade: float):
    """Calculate and display all results"""
    print("\n" + "="*70)
    print("RESULTS")
    print("="*70)
    
    # Create detailed results for each module
    module_results = {}
    all_module_scores = {}
    missing_modules = []
    
    for module in calculator.data["modules"]:
        module_code = module["module_code"]
        assessments = calculator.get_assessments_for_module(module_code)
        
        print(f"\n{module_code}: {module['title']}")
        print(f"  ECTS: {module['ects']}, Module Weight: {module['module_weight']}%")
        print("-" * 70)
        
        # Display individual assessments
        total_weight = 0
        weighted_score = 0
        all_present = True
        
        # Special handling for pass/fail
        if module["pass_mark"] == "pass/fail":
            key = (module_code, 0)
            grade = grades.get(key)
            if grade is not None:
                result = "PASS" if grade >= 50 else "FAIL"
                print(f"  Pass/Fail Assessment: {grade}/100 -> {result}")
                all_present = True
            else:
                print(f"  Pass/Fail Assessment: Not provided")
                all_present = False
        else:
            for assessment in assessments:
                key = (assessment.module_code, assessment.index)
                grade = grades.get(key)
                
                if grade is not None:
                    weighted_contribution = (assessment.assessment_weight / 100) * grade
                    weighted_score += weighted_contribution
                    total_weight += assessment.assessment_weight
                    print(f"  {assessment.assessment_name:30} ({assessment.assessment_weight}%): {grade:6.2f}/100")
                else:
                    print(f"  {assessment.assessment_name:30} ({assessment.assessment_weight}%): NOT PROVIDED")
                    all_present = False
        
        # Calculate module score
        module_score = calculator.calculate_module_score(module_code, grades)
        
        if module_code != "I-EXPLORE":  # Skip calculation for I-EXPLORE
            if module_score is not None:
                print(f"  Module Score: {module_score:.2f}/100")
                all_module_scores[module_code] = module_score
            else:
                print(f"  Module Score: CANNOT CALCULATE (missing grades)")
                missing_modules.append(module_code)
                all_module_scores[module_code] = None
        else:
            # I-EXPLORE handling
            if grades.get((module_code, 0)) is not None:
                all_module_scores[module_code] = grades[(module_code, 0)]
    
    # Calculate final score and handle missing grades
    final_score = calculator.calculate_final_score(all_module_scores)
    
    print("\n" + "="*70)
    print("FINAL YEAR SCORE")
    print("="*70)
    print(f"Target Grade: {target_grade:.2f}")
    
    if final_score is not None:
        print(f"Calculated Final Score: {final_score:.2f}")
        if final_score >= target_grade - 0.01:
            print(f"✓ Target ACHIEVED!")
        else:
            print(f"✗ Target NOT ACHIEVED (shortfall: {target_grade - final_score:.2f} points)")
    else:
        # Calculate module scores with estimated grades
        print(f"Cannot calculate final score due to missing grades for modules: {', '.join(missing_modules)}")
        print("\nCalculating estimated grade needed for missing assessments...")
        
        estimated_grade = calculator.estimate_missing_grades(grades, target_grade)
        
        if estimated_grade is not None:
            print(f"\nEstimated grade for all missing assessments: {estimated_grade:.0f}/100")
            print(f"With this grade, target of {target_grade:.2f} would be ACHIEVABLE")
            
            # Recalculate with estimated grades
            test_grades = grades.copy()
            for assessment in calculator.assessments:
                key = (assessment.module_code, assessment.index)
                if test_grades.get(key) is None:
                    test_grades[key] = estimated_grade
            
            test_module_scores = {}
            for module in calculator.data["modules"]:
                module_code = module["module_code"]
                score = calculator.calculate_module_score(module_code, test_grades)
                if score is not None:
                    test_module_scores[module_code] = score
            
            final_with_estimate = calculator.calculate_final_score(test_module_scores)
            if final_with_estimate is not None:
                print(f"Projected Final Score: {final_with_estimate:.2f}")
        else:
            print(f"\n✗ Target NOT ACHIEVABLE even with perfect grades (100/100) on all missing assessments")

def main():
    """Main application loop"""
    calculator = GradeCalculator("/home/ianpoon/Downloads/ICL_Y3admin/grades.json")
    
    while True:
        choice = display_menu()
        
        if choice == "1":
            # Get target grade
            try:
                target_grade = float(input("\nEnter desired overall year grade: ").strip())
                if target_grade < 0 or target_grade > 100:
                    print("Invalid! Grade must be between 0-100.")
                    continue
            except ValueError:
                print("Invalid input!")
                continue
            
            # Input grades
            grades = input_grades(calculator, target_grade)
            
            # Calculate and display
            calculate_and_display_results(calculator, grades, target_grade)
            
        elif choice == "2":
            # Get target grade for stored data view
            try:
                target_input = input("\nEnter desired overall year grade (press Enter to assume 76): ").strip()
                if target_input:
                    target_grade = float(target_input)
                    if target_grade < 0 or target_grade > 100:
                        print("Invalid! Grade must be between 0-100.")
                        continue
                else:
                    target_grade = 76.0
            except ValueError:
                print("Invalid input!")
                continue
            
            calculator.display_stored_data_formatted(target_grade)
            
        elif choice == "3":
            print("\nGoodbye!")
            break
        else:
            print("Invalid option!")

if __name__ == "__main__":
    main()
