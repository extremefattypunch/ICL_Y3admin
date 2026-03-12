# ICL Y3 Grade Calculator - Web Application

A modern, user-friendly web application for calculating final year grades for Imperial College London Year 3 Bioengineering students (2025-26).

## Features

✨ **Modern Web Interface**
- Clean, intuitive HTML/CSS/JavaScript frontend
- Responsive design for desktop and mobile
- Real-time grade input and calculation

📊 **Grade Calculation**
- Weighted assessment calculations within each module
- Final year score calculation based on module weights
- Target grade achievement analysis
- Automatic estimation of required grades for missing assessments

💾 **Data Management**
- Persistent grade storage in JSON
- View saved grades with formatted displays
- Skip input boxes while retaining previous values

🎯 **Target Analysis**
- Set desired overall year grade
- Get estimated grades for missing assessments
- Identify which modules need improvement
- See if targets are achievable

## Requirements

- Node.js (v12 or higher)
- npm (Node Package Manager)

## Installation & Setup

### 1. Build the Application

```bash
npm run build
```

This command will:
- Install all required dependencies
- Validate the grades.json data
- Check all application files
- Prepare the app for running

### 2. Start the Application

```bash
npm start
```

The application will start and you should see:
```
======================================================================
ICL Y3 GRADE CALCULATOR - WEB APPLICATION
======================================================================

Server running at http://localhost:3000

Open your browser and navigate to: http://localhost:3000

Press Ctrl+C to stop the server
```

### 3. Open in Browser

Navigate to `http://localhost:3000` in your web browser.

## Usage

### Main Menu
The home page presents three options:
- **Input Grades** - Enter new grades and calculate results
- **View Data** - See all saved grades with analysis
- **Browse** - Navigate between sections

### Input Your Grades Workflow

1. **Set Target Grade** - Enter your desired overall year grade
2. **Enter Assessment Grades** - Fill in grades for each assessment (0-100)
3. **Skip What You Want** - Leave empty if you don't want to update a grade
4. **Calculate** - Click "Calculate Results" to see:
   - Individual assessment scores
   - Module scores
   - Final year score
   - Achievement status vs target
   - Estimated grades needed for missing assessments

### View Stored Data

1. **Set Target Grade** - Enter desired grade (defaults to 76)
2. **Refresh** - Click to load current saved data
3. **See Analysis** - View all saved grades with:
   - Current grades for each assessment
   - Module scores
   - Final year score (if all data complete)
   - Estimated grades for missing assessments

## File Structure

```
ICL_Y3admin/
├── server.js                 # Express.js backend server
├── grades.json               # Grade data storage
├── package.json              # Node.js configuration
├── scripts/
│   └── build.js             # Build script
├── public/
│   ├── index.html           # Main HTML page
│   ├── style.css            # Styling
│   └── app.js               # Frontend JavaScript
└── README.md                # This file
```

## API Endpoints

The server provides the following endpoints:

### GET /api/modules
Returns all modules and assessments

### POST /api/calculate
Calculates grades based on input
- Request body: `{ grades: {...}, targetGrade: number }`
- Returns: Calculated results with final score and analysis

### GET /api/stored-data
Returns stored grades with analysis
- Query param: `target` (optional, default 76)
- Returns: Stored data with calculations and estimations

### POST /api/save-grade
Saves a single grade to persistent storage
- Request body: `{ moduleCode: string, assessmentIndex: number, grade: number }`

## Grade Calculation Formula

### Module Score
Weights of 0% are excluded. The remaining weights are normalised so they sum to 100%:
```
Module Score = Σ (Assessment Weight / Σ Non-zero Weights) × (Assessment Grade)
```

### Final Year Score
Pass/Fail modules (I-EXPLORE) are excluded entirely.
```
Final Score = Σ (Module Weight % / 100) × (Module Score)
```

### Example
For BIOE60012 with:
- Written exam (67%): 80/100
- Written report (33%): 75/100

Total non-zero weight = 67 + 33 = 100
Module Score = (67/100 × 80) + (33/100 × 75) = 78.35/100

This module score contributes: 9.1% × 78.35 = 7.13 points to final grade

For BIOE60005 (Group Project) the Literature mind map has 0% weight, so:
Total non-zero weight = 20 + 15 + 50 + 15 = 100 (normalised automatically)

## Modules Included

| Code | Module | ECTS | Weight % |
|------|--------|------|----------|
| BIOE60012 | Foundations of Synthetic Biology | 5 | 9.1 |
| BIOE60005 | Bioengineering Group Project | 20 | 36.3 |
| BIOE60003 | Biomedical Instrumentation | 5 | 9.1 |
| BIOE60006 | Digital Biosignal Processing | 5 | 9.1 |
| BIOE60008 | Image Processing | 5 | 9.1 |
| BIOE60011 | Probability, Statistics and Data Analysis | 5 | 9.1 |
| BIOE60024 | Modelling in Biology | 5 | 9.1 |
| I-EXPLORE | I-Explore | 5 | 0 |
| BIOE7005 | Cellular and Molecular Mechanotransduction | 5 | 9.1 |

**Total ECTS: 60** (computed dynamically from module data)

## Special Cases

### Pass/Fail Modules (I-EXPLORE)
- Completely excluded from final grade calculation
- Module weight is 0% — has no impact on year score
- Not included in missing-grade estimation

### Missing Grades
- The system estimates what grade you need on missing assessments
- If you can't achieve your target, you'll be notified
- Estimated grades help you plan which assessments to focus on

## Server Management

### Start the server
```bash
npm start
```

### Stop the server
```bash
# Option 1 — Ctrl+C in the terminal where the server is running

# Option 2 — kill by process name (from any terminal)
pkill -f "node server.js"

# Option 3 — kill by port
lsof -ti:3000 | xargs kill -9
```

### Restart the server
```bash
pkill -f "node server.js"; npm start
```

### Reset all grades to null
```bash
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('grades.json','utf8'));
data.modules.forEach(m => m.assessments.forEach(a => a.grade = null));
fs.writeFileSync('grades.json', JSON.stringify(data, null, 2));
console.log('All grades reset.');
"
```

---

## Troubleshooting

### Port Already in Use
If port 3000 is already in use:
```bash
pkill -f "node server.js"
npm start
```

### npm: command not found
Install Node.js from https://nodejs.org/

### Grades not saving
- Check that grades.json is writable
- Ensure your browser allows local storage
- Try refreshing the page

### Server crashes on startup
Run `npm run build` to validate all files

## Development

To run the Python version instead:
```bash
python3 grade_calculator.py
```

## Browser Compatibility

- Chrome/Edge (Recommended)
- Firefox
- Safari
- Mobile browsers

## Performance Notes

- All calculations are done client-side and server-side
- Grades are instantly saved on input
- The app works offline once loaded (except for API calls)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Verify all files are present: `npm run build`
3. Restart the server: `npm start`
4. Check browser console for errors (F12)

## License

Academic use for Imperial College London 2025-26

## Changelog

### v1.0.0 (Initial Release)
- Full web application with modern interface
- Real-time grade calculation
- Persistent storage
- Target grade estimation
- Mobile-responsive design
