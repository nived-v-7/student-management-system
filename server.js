const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DB_FILE = path.join(__dirname, 'database.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Helper: CORS Headers
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Helper: Parse JSON Body
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        resolve({});
      }
    });
  });
}

// Helper: Read database from file
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    const defaultData = getMockData();
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading database file, resetting to mock data:', err);
    return getMockData();
  }
}

// Helper: Write database to file
function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error('Error writing database:', err);
    return false;
  }
}

// Helper: Add custom activity log
function logActivity(db, message) {
  db.activities.unshift({
    id: 'ACT-' + Date.now(),
    message: message,
    timestamp: new Date().toISOString()
  });
  if (db.activities.length > 15) {
    db.activities.pop();
  }
}

// Helper: Convert numeric score to Letter Grade and Point Value (10.0 scale)
function getLetterAndGPA(score) {
  const gpa = parseFloat((score / 10).toFixed(2));
  let letter = 'F';
  if (score >= 90) letter = 'A';
  else if (score >= 80) letter = 'B';
  else if (score >= 70) letter = 'C';
  else if (score >= 60) letter = 'D';
  return { letter, gpa };
}

// Main HTTP request router
const server = http.createServer(async (req, res) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  setCorsHeaders(res);
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // --- API Routes ---
  if (pathname.startsWith('/api')) {
    res.setHeader('Content-Type', 'application/json');
    const db = readDB();

    // 1. Dashboard Stats
    if (pathname === '/api/dashboard/stats' && req.method === 'GET') {
      const studentsCount = db.students.length;
      const coursesCount = db.courses.length;

      let totalGPA = 0;
      let gpaCount = 0;

      db.students.forEach(student => {
        const studentGrades = db.grades.filter(g => g.studentId === student.id);
        if (studentGrades.length > 0) {
          const avgScore = studentGrades.reduce((sum, g) => sum + g.grade, 0) / studentGrades.length;
          totalGPA += getLetterAndGPA(avgScore).gpa;
          gpaCount++;
        }
      });

      const averageGPA = gpaCount > 0 ? (totalGPA / gpaCount).toFixed(2) : '0.00';
      const totalEnrollments = db.students.reduce((sum, student) => sum + (student.enrolledCourses?.length || 0), 0);

      const statusBreakdown = { Active: 0, Suspended: 0, Graduated: 0 };
      db.students.forEach(student => {
        if (statusBreakdown[student.status] !== undefined) {
          statusBreakdown[student.status]++;
        }
      });

      // Course Category distribution (enrolled student counts)
      const courseCategories = {};
      db.courses.forEach(course => {
        courseCategories[course.category] = 0;
      });
      db.students.forEach(student => {
        if (student.enrolledCourses) {
          student.enrolledCourses.forEach(cId => {
            const course = db.courses.find(c => c.id === cId);
            if (course) {
              courseCategories[course.category]++;
            }
          });
        }
      });

      res.writeHead(200);
      res.end(JSON.stringify({
        totals: {
          students: studentsCount,
          courses: coursesCount,
          avgGPA: parseFloat(averageGPA),
          enrollments: totalEnrollments
        },
        statusBreakdown,
        courseCategories,
        recentActivities: db.activities.slice(0, 8)
      }));
      return;
    }

    // 2. Students API (GET / POST)
    if (pathname === '/api/students') {
      if (req.method === 'GET') {
        const studentsWithDetails = db.students.map(student => {
          const studentGrades = db.grades.filter(g => g.studentId === student.id);
          let avgScore = 0;
          let letter = 'N/A';
          let gpa = 0.0;

          if (studentGrades.length > 0) {
            avgScore = studentGrades.reduce((sum, g) => sum + g.grade, 0) / studentGrades.length;
            const metrics = getLetterAndGPA(avgScore);
            letter = metrics.letter;
            gpa = metrics.gpa;
          }

          return {
            ...student,
            gpa: parseFloat(gpa.toFixed(2)),
            averageGrade: parseFloat(avgScore.toFixed(1)),
            letterGrade: letter
          };
        });
        res.writeHead(200);
        res.end(JSON.stringify(studentsWithDetails));
        return;
      }

      if (req.method === 'POST') {
        const body = await readJsonBody(req);
        const { name, email, phone, status, enrolledCourses } = body;

        if (!name || !email) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Name and email are required.' }));
          return;
        }

        const lastIdNum = db.students.length > 0 
          ? Math.max(...db.students.map(s => parseInt(s.id.split('-')[1]))) 
          : 100;
        const newId = `STD-${lastIdNum + 1}`;

        const newStudent = {
          id: newId,
          name,
          email,
          phone: phone || '',
          status: status || 'Active',
          enrolledCourses: enrolledCourses || []
        };

        db.students.push(newStudent);
        logActivity(db, `Added student: ${name} (${newId})`);
        writeDB(db);

        res.writeHead(201);
        res.end(JSON.stringify(newStudent));
        return;
      }
    }

    // 3. Students PUT / DELETE (e.g. /api/students/STD-101)
    const studentMatch = pathname.match(/^\/api\/students\/([A-Za-z0-9-]+)$/);
    if (studentMatch) {
      const id = studentMatch[1];
      const index = db.students.findIndex(s => s.id === id);

      if (index === -1) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Student not found.' }));
        return;
      }

      if (req.method === 'PUT') {
        const body = await readJsonBody(req);
        const { name, email, phone, status, enrolledCourses } = body;

        db.students[index] = {
          ...db.students[index],
          name: name || db.students[index].name,
          email: email || db.students[index].email,
          phone: phone !== undefined ? phone : db.students[index].phone,
          status: status || db.students[index].status,
          enrolledCourses: enrolledCourses || db.students[index].enrolledCourses
        };

        logActivity(db, `Updated student info: ${db.students[index].name} (${id})`);
        writeDB(db);

        res.writeHead(200);
        res.end(JSON.stringify(db.students[index]));
        return;
      }

      if (req.method === 'DELETE') {
        const student = db.students[index];
        db.students.splice(index, 1);
        db.grades = db.grades.filter(g => g.studentId !== id);

        logActivity(db, `Removed student: ${student.name} (${id})`);
        writeDB(db);

        res.writeHead(200);
        res.end(JSON.stringify({ message: `Student ${id} deleted successfully.` }));
        return;
      }
    }

    // 4. Courses API (GET / POST)
    if (pathname === '/api/courses') {
      if (req.method === 'GET') {
        const coursesWithDetails = db.courses.map(course => {
          const enrolledCount = db.students.filter(s => s.enrolledCourses?.includes(course.id)).length;
          return { ...course, studentCount: enrolledCount };
        });
        res.writeHead(200);
        res.end(JSON.stringify(coursesWithDetails));
        return;
      }

      if (req.method === 'POST') {
        const body = await readJsonBody(req);
        const { id, name, instructor, category, credits } = body;

        if (!id || !name || !instructor || !category || !credits) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'All fields are required.' }));
          return;
        }

        if (db.courses.some(c => c.id.toUpperCase() === id.toUpperCase())) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Course code already exists.' }));
          return;
        }

        const newCourse = {
          id: id.toUpperCase(),
          name,
          instructor,
          category,
          credits: parseInt(credits)
        };

        db.courses.push(newCourse);
        logActivity(db, `Created course: ${name} (${newCourse.id})`);
        writeDB(db);

        res.writeHead(201);
        res.end(JSON.stringify(newCourse));
        return;
      }
    }

    // 5. Courses PUT / DELETE (e.g. /api/courses/CS-101)
    const courseMatch = pathname.match(/^\/api\/courses\/([A-Za-z0-9-]+)$/);
    if (courseMatch) {
      const id = courseMatch[1];
      const index = db.courses.findIndex(c => c.id === id);

      if (index === -1) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Course not found.' }));
        return;
      }

      if (req.method === 'PUT') {
        const body = await readJsonBody(req);
        const { name, instructor, category, credits } = body;

        db.courses[index] = {
          ...db.courses[index],
          name: name || db.courses[index].name,
          instructor: instructor || db.courses[index].instructor,
          category: category || db.courses[index].category,
          credits: credits ? parseInt(credits) : db.courses[index].credits
        };

        logActivity(db, `Updated course details: ${db.courses[index].name} (${id})`);
        writeDB(db);

        res.writeHead(200);
        res.end(JSON.stringify(db.courses[index]));
        return;
      }

      if (req.method === 'DELETE') {
        const course = db.courses[index];
        db.courses.splice(index, 1);

        db.students.forEach(student => {
          if (student.enrolledCourses) {
            student.enrolledCourses = student.enrolledCourses.filter(cId => cId !== id);
          }
        });
        db.grades = db.grades.filter(g => g.courseId !== id);

        logActivity(db, `Removed course: ${course.name} (${id})`);
        writeDB(db);

        res.writeHead(200);
        res.end(JSON.stringify({ message: `Course ${id} deleted successfully.` }));
        return;
      }
    }

    // 6. Grades API (GET / PUT)
    if (pathname === '/api/grades') {
      if (req.method === 'GET') {
        const fullGrades = db.grades.map(g => {
          const student = db.students.find(s => s.id === g.studentId);
          const course = db.courses.find(c => c.id === g.courseId);
          const metrics = getLetterAndGPA(g.grade);

          return {
            studentId: g.studentId,
            studentName: student ? student.name : 'Unknown',
            courseId: g.courseId,
            courseName: course ? course.name : 'Unknown',
            grade: g.grade,
            letter: metrics.letter,
            gpa: metrics.gpa
          };
        });
        res.writeHead(200);
        res.end(JSON.stringify(fullGrades));
        return;
      }

      if (req.method === 'PUT') {
        const body = await readJsonBody(req);
        const { studentId, courseId, grade } = body;

        if (!studentId || !courseId || grade === undefined) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Missing parameters.' }));
          return;
        }

        const numericGrade = parseFloat(grade);
        if (isNaN(numericGrade) || numericGrade < 0 || numericGrade > 100) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Grade must be between 0 and 100.' }));
          return;
        }

        const index = db.grades.findIndex(g => g.studentId === studentId && g.courseId === courseId);
        if (index !== -1) {
          db.grades[index].grade = numericGrade;
        } else {
          db.grades.push({ studentId, courseId, grade: numericGrade });
        }

        const student = db.students.find(s => s.id === studentId);
        const course = db.courses.find(c => c.id === courseId);
        logActivity(db, `Updated grade for ${student?.name || studentId} in ${course?.name || courseId}: ${numericGrade}%`);

        writeDB(db);
        res.writeHead(200);
        res.end(JSON.stringify({ studentId, courseId, grade: numericGrade, ...getLetterAndGPA(numericGrade) }));
        return;
      }
    }
  }

  // --- Static File Serving ---
  let filePath = path.join(PUBLIC_DIR, pathname);
  
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Server Error');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Seed data generator
function getMockData() {
  return {
    students: [
      { id: 'STD-101', name: 'Sophia Sterling', email: 'sophia.sterling@academy.edu', phone: '+1 (555) 019-2834', status: 'Active', enrolledCourses: ['CS-101', 'MAT-201', 'SCI-102'] },
      { id: 'STD-102', name: 'Liam Vance', email: 'liam.vance@academy.edu', phone: '+1 (555) 014-9988', status: 'Active', enrolledCourses: ['CS-101', 'BUS-105'] },
      { id: 'STD-103', name: 'Amara Kante', email: 'amara.kante@academy.edu', phone: '+1 (555) 012-4411', status: 'Active', enrolledCourses: ['CS-101', 'MAT-201', 'SCI-102'] },
      { id: 'STD-104', name: 'Ethan Hunt', email: 'ethan.hunt@academy.edu', phone: '+1 (555) 018-3322', status: 'Suspended', enrolledCourses: ['MAT-201'] },
      { id: 'STD-105', name: 'Elena Rostova', email: 'elena.rostova@academy.edu', phone: '+1 (555) 017-7744', status: 'Graduated', enrolledCourses: [] },
      { id: 'STD-106', name: 'Marcus Brody', email: 'marcus.brody@academy.edu', phone: '+1 (555) 011-5566', status: 'Active', enrolledCourses: ['CS-101', 'BUS-105', 'SCI-102'] }
    ],
    courses: [
      { id: 'CS-101', name: 'Introduction to Computer Science', instructor: 'Dr. Alan Turing', category: 'Computer Science', credits: 4 },
      { id: 'MAT-201', name: 'Calculus II & Linear Algebra', instructor: 'Prof. Katherine Johnson', category: 'Mathematics', credits: 4 },
      { id: 'SCI-102', name: 'Astrophysics Foundations', instructor: 'Dr. Carl Sagan', category: 'Science', credits: 3 },
      { id: 'BUS-105', name: 'Microeconomics & Game Theory', instructor: 'Dr. John Nash', category: 'Business', credits: 3 }
    ],
    grades: [
      { studentId: 'STD-101', courseId: 'CS-101', grade: 95 },
      { studentId: 'STD-101', courseId: 'MAT-201', grade: 95 },
      { studentId: 'STD-101', courseId: 'SCI-102', grade: 95 },
      { studentId: 'STD-102', courseId: 'CS-101', grade: 85 },
      { studentId: 'STD-102', courseId: 'BUS-105', grade: 85 },
      { studentId: 'STD-103', courseId: 'CS-101', grade: 98 },
      { studentId: 'STD-103', courseId: 'MAT-201', grade: 98 },
      { studentId: 'STD-103', courseId: 'SCI-102', grade: 98 },
      { studentId: 'STD-104', courseId: 'MAT-201', grade: 80 },
      { studentId: 'STD-106', courseId: 'CS-101', grade: 85 },
      { studentId: 'STD-106', courseId: 'BUS-105', grade: 85 },
      { studentId: 'STD-106', courseId: 'SCI-102', grade: 90 }
    ],
    activities: [
      { id: 'ACT-1', message: 'Database initialized with demo data.', timestamp: new Date(Date.now() - 3600000 * 2).toISOString() },
      { id: 'ACT-2', message: 'Sophia Sterling grade updated in CS-101.', timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString() },
      { id: 'ACT-3', message: 'New course BUS-105 registered.', timestamp: new Date(Date.now() - 3600000).toISOString() }
    ]
  };
}

// Start Server listening
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
