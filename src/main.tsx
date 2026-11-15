import { StrictMode, Component, useEffect, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import Dashboard from './Dashboard';
import { LoginPage } from './components/LoginPage';
import {
  logoutTempleAccount,
  getCurrentAuthenticatedUid,
  logTempleError,
  observeTempleAuthState,
  type TempleAuthState,
} from './service/firebaseSyncService';
import './index.css';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    logTempleError(getCurrentAuthenticatedUid(), 'APP_RUNTIME', error.message, {
      stack: error.stack || '',
      componentStack: errorInfo.componentStack || '',
    });
    this.setState({
      error,
      errorInfo
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#ffebee', color: '#c62828', fontFamily: 'monospace', height: '100vh', overflow: 'auto' }}>
          <h1>React Crashed</h1>
          <h2>{this.state.error?.message}</h2>
          <pre>{this.state.error?.stack}</pre>
          <hr />
          <pre>{this.state.errorInfo?.componentStack}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

const AppRoot = () => {
  const [authState, setAuthState] = useState<TempleAuthState>({ status: 'loading' });

  useEffect(() => observeTempleAuthState(setAuthState), []);

  const handleLogout = async () => {
    await logoutTempleAccount();
    setAuthState({ status: 'signed-out' });
  };

  if (authState.status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">인증 상태를 확인하는 중입니다…</div>;
  }

  if (authState.status === 'configuration-error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">Firebase 설정이 필요합니다</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{authState.message}</p>
        </div>
      </div>
    );
  }

  if (authState.status === 'signed-out') {
    return <LoginPage errorMessage={authState.message} onLoginSuccess={(account) => setAuthState({ status: 'authenticated', account })} />;
  }

  return <Dashboard account={authState.account} onLogout={handleLogout} />;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppRoot />
    </ErrorBoundary>
  </StrictMode>,
);

