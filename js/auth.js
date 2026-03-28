// ── Supabase Auth ────────────────────────────────────────────────────────
import { $ } from './utils.js';
import { loadFromCloud, setSbRef } from './state.js';

import { SUPABASE_URL, SUPABASE_KEY } from './env-config.js';

export const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
export let _sbUser = null;

// Wire up state module with supabase refs
setSbRef(_sb, () => _sbUser);

export async function initAuth(showAppFn) {
  const { data: { session } } = await _sb.auth.getSession();
  if (session) {
    _sbUser = session.user;
    await loadFromCloud();
    showAppFn();
  } else {
    document.getElementById('loginView').style.display = 'flex';
    document.querySelector('.app').style.display = 'none';
  }
  _sb.auth.onAuthStateChange(async function (event, session) {
    if (event === 'SIGNED_IN' && session) {
      _sbUser = session.user;
      await loadFromCloud();
      showAppFn();
    } else if (event === 'SIGNED_OUT') {
      _sbUser = null;
      document.getElementById('loginView').style.display = 'flex';
      document.querySelector('.app').style.display = 'none';
    }
  });
}

export function doLogin() {
  return async function () {
    const email = $('#loginEmail').value.trim();
    const pw = $('#loginPassword').value;
    const errEl = $('#loginError');
    errEl.style.display = 'none';
    const btn = $('#loginBtn');
    btn.textContent = 'Logger inn...';
    btn.disabled = true;
    const { error } = await _sb.auth.signInWithPassword({ email, password: pw });
    btn.textContent = 'Logg inn';
    btn.disabled = false;
    if (error) {
      errEl.style.background = '#fff1f0';
      errEl.style.color = '#c0392b';
      errEl.textContent = error.message === 'Invalid login credentials' ? 'Feil e-post eller passord' : error.message;
      errEl.style.display = 'block';
    }
  };
}

export function doSignup() {
  return async function () {
    const email = $('#loginEmail').value.trim();
    const pw = $('#loginPassword').value;
    const errEl = $('#loginError');
    errEl.style.display = 'none';
    if (!email || !pw) { errEl.textContent = 'Fyll inn e-post og passord'; errEl.style.display = 'block'; return; }
    if (pw.length < 6) { errEl.textContent = 'Passord må være minst 6 tegn'; errEl.style.display = 'block'; return; }
    const { error } = await _sb.auth.signUp({ email, password: pw });
    if (error) {
      errEl.textContent = error.message;
      errEl.style.display = 'block';
    } else {
      errEl.style.background = '#edfff4';
      errEl.style.borderColor = '#b7f0cf';
      errEl.style.color = '#167a42';
      errEl.textContent = 'Konto opprettet! Sjekk e-posten din for bekreftelse, eller logg inn direkte.';
      errEl.style.display = 'block';
    }
  };
}

export function showSignup() {
  $('#signupExtra').style.display = 'block';
  $('#loginBtn').style.display = 'none';
}

export function showLogin() {
  $('#signupExtra').style.display = 'none';
  $('#loginBtn').style.display = 'block';
}
