let coursesList = [];
let studentsList = [];
let activeEditCourseId = null; // null for add mode, contains course code for edit mode

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const btnAddCourse = document.getElementById('btn-add-course');
  const btnCancelCourse = document.getElementById('btn-cancel-course');
  const modalClose = document.getElementById('modal-close');
  const courseForm = document.getElementById('course-form');
  
  // Drawer Elements
  const drawerClose = document.getElementById('drawer-close');
  const drawerBackdrop = document.getElementById('drawer-backdrop');

  // Search & Filter listeners
  document.getElementById('search-course').addEventListener('input', renderCourseGrid);
  document.getElementById('filter-category').addEventListener('change', renderCourseGrid);

  // Modal control
  btnAddCourse.addEventListener('click', () => openCourseModal());
  btnCancelCourse.addEventListener('click', closeCourseModal);
  modalClose.addEventListener('click', closeCourseModal);
  
  // Drawer close control
  drawerClose.addEventListener('click', closeDrawer);
  drawerBackdrop.addEventListener('click', closeDrawer);

  // Form submit
  courseForm.addEventListener('submit', handleFormSubmit);

  // Load Initial Data
  init();
});

async function init() {
  try {
    const [courses, students] = await Promise.all([
      api.getCourses(),
      api.getStudents()
    ]);

    coursesList = courses;
    studentsList = students;

    renderCourseGrid();
  } catch (error) {
    console.error('Initialization error:', error);
    api.showToast('Could not load course list', 'error');
  }
}

// Render course cards grid
function renderCourseGrid() {
  const grid = document.getElementById('course-grid');
  const searchQuery = document.getElementById('search-course').value.toLowerCase().trim();
  const filterCategory = document.getElementById('filter-category').value;

  const filteredCourses = coursesList.filter(course => {
    const matchesSearch = course.id.toLowerCase().includes(searchQuery) ||
                          course.name.toLowerCase().includes(searchQuery) ||
                          course.instructor.toLowerCase().includes(searchQuery);

    const matchesCategory = filterCategory === '' || course.category === filterCategory;

    return matchesSearch && matchesCategory;
  });

  grid.innerHTML = '';

  if (filteredCourses.length === 0) {
    grid.innerHTML = `
      <p style="color: var(--text-muted); font-size: 0.95rem; width: 100%; grid-column: 1 / -1; text-align: center; padding: 4rem 0;">
        No courses found matching your criteria.
      </p>
    `;
    return;
  }

  filteredCourses.forEach(course => {
    const card = document.createElement('div');
    card.className = 'glass-panel course-card';

    // Click event to open roster drawer
    // We only trigger if the click isn't on actions
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.icon-btn') && !e.target.closest('.btn')) {
        openDrawer(course);
      }
    });

    card.innerHTML = `
      <div class="course-header">
        <span class="course-code">${course.id}</span>
        <span class="course-credits">${course.credits} Credits</span>
      </div>
      <h3 class="course-title">${course.name}</h3>
      <div class="course-instructor">
        <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
        ${course.instructor}
      </div>
      
      <div class="course-footer">
        <div class="course-stat">
          Students: <span>${course.studentCount}</span>
        </div>
        <div class="row-actions">
          <button class="icon-btn edit-btn" title="Edit Course Details">
            <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
          <button class="icon-btn delete-btn" title="Remove Course">
            <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </div>
    `;

    // Hook up buttons inside HTML string
    card.querySelector('.edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openCourseModal(course);
    });
    
    card.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeleteCourse(course.id, course.name);
    });

    grid.appendChild(card);
  });
}

