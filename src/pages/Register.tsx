import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const { signUp, loading } = useAuthStore();
  const nav = useNavigate();

  const translateAuthError = (raw: string): string => {
    const lower = raw.toLowerCase();
    if (lower.includes('rate limit') || lower.includes('too many') || lower.includes('слишком много')) return 'Слишком много заявок. Попробуй немного позже.';
    if (lower.includes('already registered') || lower.includes('already') || lower.includes('exists') || lower.includes('зарегистрирован')) return 'Этот email уже зарегистрирован. Попробуй войти.';
    if (lower.includes('invalid email') || lower.includes('формат email')) return 'Неверный формат email.';
    if (lower.includes('password') || lower.includes('пароль')) return raw.includes('Пароль') ? raw : 'Пароль должен содержать минимум 6 символов.';
    if (lower.includes('network') || lower.includes('load failed') || lower.includes('fetch')) return 'Нет соединения с сервером.';
    return raw;
  };

  const handle = async () => {
    setErr('');
    if (!name.trim() || !email.trim() || !password) { setErr('Заполни все поля'); return; }
    if (name.trim().length < 2) { setErr('Имя слишком короткое'); return; }
    if (password.length < 6) { setErr('Пароль минимум 6 символов'); return; }
    if (password !== confirm) { setErr('Пароли не совпадают'); return; }
    const { error } = await signUp(email.trim(), password, name.trim());
    if (error) { setErr(translateAuthError(String(error))); return; }
    setSubmitted(true);
    setPassword('');
    setConfirm('');
  };

  if (submitted) {
    return (
      <div className="auth-page auth-page-v334">
        <div className="auth-card auth-card-v334 auth-pending-card">
          <div className="auth-pending-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          </div>
          <h1>Заявка отправлена</h1>
          <p>Аккаунт появится после одобрения в консоли Kirill Bogdanov.</p>
          <div className="auth-pending-email">{email.trim().toLowerCase()}</div>
          <p className="auth-pending-note">Подтверждать почту не нужно. После одобрения просто войди с этим email и паролем.</p>
          <button className="btn" onClick={() => nav('/login', { replace: true })}>Перейти ко входу</button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page auth-page-v334">
      <div className="auth-card auth-card-v334">
        <div className="auth-logo">
          <img src="/logo-mark.svg" alt="Sigmas" style={{ width: 96, height: 96, display: 'block', margin: '0 auto 14px' }} />
          <h1 style={{ WebkitTextFillColor: 'var(--text)', background: 'none' }}>Создать аккаунт</h1>
          <p>После регистрации заявка попадёт администратору</p>
        </div>
        <div className="auth-form">
          {err && <div className="auth-error">{err}</div>}
          <input placeholder="Имя" value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
          <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="email" />
          <input placeholder="Пароль (мин. 6)" value={password} onChange={e => setPassword(e.target.value)} type="password" autoComplete="new-password" />
          <input placeholder="Повтори пароль" value={confirm} onChange={e => setConfirm(e.target.value)} type="password" autoComplete="new-password" onKeyDown={e => e.key === 'Enter' && handle()} />
          <button className="btn" onClick={handle} disabled={loading}>{loading ? 'Отправляем…' : 'Отправить заявку'}</button>
        </div>
        <p className="auth-footer">Уже есть аккаунт? <a onClick={() => nav('/login')}>Войти</a></p>
      </div>
    </div>
  );
}
