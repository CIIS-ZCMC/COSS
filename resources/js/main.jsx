import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import DownloadPortal from './DownloadPortal.jsx';

const container = document.getElementById('root');
if (container) {
    const isDownloadRoute = window.location.pathname.startsWith('/api/v1/files/download/') ||
                            window.location.pathname.startsWith('/download/');

    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            {isDownloadRoute ? <DownloadPortal /> : <App />}
        </React.StrictMode>
    );
}

