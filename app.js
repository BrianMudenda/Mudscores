// app.js – Mudscore application logic

// ==================== CONFIGURATION ====================
// 🔴 REPLACE WITH YOUR SUPABASE PROJECT DETAILS
const SUPABASE_URL = 'https://tyfycbnpnmssouzbcpjm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5ZnljYm5wbm1zc291emJjcGptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NzU5NDAsImV4cCI6MjA4NzE1MTk0MH0.d-WHRo1r6Mz_av7TOgvEAakmNzAVBQ8JsEdwRPBuv2o';

// Initialize Supabase client (correct way)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== DOM ELEMENTS ====================
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
const scoreModal = document.getElementById('score-modal');
const modalTitle = document.getElementById('modal-title');
const scoreForm = document.getElementById('score-form');
const scoreIdInput = document.getElementById('score-id');
const examNameInput = document.getElementById('exam-name');
const examYearInput = document.getElementById('exam-year');
const examScoreInput = document.getElementById('exam-score');
const cancelBtn = document.getElementById('cancel-btn');

// ==================== UTILITY FUNCTIONS ====================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showError(message) {
  alert('Error: ' + message);
}

// ==================== AUTHENTICATION ====================
async function checkUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    authSection.style.display = 'none';
    scoresSection.style.display = 'block';
    loadScores();
    setupRealtime();
  } else {
    authSection.style.display = 'block';
    scoresSection.style.display = 'none';
  }
}

async function signUp(email, password) {
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    alert('Sign-up successful! Check your email for confirmation (if enabled).');
  } catch (err) {
    showError(err.message);
  }
}

async function signIn(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    authSection.style.display = 'none';
    scoresSection.style.display = 'block';
    loadScores();
    setupRealtime();
  } catch (err) {
    showError(err.message);
  }
}

async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    authSection.style.display = 'block';
    scoresSection.style.display = 'none';
    scoresList.innerHTML = '';
  } catch (err) {
    showError(err.message);
  }
}

// ==================== SCORES CRUD ====================
async function loadScores() {
  try {
    const { data: scores, error } = await supabase
      .from('scores')
      .select('*')
      .order('year', { ascending: false });

    if (error) throw error;
    displayScores(scores || []);
  } catch (err) {
    showError('Failed to load scores: ' + err.message);
  }
}

function displayScores(scores) {
  if (scores.length === 0) {
    scoresList.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;">No scores yet. Click "Add New Score" to get started.</td></tr>';
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

// Open modal for adding
function openAddModal() {
  modalTitle.textContent = 'Add Exam Score';
  scoreIdInput.value = '';
  examNameInput.value = '';
  examYearInput.value = '';
  examScoreInput.value = '';
  scoreModal.style.display = 'flex';
}

// Open modal for editing
window.editScore = async function(id) {
  try {
    const { data, error } = await supabase
      .from('scores')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    
    modalTitle.textContent = 'Edit Exam Score';
    scoreIdInput.value = data.id;
    examNameInput.value = data.exam_name;
    examYearInput.value = data.year;
    examScoreInput.value = data.score;
    scoreModal.style.display = 'flex';
  } catch (err) {
    showError('Could not load score: ' + err.message);
  }
};

// Save (insert or update)
async function saveScore(event) {
  event.preventDefault();
  
  const id = scoreIdInput.value;
  const exam_name = examNameInput.value.trim();
  const year = parseInt(examYearInput.value.trim(), 10);
  const score = examScoreInput.value.trim();

  if (!exam_name || !year || !score) {
    showError('Please fill in all fields.');
    return;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    let result;
    if (id) {
      // Update
      result = await supabase
        .from('scores')
        .update({ exam_name, year, score })
        .eq('id', id);
    } else {
      // Insert
      result = await supabase
        .from('scores')
        .insert([{ user_id: user.id, exam_name, year, score }]);
    }

    if (result.error) throw result.error;
    
    closeModal();
    loadScores(); // refresh
  } catch (err) {
    showError('Save failed: ' + err.message);
  }
}

// Delete
window.deleteScore = async function(id) {
  if (!confirm('Are you sure you want to delete this score?')) return;
  
  try {
    const { error } = await supabase
      .from('scores')
      .delete()
      .eq('id', id);
    if (error) throw error;
    loadScores();
  } catch (err) {
    showError('Delete failed: ' + err.message);
  }
};

// Close modal
function closeModal() {
  scoreModal.style.display = 'none';
}

// ==================== REAL-TIME UPDATES ====================
function setupRealtime() {
  supabase
    .channel('scores-changes')
    .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'scores' },
        () => {
          loadScores(); // reload on any change
        })
    .subscribe();
}

// ==================== EVENT LISTENERS ====================
signInBtn.addEventListener('click', () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (email && password) signIn(email, password);
  else showError('Please enter email and password.');
});

signUpBtn.addEventListener('click', () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (email && password) signUp(email, password);
  else showError('Please enter email and password.');
});

logoutBtn.addEventListener('click', signOut);

addScoreBtn.addEventListener('click', openAddModal);

scoreForm.addEventListener('submit', saveScore);

cancelBtn.addEventListener('click', closeModal);

window.addEventListener('click', (e) => {
  if (e.target === scoreModal) closeModal();
});

// Initialize
checkUser();
