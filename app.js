// app.js - Handles authentication and database operations for Mudscore

// ==================== CONFIGURATION ====================
// 🔴 REPLACE THESE WITH YOUR SUPABASE PROJECT DETAILS 🔴
const SUPABASE_URL = 'https://tyfycbnpnmssouzbcpjm.supabase.co';   // Your Project URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5ZnljYm5wbm1zc291emJjcGptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NzU5NDAsImV4cCI6MjA4NzE1MTk0MH0.d-WHRo1r6Mz_av7TOgvEAakmNzAVBQ8JsEdwRPBuv2o';                     // Your anon public key

// Initialize Supabase client
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM elements
const authSection = document.getElementById('auth-section');
const scoresSection = document.getElementById('scores-section');
const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const signInBtn = document.getElementById('signin-btn');
const signUpBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');
const scoresList = document.getElementById('scores-list');
const addScoreBtn = document.getElementById('add-score-btn');
const scoreFormModal = document.getElementById('score-form-modal');
const scoreForm = document.getElementById('score-form');
const modalTitle = document.getElementById('modal-title');
const scoreIdInput = document.getElementById('score-id');
const examNameInput = document.getElementById('exam-name');
const examYearInput = document.getElementById('exam-year');
const examScoreInput = document.getElementById('exam-score');
const cancelScoreBtn = document.getElementById('cancel-score-btn');

// ==================== AUTHENTICATION ====================

// Check if user is already logged in on page load
async function checkUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    // User is signed in
    authSection.style.display = 'none';
    scoresSection.style.display = 'block';
    loadScores();           // Load scores from database
    setupRealtimeSubscription(); // Listen for real-time changes
  } else {
    // No user
    authSection.style.display = 'block';
    scoresSection.style.display = 'none';
  }
}

// Sign Up
async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    alert('Sign up error: ' + error.message);
  } else {
    alert('Check your email for confirmation! (If email confirmation is enabled)');
  }
}

// Sign In
async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    alert('Login error: ' + error.message);
  } else {
    // Success – update UI
    authSection.style.display = 'none';
    scoresSection.style.display = 'block';
    loadScores();
    setupRealtimeSubscription();
  }
}

// Sign Out
async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    alert('Logout error: ' + error.message);
  } else {
    authSection.style.display = 'block';
    scoresSection.style.display = 'none';
    scoresList.innerHTML = ''; // Clear the table
  }
}

// ==================== SCORES (CRUD) ====================

// Load scores from Supabase
async function loadScores() {
  const { data: scores, error } = await supabase
    .from('scores')
    .select('*')
    .order('year', { ascending: false }); // Show newest first

  if (error) {
    console.error('Error loading scores:', error);
    alert('Could not load scores.');
  } else {
    displayScores(scores);
  }
}

// Display scores in the table
function displayScores(scores) {
  if (!scores || scores.length === 0) {
    scoresList.innerHTML = '<tr><td colspan="4" style="text-align:center;">No scores yet. Click "Add new" to create one!</td></tr>';
    return;
  }

  let html = '';
  scores.forEach(score => {
    html += `
      <tr>
        <td>${escapeHtml(score.exam_name)}</td>
        <td>${escapeHtml(score.year)}</td>
        <td>${escapeHtml(score.score)}</td>
        <td>
          <button class="action-btn edit-btn" onclick="editScore('${score.id}')">Edit</button>
          <button class="action-btn delete-btn" onclick="deleteScore('${score.id}')">Delete</button>
        </td>
      </tr>
    `;
  });
  scoresList.innerHTML = html;
}

// Helper to escape HTML (prevent XSS)
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Open modal for adding a new score
function openAddModal() {
  modalTitle.textContent = 'Add Exam Score';
  scoreIdInput.value = '';          // Clear hidden ID
  examNameInput.value = '';
  examYearInput.value = '';
  examScoreInput.value = '';
  scoreFormModal.style.display = 'flex';
}

// Open modal for editing an existing score
window.editScore = async function(id) {
  // Fetch the score from Supabase (or we could use cached data, but fetch to be safe)
  const { data, error } = await supabase
    .from('scores')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    alert('Error fetching score: ' + error?.message);
    return;
  }

  modalTitle.textContent = 'Edit Exam Score';
  scoreIdInput.value = data.id;
  examNameInput.value = data.exam_name;
  examYearInput.value = data.year;
  examScoreInput.value = data.score;
  scoreFormModal.style.display = 'flex';
};

// Save score (insert or update)
async function saveScore(event) {
  event.preventDefault(); // Prevent form from refreshing page

  const id = scoreIdInput.value;
  const exam_name = examNameInput.value.trim();
  const year = parseInt(examYearInput.value.trim(), 10);
  const score = examScoreInput.value.trim();

  if (!exam_name || !year || !score) {
    alert('Please fill in all fields');
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert('You must be logged in.');
    return;
  }

  let error;
  if (id) {
    // Update existing score
    const { error: updateError } = await supabase
      .from('scores')
      .update({ exam_name, year, score })
      .eq('id', id);
    error = updateError;
  } else {
    // Insert new score
    const { error: insertError } = await supabase
      .from('scores')
      .insert([{ user_id: user.id, exam_name, year, score }]);
    error = insertError;
  }

  if (error) {
    alert('Error saving score: ' + error.message);
  } else {
    // Close modal and refresh list (real-time will also update, but we refresh to be safe)
    scoreFormModal.style.display = 'none';
    loadScores(); // Refresh list
  }
}

// Delete score
window.deleteScore = async function(id) {
  if (!confirm('Are you sure you want to delete this score?')) return;

  const { error } = await supabase
    .from('scores')
    .delete()
    .eq('id', id);

  if (error) {
    alert('Error deleting score: ' + error.message);
  } else {
    loadScores(); // Refresh list
  }
};

// Close modal
function closeModal() {
  scoreFormModal.style.display = 'none';
}

// ==================== REAL-TIME UPDATES ====================

// Listen for changes in the scores table and update the UI automatically
function setupRealtimeSubscription() {
  supabase
    .channel('scores-changes')
    .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'scores' }, 
        (payload) => {
          console.log('Change received!', payload);
          loadScores(); // Reload scores when any change happens
        })
    .subscribe();
}

// ==================== EVENT LISTENERS ====================

signUpBtn.addEventListener('click', () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (email && password) {
    signUp(email, password);
  } else {
    alert('Please enter email and password.');
  }
});

signInBtn.addEventListener('click', () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (email && password) {
    signIn(email, password);
  } else {
    alert('Please enter email and password.');
  }
});

logoutBtn.addEventListener('click', signOut);

addScoreBtn.addEventListener('click', openAddModal);

scoreForm.addEventListener('submit', saveScore);

cancelScoreBtn.addEventListener('click', closeModal);

// Close modal if user clicks outside of it
window.addEventListener('click', (event) => {
  if (event.target === scoreFormModal) {
    closeModal();
  }
});

// Check user session when page loads
checkUser();