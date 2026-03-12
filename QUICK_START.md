# 🚀 Quick Start Guide - ICL Y3 Grade Calculator Web App

## Installation & Running (3 steps)

### Step 1: Build the Application
```bash
npm run build
```
This validates all files and checks dependencies.

### Step 2: Start the Server
```bash
npm start
```
You'll see:
```
Server running at http://localhost:3000
Open your browser and navigate to: http://localhost:3000
```

### Step 3: Open in Browser
Go to `http://localhost:3000` and start using the app!

---

## Features at a Glance

### 📊 Input Your Grades
1. Click "Input Grades"
2. Enter your target grade
3. Fill in assessment marks (leave empty to skip)
4. See instant calculations and target analysis

### 📈 View Stored Data
1. Click "View Data"
2. Set your target grade (defaults to 76)
3. See all saved grades with analysis
4. Get estimated grades for missing assessments

### 🎯 Target Analysis
- **All grades entered?** See your final score and whether you achieved the target
- **Missing grades?** Get the estimated grade you need on missing assessments
- **Target unachievable?** You'll be notified immediately

---

## What Gets Calculated

✅ **Individual Assessment Scores** - Exactly as you enter them

✅ **Module Scores** - Weighted average of assessments within each module

✅ **Final Year Score** - Weighted combination of all module scores

✅ **Estimated Grades** - What you need to score on missing assessments to reach your target

---

## Project Structure

```
ICL_Y3admin/
├── 📄 server.js              ← Backend (Express.js)
├── 📄 grades.json            ← Your grade data (persistent)
├── 📄 package.json           ← Node.js configuration
│
├── 📁 public/                ← Frontend files
│   ├── 📄 index.html         ← Web page
│   ├── 📄 style.css          ← Styling
│   └── 📄 app.js             ← JavaScript logic
│
├── 📁 scripts/               ← Build tools
│   └── 📄 build.js           ← Validation script
│
└── 📄 README.md              ← This guide
```

---

## Keyboard Shortcuts

| Action | How |
|--------|-----|
| Input Grades | Click "Input Grades" or press Tab to navigate |
| Skip a Grade | Leave the field empty and press Tab |
| Calculate | Click "Calculate Results" |
| View Data | Click "View Data" |
| Refresh Data | In View Data, click "Refresh" |

---

## Common Tasks

### Enter Grades from an Exam
1. Click "Input Grades"
2. Set target grade (e.g., 70)
3. Fill in grades for each assessment
4. Click "Calculate Results" to see analysis

### Check Saved Progress
1. Click "View Data"
2. See all previously saved grades
3. Change target grade if needed
4. Estimated grades update automatically

### Find Out What Grade You Need
1. Click "View Data"
2. Enter your desired final grade
3. Look at "To Achieve Your Target" section
4. See what you need on missing assessments

---

## Troubleshooting

### "Cannot connect to http://localhost:3000"
- Make sure you ran `npm start`
- Check that no other app is using port 3000
- Try restarting the server

### Grades not saving
- Refresh the page
- Check "View Data" to see if they saved
- Restart the server

### Weird calculations
- Make sure you entered grades 0-100
- Check if some assessments are 0% weight (they don't affect the score)

### Need to stop the server?
Press **Ctrl+C** in the terminal

---

## Understanding the Calculations

### Example: BIOE60012 Module

**Your inputs:**
- Written Exam (67% weight): 80
- Written Report (33% weight): 75

**Module Score Calculation:**
- (0.67 × 80) + (0.33 × 75) = 53.6 + 24.75 = **78.35/100**

**Contribution to Final Grade:**
- Module weight: 9.1%
- Contribution: 9.1% × 78.35 = **7.13 points** to your final grade

---

## Modules in the System

All 9 modules for 2025-26 are included:
- Foundations of Synthetic Biology
- Bioengineering Group Project (20 ECTS)
- Biomedical Instrumentation
- Digital Biosignal Processing
- Image Processing
- Probability, Statistics and Data Analysis
- Modelling in Biology
- I-Explore (Pass/Fail)
- Cellular and Molecular Mechanotransduction

**Total: 75 ECTS**

---

## Tips for Best Results

1. **Enter grades as you get them** - The app saves automatically
2. **Set realistic targets** - Check what grade you need on remaining work
3. **Use estimation** - Plan which assessments to focus on
4. **Update regularly** - Keep grades current for accurate analysis

---

## Still Have Questions?

Read the full documentation in `WEB_APP_README.md` for advanced topics and API details.

---

**Version:** 1.0.0  
**Last Updated:** March 2026  
**For:** ICL 2025-26 Bioengineering Students
