// Nepalese Letter Grading Directive 2078/2081/2082

export interface GradeInfo {
  letter: string;
  gp: number;
  description: string;
}

export const GRADING_SCALE: { min: number; grade: GradeInfo }[] = [
  { min: 90, grade: { letter: 'A+', gp: 4.0, description: 'Outstanding' } },
  { min: 80, grade: { letter: 'A', gp: 3.6, description: 'Excellent' } },
  { min: 70, grade: { letter: 'B+', gp: 3.2, description: 'Very Good' } },
  { min: 60, grade: { letter: 'B', gp: 2.8, description: 'Good' } },
  { min: 50, grade: { letter: 'C+', gp: 2.4, description: 'Satisfactory' } },
  { min: 40, grade: { letter: 'C', gp: 2.0, description: 'Acceptable' } },
  { min: 35, grade: { letter: 'D', gp: 1.6, description: 'Basic' } },
  { min: 0, grade: { letter: 'NG', gp: 0.0, description: 'Non-Graded' } },
];

export function getGradeFromPercentage(percentage: number): GradeInfo {
  for (const entry of GRADING_SCALE) {
    if (percentage >= entry.min) return entry.grade;
  }
  return GRADING_SCALE[GRADING_SCALE.length - 1].grade;
}

export const TH_PASS_PERCENTAGE = 35;
export const IN_PASS_PERCENTAGE = 40;

export function checkNG(thMarks: number, thFullMarks: number, inMarks: number, inFullMarks: number): boolean {
  const thPerc = (thMarks / thFullMarks) * 100;
  const inPerc = (inMarks / inFullMarks) * 100;
  return thPerc < TH_PASS_PERCENTAGE || inPerc < IN_PASS_PERCENTAGE;
}

export function calculateSubjectGP(
  thMarks: number, thFullMarks: number,
  inMarks: number, inFullMarks: number,
  creditHours: number
): { gp: number; isNG: boolean; totalMarks: number; percentage: number; grade: GradeInfo } {
  const isNG = checkNG(thMarks, thFullMarks, inMarks, inFullMarks);

  if (isNG) {
    return {
      gp: 0,
      isNG: true,
      totalMarks: thMarks + inMarks,
      percentage: ((thMarks + inMarks) / (thFullMarks + inFullMarks)) * 100,
      grade: { letter: 'NG', gp: 0, description: 'Non-Graded' },
    };
  }

  const thCH = creditHours * 0.75;
  const inCH = creditHours * 0.25;

  const thPerc = (thMarks / thFullMarks) * 100;
  const inPerc = (inMarks / inFullMarks) * 100;

  const thGrade = getGradeFromPercentage(thPerc);
  const inGrade = getGradeFromPercentage(inPerc);

  const subjectGP = ((thGrade.gp * thCH) + (inGrade.gp * inCH)) / creditHours;
  const totalMarks = thMarks + inMarks;
  const percentage = (totalMarks / (thFullMarks + inFullMarks)) * 100;
  const overallGrade = getGradeFromPercentage(percentage);

  return { gp: Math.round(subjectGP * 100) / 100, isNG: false, totalMarks, percentage, grade: overallGrade };
}

export function calculateFinalGPA(
  subjectResults: { gp: number; isNG: boolean; creditHours: number }[]
): { gpa: number | null; hasNG: boolean } {
  const hasNG = subjectResults.some(r => r.isNG);
  if (hasNG) return { gpa: null, hasNG: true };

  const totalCH = subjectResults.reduce((sum, r) => sum + r.creditHours, 0);
  const weightedSum = subjectResults.reduce((sum, r) => sum + r.gp * r.creditHours, 0);

  return { gpa: Math.round((weightedSum / totalCH) * 100) / 100, hasNG: false };
}

export function calculateRiskScore(marksPerc: number, attendancePerc: number, assignmentPerc: number): {
  score: number;
  level: 'high' | 'medium' | 'low';
} {
  const score = (0.5 * (100 - marksPerc)) + (0.3 * (100 - attendancePerc)) + (0.2 * (100 - assignmentPerc));
  const rounded = Math.round(score * 10) / 10;
  const level = rounded >= 60 ? 'high' : rounded >= 35 ? 'medium' : 'low';
  return { score: rounded, level };
}

export function rankStudents(
  students: { id: string; totalMarks: number; hasNG: boolean; symbolNumber: string }[]
): Map<string, number | null> {
  const rankMap = new Map<string, number | null>();
  const eligible = students.filter(s => !s.hasNG);
  const ngStudents = students.filter(s => s.hasNG);

  // Sort by total marks desc, tie-break by symbol_number asc
  eligible.sort((a, b) => {
    if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
    return a.symbolNumber.localeCompare(b.symbolNumber, undefined, { numeric: true });
  });

  eligible.forEach((s, i) => rankMap.set(s.id, i + 1));
  ngStudents.forEach(s => rankMap.set(s.id, null));

  return rankMap;
}
