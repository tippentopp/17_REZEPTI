const urlInput = document.getElementById('url-input');
const importBtn = document.getElementById('import-btn');
const statusDiv = document.getElementById('status');
const progressFill = document.getElementById('progress-fill');
const statusMessage = document.getElementById('status-message');
const resultDiv = document.getElementById('result');

importBtn.addEventListener('click', startImport);
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startImport();
});

async function startImport() {
  const url = urlInput.value.trim();
  if (!url) return;

  importBtn.disabled = true;
  statusDiv.classList.remove('hidden');
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

      if (job.step === 'done') {
        clearInterval(interval);
        showSuccess(job.notionUrl);
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

function showSuccess(notionUrl) {
  importBtn.disabled = false;
  resultDiv.classList.remove('hidden');
  resultDiv.classList.add('success');
  resultDiv.innerHTML = notionUrl
    ? `Rezept gespeichert! <a href="${notionUrl}" target="_blank">In Notion oeffnen</a>`
    : 'Rezept erfolgreich gespeichert!';
}

function showError(msg) {
  importBtn.disabled = false;
  resultDiv.classList.remove('hidden');
  resultDiv.classList.add('error');
  resultDiv.textContent = msg;
}
