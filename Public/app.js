document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const registrationForm = document.getElementById('registrationForm');
  const profileForm = document.getElementById('profileForm');
  const userForm = document.getElementById('userForm');
  const projectForm = document.getElementById('projectForm');
  const timeEntryForm = document.getElementById('timeEntryForm');
  const timeEntriesList = document.getElementById('timeEntriesList');
  const projectsList = document.getElementById('projectsList');
  const projectSelect = document.getElementById('dashboardProject');
  const clientSelect = document.getElementById('dashboardClient');
  const userSelect = document.getElementById('dashboardUser'); // Nowy dropdown dla użytkowników
  const usersList = document.getElementById('usersList');
  const mainNav = document.getElementById('main-nav');
  const showDashboardBtn = document.getElementById('showDashboard');
  const showTimeEntryBtn = document.getElementById('showTimeEntry');
  const showTimeListBtn = document.getElementById('showTimeList');
  const showProjectsBtn = document.getElementById('showProjects');
  const showUsersBtn = document.getElementById('showUsers');
  const logoutBtn = document.getElementById('logout');
  const updateDashboardBtn = document.getElementById('updateDashboard');
  const exportDataBtn = document.getElementById('exportDataButton');

  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  if (!token) {
    showSection('loginSection');
  } else {
    mainNav.classList.remove('hidden');
    if (role === 'admin') {
      showProjectsBtn.classList.remove('hidden');
      showUsersBtn.classList.remove('hidden');
    } else {
      showProjectsBtn.classList.add('hidden');
      showUsersBtn.classList.add('hidden');
    }
    showSection('dashboardSection');
    loadDashboard();
    loadProjects();
    loadTimeEntries();
    loadUsers();
  }

  function showSection(sectionId) {
    console.log(`Switching to section: ${sectionId}`);
    document.querySelectorAll('main > section').forEach(section => {
      section.classList.add('hidden');
    });
    document.getElementById(sectionId).classList.remove('hidden');
  }

  async function authenticateUser(email, password) {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        mainNav.classList.remove('hidden');
        if (data.role === 'admin') {
          showProjectsBtn.classList.remove('hidden');
          showUsersBtn.classList.remove('hidden');
        }
        showSection('dashboardSection');
        loadDashboard();
        loadProjects();
        loadTimeEntries();
        loadUsers();
        showConfirmation('Login successful!');
      } else {
        const errorData = await response.json();
        showError(`Error logging in: ${errorData.error}. ${errorData.details || ''}`);
      }
    } catch (error) {
      console.error('Error:', error);
      showError('An error occurred. Please try again.');
    }
  }

  async function registerUser(username, email, password) {
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      });

      if (response.ok) {
        showConfirmation('Registration successful! Please log in.');
        showSection('loginSection');
      } else {
        const errorData = await response.json();
        showError(`Error registering: ${errorData.error}. ${errorData.details || ''}`);
      }
    } catch (error) {
      console.error('Error:', error);
      showError('An error occurred. Please try again.');
    }
  }

  async function loadDashboard() {
    const startDate = document.getElementById('dashboardStartDate').value;
    const endDate = document.getElementById('dashboardEndDate').value;
    const projectId = document.getElementById('dashboardProject').value;
    const client = document.getElementById('dashboardClient').value;
    const userId = document.getElementById('dashboardUser').value; // Pobierz wybranego użytkownika

    try {
      const response = await fetch(
        `/api/dashboard?startDate=${startDate}&endDate=${endDate}&project_id=${projectId}&client=${client}&user_id=${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        document.getElementById('totalHours').textContent = data.totalHours;
        document.getElementById('projectsInProgress').textContent = data.projectsInProgress;
        document.getElementById('topClient').textContent = data.topClient;
        drawBarChart('chartContainer', data);

        populateDropdowns(data.projects, 'dashboardProject');
        populateDropdowns(data.clients, 'dashboardClient');
        populateDropdowns(data.users, 'dashboardUser'); // Dodaj użytkowników do dropdownu
      } else {
        showError('Failed to update dashboard');
      }
    } catch (error) {
      console.error('Error updating dashboard:', error);
      showError('An error occurred while updating the dashboard');
    }
  }

  async function loadProjects() {
    try {
      const response = await fetch('/api/projects', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const projects = await response.json();
        if (projectsList) {
          projectsList.innerHTML = projects
            .map(
              (project) => `
            <div class="project-item">
                <h3>${project.name} (${project.number})</h3>
                <p>Client: ${project.client}</p>
                <p>Address: ${project.street}, ${project.city}</p>
                ${
                  role === 'admin'
                    ? `
                <button onclick="editProject(${project.id})">Edit</button>
                <button onclick="deleteProject(${project.id})">Delete</button>
                `
                    : ''
                }
            </div>
        `
            )
            .join('');
        }
        if (projectSelect) {
          projectSelect.innerHTML =
            '<option value="">All Projects</option>' +
            projects
              .map(
                (project) => `
                <option value="${project.id}">${project.name}</option>
            `
              )
              .join('');
        }
      } else {
        showError('Failed to load projects');
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      showError('An error occurred while loading projects');
    }
  }

  async function loadTimeEntries(sortBy = 'date', filterUser = '', filterProject = '', filterDateRange = {}) {
    try {
      const queryParams = new URLSearchParams({
        sortBy,
        filterUser,
        filterProject,
        startDate: filterDateRange.start || '',
        endDate: filterDateRange.end || ''
      });

      const response = await fetch(`/api/timeentries?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const timeEntries = await response.json();
        renderTimeEntries(timeEntries);
      } else {
        showError('Failed to load time entries');
      }
    } catch (error) {
      console.error('Error loading time entries:', error);
      showError('An error occurred while loading time entries');
    }
  }

  function renderTimeEntries(timeEntries) {
    timeEntriesList.innerHTML = timeEntries.map(entry => `
      <tr>
        <td>${entry.project_name}</td>
        <td>${entry.client}</td>
        <td>${new Date(entry.date).toLocaleDateString()}</td>
        <td>${entry.start_time}</td>
        <td>${entry.end_time}</td>
        <td>${entry.duration}</td>
        <td>${entry.notes}</td>
        <td>
          <button onclick="editTimeEntry(${entry.id})">Edit</button>
          ${role === 'admin' ? `<button onclick="deleteTimeEntry(${entry.id})">Delete</button>` : ''}
        </td>
      </tr>
    `).join('');
  }

  async function loadUsers() {
    if (role !== 'admin') return; // Only load users for admin

    try {
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const users = await response.json();
        usersList.innerHTML = users
          .map(
            (user) => `
            <div class="user-item">
                <h3>${user.username}</h3>
                <p>Email: ${user.email}</p>
                <p>Role: ${user.role}</p>
                <button onclick="editUser(${user.id})">Edit</button>
                <button onclick="deleteUser(${user.id})">Delete</button>
            </div>
        `
          )
          .join('');
      } else {
        showError('Failed to load users');
      }
    } catch (error) {
      console.error('Error loading users:', error);
      showError('An error occurred while loading users');
    }
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      authenticateUser(email, password);
    });
  }

  if (registrationForm) {
    registrationForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('registerUsername').value;
      const email = document.getElementById('registerEmail').value;
      const password = document.getElementById('registerPassword').value;
      registerUser(username, email, password);
    });
  }

  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = {
        username: document.getElementById('profileUsername').value,
        email: document.getElementById('profileEmail').value,
        password: document.getElementById('profilePassword').value,
        avatar: document.getElementById('profileAvatar').value,
      };

      try {
        const response = await fetch('/api/user/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          showConfirmation('Profile updated successfully!');
        } else {
          const errorData = await response.json();
          showError(`Error updating profile: ${errorData.error}. ${errorData.details || ''}`);
        }
      } catch (error) {
        console.error('Error:', error);
        showError('An error occurred. Please try again.');
      }
    });
  }

  if (userForm) {
    userForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = {
        username: document.getElementById('userUsername').value,
        email: document.getElementById('userEmail').value,
        password: document.getElementById('userPassword').value,
        role: document.getElementById('userRole').value,
      };
      const userId = userForm.dataset.userId;

      try {
        let response;
        if (userId) {
          response = await fetch(`/api/user/${userId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify(formData),
          });
        } else {
          response = await fetch('/api/user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify(formData),
          });
        }

        if (response.ok) {
          showConfirmation('User updated successfully!');
          await loadUsers();
        } else {
          const errorData = await response.json();
          showError(`Error updating user: ${errorData.error}. ${errorData.details || ''}`);
        }
      } catch (error) {
        console.error('Error:', error);
        showError('An error occurred. Please try again.');
      }
    });
  }

  if (projectForm) {
    projectForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = {
        name: document.getElementById('projectName').value,
        number: document.getElementById('projectNumber').value,
        client: document.getElementById('projectClient').value,
        street: document.getElementById('projectStreet').value,
        city: document.getElementById('projectCity').value,
      };
      const projectId = projectForm.dataset.projectId;

      try {
        let response;
        if (projectId) {
          response = await fetch(`/api/projects/${projectId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify(formData),
          });
        } else {
          response = await fetch('/api/projects', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify(formData),
          });
        }

        if (response.ok) {
          showConfirmation('Project saved successfully!');
          await loadProjects();
        } else {
          const errorData = await response.json();
          showError(`Error saving project: ${errorData.error}. ${errorData.details || ''}`);
        }
      } catch (error) {
        console.error('Error:', error);
        showError('An error occurred. Please try again.');
      }
    });
  }

  if (timeEntryForm) {
    timeEntryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = {
        date: document.getElementById('timeEntryDate').value,
        projectId: document.getElementById('timeEntryProject').value,
        startTime: document.getElementById('timeEntryStartTime').value,
        endTime: document.getElementById('timeEntryEndTime').value,
        notes: document.getElementById('timeEntryNotes').value,
      };
      const timeEntryId = timeEntryForm.dataset.timeEntryId;

      try {
        let response;
        if (timeEntryId) {
          response = await fetch(`/api/timeentries/${timeEntryId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify(formData),
          });
        } else {
          response = await fetch('/api/timeentries', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify(formData),
          });
        }

        if (response.ok) {
          showConfirmation('Time entry saved successfully!');
          await loadTimeEntries();
        } else {
          const errorData = await response.json();
          showError(`Error saving time entry: ${errorData.error}. ${errorData.details || ''}`);
        }
      } catch (error) {
        console.error('Error:', error);
        showError('An error occurred. Please try again.');
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      window.location.reload();
    });
  }

  if (updateDashboardBtn) {
    updateDashboardBtn.addEventListener('click', loadDashboard);
  }

  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', exportData);
  }

  // Utility Functions

  function showError(message) {
    const errorModal = document.createElement('div');
    errorModal.classList.add('modal', 'error');
    errorModal.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <p>${message}</p>
        </div>
    `;
    document.body.appendChild(errorModal);

    errorModal.style.display = 'block';
    setTimeout(() => errorModal.style.display = 'none', 3000);

    const closeBtn = errorModal.querySelector('.close');
    closeBtn.onclick = () => errorModal.style.display = 'none';
  }

  function showConfirmation(message) {
    const confirmationModal = document.createElement('div');
    confirmationModal.classList.add('modal', 'confirmation');
    confirmationModal.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <p>${message}</p>
        </div>
    `;
    document.body.appendChild(confirmationModal);

    confirmationModal.style.display = 'block';
    setTimeout(() => confirmationModal.style.display = 'none', 3000);

    const closeBtn = confirmationModal.querySelector('.close');
    closeBtn.onclick = () => confirmationModal.style.display = 'none';
  }

  function drawBarChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.error('Chart container not found');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Unable to get canvas context');
      return;
    }

    const chartData = [
      { label: 'Total Hours', value: data.totalHours },
      { label: 'Projects In Progress', value: data.projectsInProgress },
      { label: 'Top Client', value: 1 } // Assuming a fixed value for demonstration
    ];

    const width = canvas.width;
    const height = canvas.height;
    const padding = 50;
    const barWidth = (width - padding * 2) / chartData.length;
    const maxValue = Math.max(...chartData.map(d => d.value));

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw bars
    chartData.forEach((item, index) => {
      const x = padding + index * barWidth;
      const barHeight = (item.value / maxValue) * (height - padding * 2);
      const y = height - padding - barHeight;

      // Draw the bar
      ctx.fillStyle = 'steelblue';
      ctx.fillRect(x, y, barWidth - 10, barHeight);

      // Draw the label
      ctx.fillStyle = '#000';
      ctx.textAlign = 'center';
      ctx.fillText(item.label, x + barWidth / 2 - 5, height - padding / 2);

      // Draw the value
      ctx.fillText(item.value, x + barWidth / 2 - 5, y - 10);
    });

    // Draw axes
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
  }

  function populateDropdowns(items, elementId) {
    const dropdown = document.getElementById(elementId);
    dropdown.innerHTML = '<option value="">All</option>' + items.map(item => `<option value="${item.id}">${item.name}</option>`).join('');
  }

  function exportData() {
    const startDate = document.getElementById('dashboardStartDate').value;
    const endDate = document.getElementById('dashboardEndDate').value;
    const projectId = document.getElementById('dashboardProject').value;
    const client = document.getElementById('dashboardClient').value;

    const queryParams = new URLSearchParams({
      startDate,
      endDate,
      projectId,
      client
    });

    fetch(`/api/export?${queryParams.toString()}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    })
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report_${new Date().toISOString()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch(error => {
        console.error('Error exporting data:', error);
        showError('An error occurred while exporting data');
      });
  }
});
