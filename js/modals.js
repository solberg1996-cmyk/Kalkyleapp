// ── Modal-system ─────────────────────────────────────────────────────────
import { $ } from './utils.js';

export function showModal(html) {
  $('#modalHost').innerHTML = `<div class="modal-backdrop" onclick="backdropClose(event)"><div class="modal">${html}</div></div>`;
}

export function closeModal() {
  $('#modalHost').innerHTML = '';
}

export function backdropClose(e) {
  if (e.target.classList.contains('modal-backdrop')) closeModal();
}
