import React, { StrictMode, Component, ErrorInfo, ReactNode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Dashboard from './Dashboard';
import { LoginPage } from './components/LoginPage';
import {
  getSavedSession,
  logoutTempleAccount,
  logTempleError,
  type TempleAccount,
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
    const saved = getSavedSession();
    logTempleError(saved?.uid, 'APP_RUNTIME', error.message, {
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
  const [account, setAccount] = useState<TempleAccount | null>(() => getSavedSession());

  const handleLogout = async () => {
    await logoutTempleAccount();
    setAccount(null);
  };

  if (!account) {
    return <LoginPage onLoginSuccess={(acc) => setAccount(acc)} />;
  }

  return <Dashboard account={account} onLogout={handleLogout} />;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppRoot />
    </ErrorBoundary>
  </StrictMode>,
);

