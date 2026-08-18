import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureError } from '@/lib/sentry';
import { diag } from '@/lib/diag';

interface Props {
  children: ReactNode;
  // Размер фолбэка: 'page' — на весь экран (для корневого), 'inline' — компактный (для секций)
  variant?: 'page' | 'inline';
  // Метка где упало (попадёт в Sentry и помогает группировать)
  name?: string;
  // Кастомный фолбэк (если нужен свой вид)
  fallback?: (props: { error: Error; reset: () => void }) => ReactNode;
}

interface State {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const name = this.props.name || 'unknown';
    // В диагностику (видно на /diag и в Sentry breadcrumbs)
    diag('errorBoundary.caught', {
      boundary: name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 6).join('\n'),
      componentStack: errorInfo.componentStack?.split('\n').slice(0, 6).join('\n'),
    });
    // В Sentry — с контекстом куда упало
    captureError(error, {
      boundary: name,
      componentStack: errorInfo.componentStack,
    });
    this.setState({ errorInfo });
  }

  reset = () => {
    this.setState({ error: null, errorInfo: null });
  };

  reload = () => {
    // Перезагружаем на root, а не на текущем URL. Это:
    // 1) обходит возможные SPA-fallback misconfigs на хостинге;
    // 2) гарантирует что попадём в корневой Layout даже если падало на конкретной странице.
    // Router сам потом отправит на /login или /chats в зависимости от auth state.
    if (window.location.pathname !== '/') {
      window.location.href = '/';
    } else {
      window.location.reload();
    }
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback({ error, reset: this.reset });
    }

    const variant = this.props.variant ?? 'page';

    if (variant === 'inline') {
      return (
        <div style={{
          padding: '16px',
          margin: '8px 12px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: 12,
          color: 'var(--text)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <strong style={{ fontSize: 'var(--fs-snap14)' }}>Этот блок не удалось показать</strong>
          </div>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', marginBottom: 10, fontFamily: 'ui-monospace, Menlo, monospace', wordBreak: 'break-word' }}>
            {error.message}
          </div>
          <button
            onClick={this.reset}
            style={{
              padding: '6px 14px',
              background: 'var(--surface-light)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 'var(--fs-label)',
              color: 'var(--text)',
              fontWeight: 500,
            }}
          >Попробовать ещё раз</button>
        </div>
      );
    }

    // PAGE — фолбэк на весь экран
    return (
      <div style={{
        height: '100dvh', width: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 'max(20px, env(safe-area-inset-top, 20px)) 20px max(20px, env(safe-area-inset-bottom, 20px))',
        background: 'var(--bg)', color: 'var(--text)',
        textAlign: 'center', gap: 16,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div>
          <h2 style={{ margin: '0 0 8px', fontSize: 'var(--fs-title)', fontWeight: 700 }}>Что-то сломалось</h2>
          <p style={{ margin: 0, fontSize: 'var(--fs-snap14)', color: 'var(--muted)', maxWidth: 320, lineHeight: 1.5 }}>
            Произошла непредвиденная ошибка. Я уже получил отчёт и разберусь.
            А пока попробуй перезагрузить приложение.
          </p>
        </div>
        <details style={{
          fontSize: 'var(--fs-micro)', color: 'var(--muted)', maxWidth: 320, textAlign: 'left',
          fontFamily: 'ui-monospace, Menlo, monospace',
        }}>
          <summary style={{ cursor: 'pointer', padding: '4px 0' }}>Подробности</summary>
          <div style={{
            marginTop: 8, padding: 10,
            background: 'var(--surface-light)',
            borderRadius: 6, wordBreak: 'break-word',
            maxHeight: 200, overflow: 'auto',
          }}>{error.message}</div>
        </details>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button
            onClick={this.reset}
            style={{
              padding: '10px 22px',
              background: 'var(--surface-light)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              color: 'var(--text)',
              fontWeight: 600,
              fontSize: 'var(--fs-snap14)',
              cursor: 'pointer',
            }}
          >Попробовать снова</button>
          <button
            onClick={this.reload}
            style={{
              padding: '10px 22px',
              background: 'var(--primary)',
              border: 'none',
              borderRadius: 10,
              color: '#fff',
              fontWeight: 600,
              fontSize: 'var(--fs-snap14)',
              cursor: 'pointer',
            }}
          >Перезагрузить</button>
        </div>
      </div>
    );
  }
}
