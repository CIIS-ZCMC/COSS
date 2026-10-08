import React, { useState } from 'react';
import { 
    HardDrive, 
    BookOpen, 
    FileCode, 
    Terminal, 
    Download,
    ExternalLink,
    ShieldCheck
} from 'lucide-react';
import ApiAndCommandsDocs from './ApiAndCommandsDocs';

export default function DocumentationPage() {
    const [subTab, setSubTab] = useState('swagger'); // 'swagger' | 'raw_markdown'
    const [markdownContent, setMarkdownContent] = useState('');
    const [loadingMd, setLoadingMd] = useState(false);

    const handleLoadMarkdown = async () => {
        setSubTab('raw_markdown');
        if (!markdownContent) {
            try {
                setLoadingMd(true);
                const res = await fetch('/COSS_DEVELOPER_GUIDE.md');
                if (res.ok) {
                    const text = await res.text();
                    setMarkdownContent(text);
                } else {
                    setMarkdownContent('# Error loading COSS_DEVELOPER_GUIDE.md');
                }
            } catch (err) {
                setMarkdownContent('# Error loading COSS_DEVELOPER_GUIDE.md: ' + err.message);
            } finally {
                setLoadingMd(false);
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
            {/* Top Navigation Bar */}
            <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                            <BookOpen className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-extrabold tracking-tight text-white text-base">COSS Documentation</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800">API Docs</span>
                            </div>
                            <span className="text-[11px] text-slate-400 block -mt-0.5">Integration Specifications & Swagger Reference</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-xs text-slate-300">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Zero-Trust Protocol v1.2</span>
                        </div>
                        <a
                            href="/COSS_DEVELOPER_GUIDE.md"
                            download="COSS_DEVELOPER_GUIDE.md"
                            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-sm shadow-cyan-600/20"
                            title="Download developer documentation as Markdown (.md)"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Export Guide (.md)</span>
                        </a>
                    </div>
                </div>
            </header>

            {/* Sub-navigation bar between Interactive Swagger Spec and Raw Markdown View */}
            <div className="bg-slate-900/50 border-b border-slate-800/80">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setSubTab('swagger')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                                subTab === 'swagger'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                            }`}
                        >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Interactive Swagger & CLI Reference</span>
                        </button>
                        <button
                            onClick={handleLoadMarkdown}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                                subTab === 'raw_markdown'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                            }`}
                        >
                            <FileCode className="w-3.5 h-3.5" />
                            <span>Markdown Spec Guide</span>
                        </button>
                    </div>

                    <div className="text-[11px] text-slate-500 hidden sm:block">
                        Base URL: <code className="text-cyan-400 font-mono bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">/api/v1</code>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
                {subTab === 'swagger' && (
                    <ApiAndCommandsDocs />
                )}

                {subTab === 'raw_markdown' && (
                    <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-6 md:p-8 space-y-6">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <div>
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <FileCode className="w-5 h-5 text-indigo-400" />
                                    <span>COSS_DEVELOPER_GUIDE.md</span>
                                </h2>
                                <p className="text-xs text-slate-400 mt-0.5">Raw Markdown integration manual for hospital engineers</p>
                            </div>
                            <a
                                href="/COSS_DEVELOPER_GUIDE.md"
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 transition"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Open raw file</span>
                            </a>
                        </div>

                        {loadingMd ? (
                            <div className="py-20 text-center text-slate-400 text-sm">
                                Loading developer guide...
                            </div>
                        ) : (
                            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[700px] overflow-y-auto">
                                {markdownContent}
                            </pre>
                        )}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-900 bg-slate-950 py-4 mt-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
                    <div>Zamboanga City Medical Center (ZCMC) • Centralized Object Storage Service (COSS)</div>
                    <div className="flex items-center gap-4 text-[11px]">
                        <span>Zero-Trust API Security</span>
                        <span>•</span>
                        <span>Chunked Resumable Uploads</span>
                        <span>•</span>
                        <span>Scheduled Automated Purging</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
