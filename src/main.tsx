import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { OfflineSyncProvider } from './contexts/OfflineSyncContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <OfflineSyncProvider>
        <App />
      </OfflineSyncProvider>
    </AuthProvider>
  </StrictMode>,
);