// Drawer: Open Roster details
function openDrawer(course) {
  const backdrop = document.getElementById('drawer-backdrop');
  const panel = document.getElementById('drawer-panel');
  const title = document.getElementById('drawer-title');
  const subtitle = document.getElementById('drawer-subtitle');
  const list = document.getElementById('drawer-student-list');

  title.textContent = course.name;
  subtitle.textContent = `${course.id} • ${course.category} • Roster`;
  list.innerHTML = '';

  // Filter students who have this course code enrolled
  const enrolledStudents = studentsList.filter(s => s.enrolledCourses && s.enrolledCourses.includes(course.id));

  if (enrolledStudents.length === 0) {
    list.innerHTML = `
      <div style="text-align: center; color: var(--text-dark); padding: 3rem 0; font-size: 0.9rem; font-style: italic;">
        No students currently enrolled.
      </div>
    `;
  } else {
    enrolledStudents.forEach(student => {
      const studentDiv = document.createElement('div');
      studentDiv.className = 'glass-panel profile-cell';
      studentDiv.style.background = 'rgba(255, 255, 255, 0.02)';
      studentDiv.style.border = '1px solid rgba(255, 255, 255, 0.04)';
      studentDiv.style.padding = '0.85rem';
      
      const initials = api.getInitials(student.name);

      studentDiv.innerHTML = `
        <div class="avatar-initials" style="width: 32px; height: 32px; font-size: 0.75rem;">${initials}</div>
        <div class="profile-details">
          <div class="profile-name" style="font-size: 0.85rem;">${student.name}</div>
          <div class="profile-subtext" style="font-size: 0.7rem;">GPA: ${student.gpa.toFixed(2)}</div>
        </div>
      `;
      list.appendChild(studentDiv);
    });
  }

  backdrop.classList.add('open');
  panel.classList.add('open');
}

function closeDrawer() {
  document.getElementById('drawer-backdrop').classList.remove('open');
  document.getElementById('drawer-panel').classList.remove('open');
}

// Modal open/close helpers
function openCourseModal(course = null) {
  const modal = document.getElementById('course-modal');
  const title = document.getElementById('modal-title');
  const form = document.getElementById('course-form');
  const courseIdInput = document.getElementById('course-id');

  form.reset();

  if (course) {
    // Mode: Edit
    activeEditCourseId = course.id;
    title.textContent = `Edit Course: ${course.id}`;
    
    courseIdInput.value = course.id;
    courseIdInput.disabled = true; // Cannot edit the course code identifier
    
    document.getElementById('course-name').value = course.name;
    document.getElementById('course-instructor').value = course.instructor;
    document.getElementById('course-category').value = course.category;
    document.getElementById('course-credits').value = course.credits;
  } else {
    // Mode: Create
    activeEditCourseId = null;
    title.textContent = 'Register New Course';
    courseIdInput.disabled = false;
  }

  modal.classList.add('open');
}

function closeCourseModal() {
  document.getElementById('course-modal').classList.remove('open');
  activeEditCourseId = null;
}

// Handle course form submission
async function handleFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('course-id').value.trim();
  const name = document.getElementById('course-name').value.trim();
  const instructor = document.getElementById('course-instructor').value.trim();
  const category = document.getElementById('course-category').value;
  const credits = document.getElementById('course-credits').value;

  const payload = { id, name, instructor, category, credits };

  try {
    if (activeEditCourseId) {
      // API: Update
      await api.updateCourse(activeEditCourseId, payload);
      api.showToast(`Successfully updated course ${name}!`);
    } else {
      // API: Create
      await api.createCourse(payload);
      api.showToast(`Successfully registered new course ${name}!`);
    }

    closeCourseModal();
    init();
  } catch (error) {
    // Error notification handled by api.js
    console.error('Submit course error:', error);
  }
}

// Delete course handler
async function handleDeleteCourse(id, name) {
  const confirmed = confirm(`Are you sure you want to delete course ${name} (${id})?\nThis will remove it from all enrolled students and delete all corresponding grades.`);
  if (!confirmed) return;

  try {
    await api.deleteCourse(id);
    api.showToast(`Course ${name} has been removed.`);
    init();
  } catch (error) {
    console.error('Delete course error:', error);
  }
}
