const API_BASE = window.location.port === '3000' ? '/api' : 'http://localhost:3000/api';

const api = {
  // Utility fetch wrapper
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    
    // Set headers if JSON payload is provided
    if (options.body && typeof options.body === 'object') {
      options.body = JSON.stringify(options.body);
      options.headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };
    }

    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`API Error on ${endpoint}:`, error);
      this.showToast(error.message || 'Something went wrong', 'error');
      throw error;
    }
  },

  // Dashboard stats
  getStats() {
    return this.request('/dashboard/stats');
  },

  // Students CRUD
  getStudents() {
    return this.request('/students');
  },

  createStudent(data) {
    return this.request('/students', { method: 'POST', body: data });
  },

  updateStudent(id, data) {
    return this.request(`/students/${id}`, { method: 'PUT', body: data });
  },

  deleteStudent(id) {
    return this.request(`/students/${id}`, { method: 'DELETE' });
  },

  // Courses CRUD
  getCourses() {
    return this.request('/courses');
  },

  createCourse(data) {
    return this.request('/courses', { method: 'POST', body: data });
  },

  updateCourse(id, data) {
    return this.request(`/courses/${id}`, { method: 'PUT', body: data });
  },

  deleteCourse(id) {
    return this.request(`/courses/${id}`, { method: 'DELETE' });
  },

  // Grades CRUD
  getGrades() {
    return this.request('/grades');
  },

  updateGrade(studentId, courseId, grade) {
    return this.request('/grades', { method: 'PUT', body: { studentId, courseId, grade } });
  },

  // Dynamic Avatar Initials Helper
  getInitials(name) {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  },

  // Premium Toast Notification System
  showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // SVG icons
    const successIcon = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`;
    const errorIcon = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
    
    toast.innerHTML = `
      <div class="toast-icon">${type === 'success' ? successIcon : errorIcon}</div>
      <div class="toast-message">${message}</div>
    `;

    container.appendChild(toast);

    // Fade out and remove
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.4s ease-in forwards';
      toast.addEventListener('animationend', () => {
        toast.remove();
        if (container.children.length === 0) {
          container.remove();
        }
      });
    }, 3500);
  }
};
