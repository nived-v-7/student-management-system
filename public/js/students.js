let studentsList = [];
let coursesList = [];
let activeEditStudentId = null;

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const btnAddStudent = document.getElementById('btn-add-student');
  const btnCancelStudent = document.getElementById('btn-cancel-student');
  const modalClose = document.getElementById('modal-close');
  const studentForm = document.getElementById('student-form');
  
  // Search & Filter listeners
  document.getElementById('search-student').addEventListener('input', renderStudentsTable);
  document.getElementById('filter-status').addEventListener('change', renderStudentsTable);
  document.getElementById('filter-course').addEventListener('change', renderStudentsTable);

  // Modal control
  btnAddStudent.addEventListener('click', () => openStudentModal());
  btnCancelStudent.addEventListener('click', closeStudentModal);
  modalClose.addEventListener('click', closeStudentModal);
  
  // Form submit
  studentForm.addEventListener('submit', handleFormSubmit);

  // Check URL query parameters to auto-open modal (dashboard quick link)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('add') === 'true') {
    // Wait a brief moment for courses to load first, then open
    setTimeout(() => openStudentModal(), 300);
  }

  // Load Initial Data
  init();
});

async function init() {
  try {
    // Fetch students and courses in parallel
    const [students, courses] = await Promise.all([
      api.getStudents(),
      api.getCourses()
    ]);

    studentsList = students;
    coursesList = courses;

    // Populate filter dropdown & checkboxes
    populateCourseFilters();
    
    // Render roster table
    renderStudentsTable();
  } catch (error) {
    console.error('Initialization error:', error);
    api.showToast('Could not load student list', 'error');
  }
}

// Populate course filter dropdown and checkboxes inside modal
function populateCourseFilters() {
  const filterCourseSelect = document.getElementById('filter-course');
  const checkboxContainer = document.getElementById('course-checkboxes');
  
  // Reset
  filterCourseSelect.innerHTML = '<option value="">All Courses</option>';
  checkboxContainer.innerHTML = '';

  coursesList.forEach(course => {
    // 1. Dropdown filter options
    const option = document.createElement('option');
    option.value = course.id;
    option.textContent = `${course.id} - ${course.name}`;
    filterCourseSelect.appendChild(option);

    // 2. Checkboxes inside modal
    const label = document.createElement('label');
    label.className = 'checkbox-label';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = course.id;
    checkbox.className = 'course-checkbox';
    
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(`${course.id} (${course.credits}cr)`));
    checkboxContainer.appendChild(label);
  });
}

