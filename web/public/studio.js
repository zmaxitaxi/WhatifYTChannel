const jobId = document.body.dataset.jobId;
const notification = document.getElementById('notification');
async function api(path, body = {}) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail));
  return data;
}
function handle(button, task) {
  if (!button) return;
  button.addEventListener('click', async () => {
    button.disabled = true;
    try { await task(); } catch (error) { notification.textContent = error.message; button.disabled = false; }
  });
}
handle(document.getElementById('new-production'), async () => {
  const job = await api('/jobs'); location.href = '/?job=' + job.id;
});
handle(document.getElementById('cancel-production'), async () => { await api(`/jobs/${jobId}/cancel`); location.reload(); });
handle(document.getElementById('resume-production'), async () => { await api(`/jobs/${jobId}/resume`); location.reload(); });
document.querySelectorAll('[data-review]').forEach(button => handle(button, async () => {
  await api(`/jobs/${jobId}/review`, { action: button.dataset.review }); location.reload();
}));
const dialog = document.getElementById('revision-dialog');
document.getElementById('request-revision')?.addEventListener('click', () => dialog.showModal());
document.getElementById('close-dialog')?.addEventListener('click', () => dialog.close());
document.getElementById('revision-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter; button.disabled = true;
  try {
    await api(`/jobs/${jobId}/review`, { action: 'revise', note: document.getElementById('revision-note').value }); location.reload();
  } catch (error) { notification.textContent = error.message; dialog.close(); button.disabled = false; }
});
const video = document.getElementById('video');
const beats = [...document.querySelectorAll('[data-frame]')];
beats.forEach(button => button.addEventListener('click', () => {
  if (video) { video.currentTime = Number(button.dataset.frame) / 30; video.focus(); }
}));
video?.addEventListener('timeupdate', () => beats.forEach(button => button.classList.toggle('current', video.currentTime * 30 >= Number(button.dataset.frame) && video.currentTime * 30 < Number(button.dataset.end))));
if (jobId && ['queued', 'validating', 'checking_frames', 'rendering', 'packaging'].includes(document.body.dataset.status)) {
  const polling = setInterval(async () => {
    try {
      const response = await fetch(`/jobs/${jobId}`); if (!response.ok) return;
      const job = await response.json();
      const status = job.status.replaceAll('_', ' ').replace(/^./, value => value.toUpperCase());
      document.getElementById('job-status').textContent = status;
      const label = document.getElementById('render-label');
      if (label) label.textContent = status + (job.status === 'rendering' ? ` · ${Math.round(job.completed_frames / job.spec.output.total_frames * 100)}%` : '');
      const progress = document.getElementById('render-progress'); if (progress) progress.value = job.completed_frames;
      if (!['queued', 'validating', 'checking_frames', 'rendering', 'packaging'].includes(job.status) || job.artifacts.length !== Number(document.body.dataset.artifactCount)) {
        clearInterval(polling); location.reload();
      }
    } catch { /* Keep the current workspace usable while the local worker restarts. */ }
  }, 2000);
}
