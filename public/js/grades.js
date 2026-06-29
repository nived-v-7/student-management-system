let gradesList = [];
let coursesList = [];

document.addEventListener('DOMContentLoaded', () => {
  // Search & Filter listeners
  document.getElementById('search-grade').addEventListener('input', renderGradesTable);
  document.getElementById('filter-grade-course').addEventListener('change', renderGradesTable);

  // Load Initial Data
  init();
});

async function init() {
  try {
    const [grades, courses] = await Promise.all([
      api.getGrades(),
      api.getCourses()
    ]);

    gradesList = grades;
    coursesList = courses;

    // Populate course dropdown
    populateCourseDropdown();

    // Render grade portal
    renderGradesTable();
  } catch (error) {
    console.error('Initialization error:', error);
    api.showToast('Could not load grades data', 'error');
  }
}

function populateCourseDropdown() {
  const select = document.getElementById('filter-grade-course');
  select.innerHTML = '<option value="">All Courses</option>';

  coursesList.forEach(course => {
    const opt = document.createElement('option');
    opt.value = course.id;
    opt.textContent = `${course.id} - ${course.name}`;
    select.appendChild(opt);
  });
}

function renderGradesTable() {
  const tbody = document.getElementById('grades-tbody');
  const searchQuery = document.getElementById('search-grade').value.toLowerCase().trim();
  const filterCourse = document.getElementById('filter-grade-course').value;

  const filteredGrades = gradesList.filter(g => {
    const matchesSearch = g.studentName.toLowerCase().includes(searchQuery) ||
                          g.studentId.toLowerCase().includes(searchQuery) ||
                          g.courseName.toLowerCase().includes(searchQuery) ||
                          g.courseId.toLowerCase().includes(searchQuery);

    const matchesCourse = filterCourse === '' || g.courseId === filterCourse;

    return matchesSearch && matchesCourse;
  });

  tbody.innerHTML = '';

  // Calculate & render summary analytics
  calculateAnalytics(filteredGrades);

  if (filteredGrades.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 3rem;">
          No grade entries found matching your query.
        </td>
      </tr>
    `;
    return;
  }

  filteredGrades.forEach(g => {
    const tr = document.createElement('tr');

    // Student Column
    const studentCell = document.createElement('td');
    const initials = api.getInitials(g.studentName);
    studentCell.className = 'profile-cell';
    studentCell.innerHTML = `
      <div class="avatar-initials" style="width: 32px; height: 32px; font-size: 0.75rem;">${initials}</div>
      <div class="profile-details">
        <div class="profile-name" style="font-size: 0.85rem;">${g.studentName}</div>
        <div class="profile-subtext" style="font-size: 0.7rem;">ID: ${g.studentId}</div>
      </div>
    `;

    // Course Column
    const courseCell = document.createElement('td');
    courseCell.innerHTML = `
      <div style="font-weight: 600; color: #fff; font-size: 0.85rem;">${g.courseName}</div>
      <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.1rem;">${g.courseId}</div>
    `;

    // Score Input Column (Inline Editable)
    const scoreCell = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'grade-input';
    input.value = g.grade;
    input.min = '0';
    input.max = '100';
    
    // Focusout & Keypress listeners to auto-save
    input.addEventListener('focusout', () => handleInlineSave(g.studentId, g.courseId, input));
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        input.blur(); // Triggers focusout logic
      }
    });
    scoreCell.appendChild(input);

    // Letter Grade Column
    const letterCell = document.createElement('td');
    let badgeClass = 'badge-active'; // defaults to green
    if (g.letter === 'D') badgeClass = 'badge-graduated'; // amber
    if (g.letter === 'F') badgeClass = 'badge-suspended'; // rose
    
    letterCell.innerHTML = `<span class="badge ${badgeClass}" style="width: 28px; justify-content: center; font-weight: 700;">${g.letter}</span>`;

    // GPA Value Column
    const gpaCell = document.createElement('td');
    gpaCell.innerHTML = `<span style="font-weight: 700;">${g.gpa.toFixed(2)}</span>`;

    tr.appendChild(studentCell);
    tr.appendChild(courseCell);
    tr.appendChild(scoreCell);
    tr.appendChild(letterCell);
    tr.appendChild(gpaCell);
    tbody.appendChild(tr);
  });
}

// Inline Save Logic
async function handleInlineSave(studentId, courseId, inputElement) {
  const newGrade = parseFloat(inputElement.value);

  // Validate grade
  if (isNaN(newGrade) || newGrade < 0 || newGrade > 100) {
    api.showToast('Grade must be a number between 0 and 100', 'error');
    // Reset to previous value
    const prevGrade = gradesList.find(g => g.studentId === studentId && g.courseId === courseId);
    inputElement.value = prevGrade ? prevGrade.grade : 0;
    return;
  }

  // Optimize: Check if value actually changed
  const entry = gradesList.find(g => g.studentId === studentId && g.courseId === courseId);
  if (entry && entry.grade === newGrade) {
    return; // No change, do nothing
  }

  try {
    const updated = await api.updateGrade(studentId, courseId, newGrade);
    api.showToast(`Updated grade to ${newGrade}%`);
    
    // Update local list object and re-render details
    if (entry) {
      entry.grade = updated.grade;
      entry.letter = updated.letter;
      entry.gpa = updated.gpa;
    }
    
    // Refresh table and analytics
    renderGradesTable();
  } catch (error) {
    console.error('Failed to update inline grade:', error);
    // Reset input to original value
    if (entry) inputElement.value = entry.grade;
  }
}

// Compute aggregate statistical insights
function calculateAnalytics(grades) {
  const avgPctElement = document.getElementById('avg-grade-pct');
  const distElement = document.getElementById('distribution-stats');

  if (grades.length === 0) {
    avgPctElement.textContent = '0.0%';
    distElement.innerHTML = '<span style="color: var(--text-dark); font-size: 0.8rem; font-style: italic;">No metrics available</span>';
    return;
  }

  // 1. Average percentage
  const totalSum = grades.reduce((sum, g) => sum + g.grade, 0);
  const avg = totalSum / grades.length;
  avgPctElement.textContent = `${avg.toFixed(1)}%`;

  // 2. Letter distribution
  const counts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  grades.forEach(g => {
    if (counts[g.letter] !== undefined) {
      counts[g.letter]++;
    }
  });

  distElement.innerHTML = '';
  Object.entries(counts).forEach(([letter, count]) => {
    const pct = ((count / grades.length) * 100).toFixed(0);
    
    let colorClass = 'rgba(16, 185, 129, 0.15)'; // Green glow
    let textColor = 'var(--success)';
    if (letter === 'D') {
      colorClass = 'rgba(245, 158, 11, 0.15)'; // Amber glow
      textColor = 'var(--warning)';
    } else if (letter === 'F') {
      colorClass = 'rgba(239, 68, 68, 0.15)'; // Rose glow
      textColor = 'var(--danger)';
    }

    const pill = document.createElement('div');
    pill.style.background = colorClass;
    pill.style.border = `1px solid rgba(255, 255, 255, 0.05)`;
    pill.style.borderRadius = '10px';
    pill.style.padding = '0.45rem 0.85rem';
    pill.style.display = 'flex';
    pill.style.alignItems = 'center';
    pill.style.gap = '0.5rem';
    pill.style.fontSize = '0.75rem';
    pill.style.fontWeight = '600';

    pill.innerHTML = `
      <span style="color: ${textColor}; font-weight: 800; font-size: 0.85rem;">${letter}</span>
      <span style="color: var(--text-main);">${count} (${pct}%)</span>
    `;

    distElement.appendChild(pill);
  });
}
