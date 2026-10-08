import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import DownloadPortal from './DownloadPortal.jsx';
import DocumentationPage from './components/DocumentationPage.jsx';

const container = document.getElementById('root');
if (container) {
    const pathname = window.location.pathname.toLowerCase();
    const isDownloadRoute = pathname.startsWith('/api/v1/files/download/') ||
                            pathname.startsWith('/download/') ||
                            pathname.startsWith('/d/');
    const isDocsRoute = pathname === '/docs' || 
                        pathname === '/documentation' || 
                        pathname.startsWith('/docs/') ||
                        pathname.startsWith('/documentation/');

    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            {isDownloadRoute ? (
                <DownloadPortal />
            ) : isDocsRoute ? (
                <DocumentationPage />
            ) : (
                <App />
            )}
        </React.StrictMode>
    );
}

