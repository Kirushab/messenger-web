import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const { signIn, loading } = useAuthStore();
  const nav = useNavigate();

  useEffect(() => {
    const notice = sessionStorage.getItem('auth_notice');
    if (notice) { setErr(notice); sessionStorage.removeItem('auth_notice'); }
  }, []);

  const handle = async () => {
    setErr('');
    if (!email.trim() || !password) { setErr('Заполни все поля'); return; }
    const { error } = await signIn(email.trim(), password);
    if (error) {
      const raw = typeof error === 'string' ? error : String(error);
      const lower = raw.toLowerCase();
      // Перевод типовых ошибок входа на русский
      if (lower.includes('invalid login') || lower.includes('invalid credentials')) setErr('Неверный email или пароль.');
      else if (lower.includes('banned') || lower.includes('ожидает одобрения') || lower.includes('администратор')) setErr('Аккаунт ожидает одобрения или ограничен администратором.');
      else if (lower.includes('rate limit') || lower.includes('too many')) setErr('Слишком много попыток входа. Подожди минуту.');
      else if (lower.includes('network')) setErr('Нет соединения с сервером.');
      else setErr(raw);
    }
  };

  return (
    <div className="auth-page auth-page-v334">
      <div className="auth-card auth-card-v334">
        <div className="auth-logo">
          <img src="/logo-mark.svg" alt="Sigmas" style={{ width: 96, height: 96, display: 'block', margin: '0 auto 14px' }} />
          <h1>Sigmas</h1>
          <p>Войди в свой аккаунт</p>
        </div>
        <div className="auth-form">
          {err && <div className="auth-error">{err}</div>}
          <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="email" />
          <input placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} type="password" autoComplete="current-password" onKeyDown={e => e.key === 'Enter' && handle()} />
          <button className="btn" onClick={handle} disabled={loading}>{loading ? 'Вход...' : 'Войти'}</button>
        </div>
        <p className="auth-footer">Нет аккаунта? <a onClick={() => nav('/register')}>Зарегистрируйся</a></p>
      </div>
    </div>
  );
}