// Render student table with active filters and searches
function renderStudentsTable() {
  const tbody = document.getElementById('students-tbody');
  const searchQuery = document.getElementById('search-student').value.toLowerCase().trim();
  const filterStatus = document.getElementById('filter-status').value;
  const filterCourse = document.getElementById('filter-course').value;

  // Filter local copy
  const filteredStudents = studentsList.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery) || 
                          student.email.toLowerCase().includes(searchQuery) ||
                          student.id.toLowerCase().includes(searchQuery);
    
    const matchesStatus = filterStatus === '' || student.status === filterStatus;
    
    const matchesCourse = filterCourse === '' || (student.enrolledCourses && student.enrolledCourses.includes(filterCourse));

    return matchesSearch && matchesStatus && matchesCourse;
  });

  tbody.innerHTML = '';

  if (filteredStudents.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 3rem;">
          No student records found matching your filters.
        </td>
      </tr>
    `;
    return;
  }

  // Draw rows
  filteredStudents.forEach(student => {
    const tr = document.createElement('tr');

    // Avatar + Details Column
    const profileCell = document.createElement('td');
    profileCell.className = 'profile-cell';
    
    const initials = api.getInitials(student.name);
    const badgeClass = student.status === 'Active' ? 'badge-active' : (student.status === 'Graduated' ? 'badge-graduated' : 'badge-suspended');

    profileCell.innerHTML = `
      <div class="avatar-initials">${initials}</div>
      <div class="profile-details">
        <div class="profile-name">${student.name}</div>
        <div class="profile-subtext">${student.email}</div>
      </div>
    `;

    // ID + Status Badge Column
    const idCell = document.createElement('td');
    idCell.innerHTML = `
      <div style="font-weight: 600; color: #fff;">${student.id}</div>
      <span class="badge ${badgeClass}">${student.status}</span>
    `;

    // Enrolled Courses Tags Column
    const coursesCell = document.createElement('td');
    const tagsWrapper = document.createElement('div');
    tagsWrapper.className = 'course-tags';

    if (student.enrolledCourses && student.enrolledCourses.length > 0) {
      student.enrolledCourses.forEach(cId => {
        const tag = document.createElement('span');
        tag.className = 'course-tag';
        tag.textContent = cId;
        tagsWrapper.appendChild(tag);
      });
    } else {
      tagsWrapper.innerHTML = '<span style="color: var(--text-dark); font-size: 0.8rem; font-style: italic;">No enrollments</span>';
    }
    coursesCell.appendChild(tagsWrapper);

    // GPA Color Coding Column
    const gpaCell = document.createElement('td');
    const gpaVal = student.gpa;
    let excellenceClass = '';
    if (gpaVal >= 3.5) excellenceClass = 'excellent';
    
    gpaCell.innerHTML = `<span class="gpa-cell ${excellenceClass}">${gpaVal.toFixed(2)}</span>`;

    // Actions Button Column
    const actionsCell = document.createElement('td');
    actionsCell.style.textAlign = 'right';
    
    const actionsWrapper = document.createElement('div');
    actionsWrapper.className = 'row-actions';

    // Edit Button
    const editBtn = document.createElement('button');
    editBtn.className = 'icon-btn edit-btn';
    editBtn.title = 'Edit Student';
    editBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
    editBtn.addEventListener('click', () => openStudentModal(student));

    // Delete Button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-btn delete-btn';
    deleteBtn.title = 'Remove Student';
    deleteBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
    deleteBtn.addEventListener('click', () => handleDeleteStudent(student.id, student.name));

    actionsWrapper.appendChild(editBtn);
    actionsWrapper.appendChild(deleteBtn);
    actionsCell.appendChild(actionsWrapper);

    tr.appendChild(profileCell);
    tr.appendChild(idCell);
    tr.appendChild(coursesCell);
    tr.appendChild(gpaCell);
    tr.appendChild(actionsCell);
    tbody.appendChild(tr);
  });
}

// Modal open helper
function openStudentModal(student = null) {
  const modal = document.getElementById('student-modal');
  const title = document.getElementById('modal-title');
  const form = document.getElementById('student-form');
  
  form.reset();
  
  // Reset all course checkboxes
  document.querySelectorAll('.course-checkbox').forEach(cb => cb.checked = false);

  if (student) {
    // Mode: Edit
    activeEditStudentId = student.id;
    title.textContent = `Edit Profile: ${student.id}`;
    
    document.getElementById('student-name').value = student.name;
    document.getElementById('student-email').value = student.email;
    document.getElementById('student-phone').value = student.phone || '';
    document.getElementById('student-status').value = student.status;
    
    // Check course checkboxes
    if (student.enrolledCourses) {
      student.enrolledCourses.forEach(cId => {
        const cb = document.querySelector(`.course-checkbox[value="${cId}"]`);
        if (cb) cb.checked = true;
      });
    }
  } else {
    // Mode: Create
    activeEditStudentId = null;
    title.textContent = 'Add Student Profile';
    document.getElementById('student-status').value = 'Active';
  }

  modal.classList.add('open');
}

// Modal close helper
function closeStudentModal() {
  const modal = document.getElementById('student-modal');
  modal.classList.remove('open');
  activeEditStudentId = null;
}

// Form Submit Handler
async function handleFormSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('student-name').value.trim();
  const email = document.getElementById('student-email').value.trim();
  const phone = document.getElementById('student-phone').value.trim();
  const status = document.getElementById('student-status').value;
  
  // Gather selected checkboxes
  const enrolledCourses = [];
  document.querySelectorAll('.course-checkbox:checked').forEach(cb => {
    enrolledCourses.push(cb.value);
  });

  const payload = { name, email, phone, status, enrolledCourses };

  try {
    if (activeEditStudentId) {
      // API: Update
      await api.updateStudent(activeEditStudentId, payload);
      api.showToast(`Updated profile for ${name} successfully!`);
    } else {
      // API: Create
      await api.createStudent(payload);
      api.showToast(`Registered student ${name} successfully!`);
    }
    
    // Close modal, fetch fresh data and render
    closeStudentModal();
    init();
  } catch (error) {
    // Error is handled by api.request (shows toast)
    console.error('Submit error:', error);
  }
}

// Delete Handler
async function handleDeleteStudent(id, name) {
  const confirmed = confirm(`Are you sure you want to delete student ${name} (${id})?\nThis action will also remove all their course grades permanently.`);
  if (!confirmed) return;

  try {
    await api.deleteStudent(id);
    api.showToast(`Student ${name} removed successfully.`);
    init();
  } catch (error) {
    console.error('Delete student error:', error);
  }
}
