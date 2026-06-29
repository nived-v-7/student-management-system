document.addEventListener('DOMContentLoaded', () => {
  // Update header current date
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', dateOptions);

  // Load dashboard data
  loadDashboardData();
});

async function loadDashboardData() {
  try {
    const stats = await api.getStats();

    // 1. Populate stats cards
    document.getElementById('stat-students').textContent = stats.totals.students;
    document.getElementById('stat-courses').textContent = stats.totals.courses;
    document.getElementById('stat-gpa').textContent = stats.totals.avgGPA.toFixed(2);
    document.getElementById('stat-enrollments').textContent = stats.totals.enrollments;

    // 2. Render Course Categories Chart
    renderChart(stats.courseCategories);

    // 3. Render Activities List
    renderActivities(stats.recentActivities);
  } catch (error) {
    console.error('Failed to load dashboard statistics:', error);
    api.showToast('Could not fetch dashboard analytics', 'error');
  }
}

function renderChart(categories) {
  const chartContainer = document.getElementById('category-chart');
  chartContainer.innerHTML = '';

  const entries = Object.entries(categories);
  if (entries.length === 0) {
    chartContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem; width: 100%; text-align: center;">No course data available</p>';
    return;
  }

  // Find max value to determine percentages
  const maxVal = Math.max(...entries.map(([_, val]) => val));

  entries.forEach(([category, count]) => {
    const percentage = maxVal > 0 ? (count / maxVal) * 80 : 10; // Cap height at 80% of container height for padding
    
    const barWrapper = document.createElement('div');
    barWrapper.className = 'chart-bar-wrapper';

    // Build the visual bar element
    const bar = document.createElement('div');
    bar.className = 'chart-bar';
    bar.style.height = '0%'; // Start at 0% for animation
    
    const valueSpan = document.createElement('span');
    valueSpan.className = 'chart-bar-value';
    valueSpan.textContent = count;
    bar.appendChild(valueSpan);

    const label = document.createElement('span');
    label.className = 'chart-bar-label';
    label.textContent = category;

    barWrapper.appendChild(bar);
    barWrapper.appendChild(label);
    chartContainer.appendChild(barWrapper);

    // Trigger animation frame so transition plays
    setTimeout(() => {
      bar.style.height = `${percentage}%`;
    }, 100);
  });
}

function renderActivities(activities) {
  const activityContainer = document.getElementById('activity-list');
  activityContainer.innerHTML = '';

  if (activities.length === 0) {
    activityContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No recent activities logged.</p>';
    return;
  }

  activities.forEach(act => {
    const item = document.createElement('div');
    item.className = 'activity-item';

    const bullet = document.createElement('div');
    bullet.className = 'activity-bullet';

    const details = document.createElement('div');
    details.className = 'activity-details';

    const text = document.createElement('div');
    text.className = 'activity-text';
    text.textContent = act.message;

    const time = document.createElement('div');
    time.className = 'activity-time';
    time.textContent = formatTimeAgo(act.timestamp);

    details.appendChild(text);
    details.appendChild(time);
    item.appendChild(bullet);
    item.appendChild(details);
    activityContainer.appendChild(item);
  });
}

// Format timestamp to user-friendly "time ago" string
function formatTimeAgo(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  
  if (diffMs < 0) return 'Just now';
  
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
