const urlInput = document.getElementById('url-input');
const importBtn = document.getElementById('import-btn');
const statusDiv = document.getElementById('status');
const progressFill = document.getElementById('progress-fill');
const statusMessage = document.getElementById('status-message');
const resultDiv = document.getElementById('result');
const previewDiv = document.getElementById('preview');
const previewTitle = document.getElementById('preview-title');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');

const uploadArea = document.getElementById('upload-area');
const photoInput = document.getElementById('photo-input');
const textInput = document.getElementById('text-input');
const textImportBtn = document.getElementById('text-import-btn');

const servingsSelect = document.getElementById('edit-servings');

let currentJobId = null;
let currentUsage = null;
let baseServings = 4;
let baseIngredients = '';

importBtn.addEventListener('click', startImport);
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startImport();
});
saveBtn.addEventListener('click', confirmAndSave);
cancelBtn.addEventListener('click', resetUI);
servingsSelect.addEventListener('change', rescaleIngredients);

// Text-Import
textImportBtn.addEventListener('click', startTextImport);

// Foto-Upload
uploadArea.addEventListener('click', () => photoInput.click());
photoInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handlePhoto(e.target.files[0]);
});
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('dragover');
});
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) handlePhoto(file);
});

async function startImport() {
  const url = urlInput.value.trim();
  if (!url) return;

  importBtn.disabled = true;
  statusDiv.classList.remove('hidden');
  previewDiv.classList.add('hidden');
  resultDiv.classList.add('hidden');
  resultDiv.className = 'result hidden';
  progressFill.style.width = '0%';
  statusMessage.textContent = 'Starte Import...';

  try {
    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const { jobId, error } = await res.json();
    if (error) throw new Error(error);

    currentJobId = jobId;
    pollStatus(jobId);
  } catch (err) {
    showError(err.message);
  }
}

function pollStatus(jobId) {
  const interval = setInterval(async () => {
    try {
      const res = await fetch(`/api/status/${jobId}`);
      const job = await res.json();

      progressFill.style.width = `${job.progress}%`;
      statusMessage.textContent = job.message;

      if (job.step === 'preview') {
        clearInterval(interval);
        currentUsage = job.usage;
        showPreview(job.recipe);
      } else if (job.step === 'done') {
        clearInterval(interval);
        showSuccess(job.notionUrl, job.usage);
      } else if (job.step === 'error') {
        clearInterval(interval);
        showError(job.error || 'Unbekannter Fehler');
      }
    } catch {
      clearInterval(interval);
      showError('Verbindung zum Server verloren');
    }
  }, 1500);
}

function showPreview(recipe) {
  statusDiv.classList.add('hidden');
  previewDiv.classList.remove('hidden');
  previewTitle.textContent = `${recipe.emoji} ${recipe.name}`;

  baseServings = recipe.servings || 4;
  baseIngredients = recipe.ingredients;

  document.getElementById('edit-name').value = recipe.name;
  servingsSelect.value = baseServings;
  document.getElementById('edit-cookingTime').value = recipe.cookingTime;
  document.getElementById('edit-calories').value = recipe.calories;
  document.getElementById('edit-tags').value = recipe.tags.join(', ');
  document.getElementById('edit-ingredients').value = recipe.ingredients;
  document.getElementById('edit-instructions').value = recipe.instructions;
  document.getElementById('edit-notes').value = '';
}

function rescaleIngredients() {
  const newServings = parseInt(servingsSelect.value);
  const factor = newServings / baseServings;

  const scaled = baseIngredients.split('\n').map(line => {
    return line.replace(/^(-\s*)(\d+([.,]\d+)?)\s*/, (match, prefix, num) => {
      const val = parseFloat(num.replace(',', '.'));
      const newVal = Math.round(val * factor * 10) / 10;
      const formatted = newVal % 1 === 0 ? newVal.toString() : newVal.toString().replace('.', ',');
      return `${prefix}${formatted} `;
    });
  }).join('\n');

  document.getElementById('edit-ingredients').value = scaled;
}

async function confirmAndSave() {
  if (!currentJobId) return;

  saveBtn.disabled = true;
  saveBtn.textContent = 'Speichert...';

  const recipe = {
    name: document.getElementById('edit-name').value,
    cookingTime: document.getElementById('edit-cookingTime').value,
    calories: parseInt(document.getElementById('edit-calories').value) || 0,
    servings: parseInt(servingsSelect.value),
    tags: document.getElementById('edit-tags').value.split(',').map(t => t.trim()).filter(Boolean),
    ingredients: document.getElementById('edit-ingredients').value,
    instructions: document.getElementById('edit-instructions').value,
  };
  const notes = document.getElementById('edit-notes').value.trim() || undefined;

  try {
    const res = await fetch(`/api/confirm/${currentJobId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe, notes }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    previewDiv.classList.add('hidden');
    showSuccess(data.notionUrl, currentUsage);
  } catch (err) {
    showError(err.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'In Notion speichern';
  }
}

function showSuccess(notionUrl, usage) {
  importBtn.disabled = false;
  resultDiv.classList.remove('hidden');
  resultDiv.classList.add('success');
  const link = notionUrl
    ? `Rezept gespeichert! <a href="${notionUrl}" target="_blank">In Notion oeffnen</a>`
    : 'Rezept erfolgreich gespeichert!';
  const cost = usage
    ? `<span class="usage">${usage.inputTokens + usage.outputTokens} Tokens · ${usage.costCents.toFixed(2)}¢</span>`
    : '';
  resultDiv.innerHTML = `${link} ${cost}`;
}

function showError(msg) {
  importBtn.disabled = false;
  resultDiv.classList.remove('hidden');
  resultDiv.classList.add('error');
  resultDiv.textContent = msg;
}

async function startTextImport() {
  const text = textInput.value.trim();
  if (!text) return;

  textImportBtn.disabled = true;
  importBtn.disabled = true;
  statusDiv.classList.remove('hidden');
  previewDiv.classList.add('hidden');
  resultDiv.classList.add('hidden');
  resultDiv.className = 'result hidden';
  progressFill.style.width = '30%';
  statusMessage.textContent = 'Text wird analysiert...';

  try {
    const res = await fetch('/api/import-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const { jobId, error } = await res.json();
    if (error) throw new Error(error);

    currentJobId = jobId;
    pollStatus(jobId);
  } catch (err) {
    showError(err.message);
  } finally {
    textImportBtn.disabled = false;
  }
}

async function handlePhoto(file) {
  importBtn.disabled = true;
  statusDiv.classList.remove('hidden');
  previewDiv.classList.add('hidden');
  resultDiv.classList.add('hidden');
  resultDiv.className = 'result hidden';
  progressFill.style.width = '30%';
  statusMessage.textContent = 'Foto wird analysiert...';

  // Show preview in upload area
  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result;
    uploadArea.innerHTML = `<img src="${base64}"><p>Wird analysiert...</p>`;

    try {
      const res = await fetch('/api/import-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      });
      const { jobId, error } = await res.json();
      if (error) throw new Error(error);

      currentJobId = jobId;
      pollStatus(jobId);
    } catch (err) {
      showError(err.message);
    }
  };
  reader.readAsDataURL(file);
}

function resetUI() {
  previewDiv.classList.add('hidden');
  statusDiv.classList.add('hidden');
  resultDiv.classList.add('hidden');
  importBtn.disabled = false;
  currentJobId = null;
  currentUsage = null;
  uploadArea.innerHTML = '<p>Foto hochladen oder hierher ziehen</p>';
  photoInput.value = '';
}
