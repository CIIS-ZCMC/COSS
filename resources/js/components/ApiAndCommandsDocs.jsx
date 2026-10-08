import React, { useState } from 'react';
import {
    Terminal,
    BookOpen,
    Copy,
    Check,
    Play,
    Shield,
    FileUp,
    Download,
    Layers,
    ListFilter,
    HardDrive,
    Trash2,
    RefreshCw,
    Search,
    ChevronDown,
    ChevronRight,
    ExternalLink,
    Lock,
    Key,
    Database,
    Zap,
    Send,
    CheckCircle2,
    AlertTriangle,
    Info,
    ArrowRight
} from 'lucide-react';

export default function ApiAndCommandsDocs() {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeSection, setActiveSection] = useState('all'); // 'all', 'endpoints', 'artisan', 'env'
    const [copiedId, setCopiedId] = useState(null);
    const [expandedIds, setExpandedIds] = useState({
        'ep-upload': true,
        'ep-signed-url': true,
        'cli-client-create': true,
    });

    // Interactive Try-It-Out Playground State
    const [testEndpoint, setTestEndpoint] = useState('status'); // 'status', 'signed-url', 'audit'
    const [playgroundApiKey, setPlaygroundApiKey] = useState('zcmc_ehr_dev_key');
    const [playgroundApiSecret, setPlaygroundApiSecret] = useState('sec_live_demo_987654');
    const [playgroundFileUuid, setPlaygroundFileUuid] = useState('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    const [playgroundBody, setPlaygroundBody] = useState(JSON.stringify({
        expires_in_minutes: 60,
        max_downloads: 5,
        allowed_ips: ["192.168.1.100"],
        password: "ZCMC-Secure-Pass"
    }, null, 2));
    const [playgroundOutput, setPlaygroundOutput] = useState(null);
    const [isExecuting, setIsExecuting] = useState(false);

    const copyToClipboard = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const toggleExpand = (id) => {
        setExpandedIds(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    // Endpoints documentation catalog
    const apiEndpoints = [
        {
            id: 'ep-upload',
            method: 'POST',
            path: '/api/v1/files/upload',
            title: 'Direct File Upload (< 50MB)',
            description: 'Upload standard files directly via multipart form-data. File is placed into staging, queued for antivirus scanning, and dispatched to background workers.',
            auth: 'Client API Key + Secret (COSS-API-Key)',
            headers: [
                { name: 'COSS-API-Key', type: 'string', required: true, desc: 'Registered Client App key (Fallback: X-API-Key)' },
                { name: 'COSS-API-Secret', type: 'string', required: true, desc: 'Secret matching client hashed secret (Fallback: X-API-Secret)' },
                { name: 'Content-Type', type: 'string', required: true, desc: 'multipart/form-data' }
            ],
            bodyParams: [
                { name: 'file', type: 'binary', required: true, desc: 'File content to store (Max: 50MB)' },
                { name: 'retention_days', type: 'integer', required: false, default: 'null (indefinite)', desc: 'Automatic retention expiration lifetime in days' }
            ],
            curl: `curl -X POST https://coss.zcmc.gov.ph/api/v1/files/upload \\
  -H "COSS-API-Key: YOUR_API_KEY" \\
  -H "COSS-API-Secret: YOUR_API_SECRET" \\
  -F "file=@/path/to/patient_record.pdf" \\
  -F "retention_days=90"`,
            responseSample: {
                status: 201,
                body: {
                    success: true,
                    message: "File uploaded successfully and queued for malware scan.",
                    data: {
                        file_uuid: "9f826071-702b-4fc6-bb7c-ffb55921867c",
                        original_filename: "patient_record.pdf",
                        size_bytes: 421054,
                        mime_type: "application/pdf",
                        scan_status: "pending",
                        retention_days: 90
                    }
                }
            }
        },
        {
            id: 'ep-chunk-init',
            method: 'POST',
            path: '/api/v1/files/chunks/initiate',
            title: 'Initiate Chunked / Resumable Upload',
            description: 'Starts a multi-part upload session for large assets (>50MB, PACS DICOM, high-res scans, or large archives).',
            auth: 'Client API Key + Secret (COSS-API-Key)',
            headers: [
                { name: 'COSS-API-Key', type: 'string', required: true, desc: 'Client API key (Fallback: X-API-Key)' },
                { name: 'COSS-API-Secret', type: 'string', required: true, desc: 'Client API secret (Fallback: X-API-Secret)' },
                { name: 'Content-Type', type: 'string', required: true, desc: 'application/json' }
            ],
            bodyParams: [
                { name: 'filename', type: 'string', required: true, desc: 'Target filename with extension' },
                { name: 'total_size_bytes', type: 'integer', required: true, desc: 'Total byte count of the full file' },
                { name: 'total_chunks', type: 'integer', required: true, desc: 'Count of chunks that will be transmitted' },
                { name: 'retention_days', type: 'integer', required: false, desc: 'Optional retention policy days' }
            ],
            curl: `curl -X POST https://coss.zcmc.gov.ph/api/v1/files/chunks/initiate \\
  -H "COSS-API-Key: YOUR_API_KEY" \\
  -H "COSS-API-Secret: YOUR_API_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{
    "filename": "ct_scan_abdomen.dcm",
    "total_size_bytes": 104857600,
    "total_chunks": 10
  }'`,
            responseSample: {
                status: 200,
                body: {
                    success: true,
                    upload_id: "chk_9a8b7c6d5e4f3a2b1c",
                    chunk_size_bytes: 10485760,
                    expires_at: "2026-10-09T09:30:00Z"
                }
            }
        },
        {
            id: 'ep-chunk-slice',
            method: 'POST',
            path: '/api/v1/files/chunks/{uploadId}',
            title: 'Upload Chunk Slice',
            description: 'Streams an individual numbered slice to the staging buffer. Slices can be re-sent in case of connection interruptions.',
            auth: 'Client API Key + Secret (COSS-API-Key)',
            headers: [
                { name: 'COSS-API-Key', type: 'string', required: true, desc: 'Client API key (Fallback: X-API-Key)' },
                { name: 'COSS-API-Secret', type: 'string', required: true, desc: 'Client API secret (Fallback: X-API-Secret)' }
            ],
            bodyParams: [
                { name: 'chunk_number', type: 'integer', required: true, desc: '1-indexed ordinal position' },
                { name: 'chunk', type: 'binary', required: true, desc: 'Raw binary partition payload' }
            ],
            curl: `curl -X POST https://coss.zcmc.gov.ph/api/v1/files/chunks/chk_9a8b7c6d5e4f3a2b1c \\
  -H "COSS-API-Key: YOUR_API_KEY" \\
  -H "COSS-API-Secret: YOUR_API_SECRET" \\
  -F "chunk_number=1" \\
  -F "chunk=@slice_1.part"`,
            responseSample: {
                status: 200,
                body: {
                    success: true,
                    chunk_number: 1,
                    received_size: 10485760
                }
            }
        },
        {
            id: 'ep-chunk-complete',
            method: 'POST',
            path: '/api/v1/files/chunks/{uploadId}/complete',
            title: 'Assemble & Finalize Chunked Upload',
            description: 'Stitches all uploaded parts sequentially, computes full sha256 checksum, and initiates asynchronous security scanning.',
            auth: 'Client API Key + Secret (COSS-API-Key)',
            headers: [
                { name: 'COSS-API-Key', type: 'string', required: true, desc: 'Client API key (Fallback: X-API-Key)' },
                { name: 'COSS-API-Secret', type: 'string', required: true, desc: 'Client API secret (Fallback: X-API-Secret)' },
                { name: 'Content-Type', type: 'string', required: true, desc: 'application/json' }
            ],
            bodyParams: [
                { name: 'filename', type: 'string', required: true, desc: 'Original target file name' },
                { name: 'total_chunks', type: 'integer', required: true, desc: 'Total slice count confirmation' }
            ],
            curl: `curl -X POST https://coss.zcmc.gov.ph/api/v1/files/chunks/chk_9a8b7c6d5e4f3a2b1c/complete \\
  -H "COSS-API-Key: YOUR_API_KEY" \\
  -H "COSS-API-Secret: YOUR_API_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{"filename": "ct_scan_abdomen.dcm", "total_chunks": 10}'`,
            responseSample: {
                status: 201,
                body: {
                    success: true,
                    data: {
                        file_uuid: "e4f81234-abcd-4567-90ef-112233445566",
                        status: "pending_scan",
                        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                    }
                }
            }
        },
        {
            id: 'ep-get-file',
            method: 'GET',
            path: '/api/v1/files/{uuid}',
            title: 'Get File Metadata & Scan Status',
            description: 'Retrieves current scan result (clean, infected, pending), checksum, quarantine status, and retention timeline.',
            auth: 'Client API Key + Secret (COSS-API-Key)',
            headers: [
                { name: 'COSS-API-Key', type: 'string', required: true, desc: 'Client API key (Fallback: X-API-Key)' },
                { name: 'COSS-API-Secret', type: 'string', required: true, desc: 'Client API secret (Fallback: X-API-Secret)' }
            ],
            bodyParams: [],
            curl: `curl -X GET https://coss.zcmc.gov.ph/api/v1/files/9f826071-702b-4fc6-bb7c-ffb55921867c \\
  -H "COSS-API-Key: YOUR_API_KEY" \\
  -H "COSS-API-Secret: YOUR_API_SECRET"`,
            responseSample: {
                status: 200,
                body: {
                    uuid: "9f826071-702b-4fc6-bb7c-ffb55921867c",
                    client_id: 1,
                    original_filename: "patient_record.pdf",
                    mime_type: "application/pdf",
                    size_bytes: 421054,
                    scan_status: "clean",
                    scanned_at: "2026-10-08T08:14:20Z",
                    threat_name: null,
                    is_quarantined: false,
                    retention_days: 90,
                    expires_at: "2027-01-06T08:14:00Z"
                }
            }
        },
        {
            id: 'ep-signed-url',
            method: 'POST',
            path: '/api/v1/files/{uuid}/signed-url',
            title: 'Generate Restricted / Permanent Signed Download Link',
            description: 'Issues a cryptographically signed HMAC download URL with configurable Zero-Trust constraints (IP Whitelisting, Max Download Counter, Password Protection, or No-Expiry / Permanent capability).',
            auth: 'Client API Key + Secret (COSS-API-Key)',
            headers: [
                { name: 'COSS-API-Key', type: 'string', required: true, desc: 'Client API key (Fallback: X-API-Key)' },
                { name: 'COSS-API-Secret', type: 'string', required: true, desc: 'Client API secret (Fallback: X-API-Secret)' },
                { name: 'Content-Type', type: 'string', required: true, desc: 'application/json' }
            ],
            bodyParams: [
                { name: 'expires_in_minutes', type: 'integer', required: false, default: 'null (No Expiration / Permanent)', desc: 'Valid duration in minutes (1 to 10,080). Supply 0 or omit entirely to make permanent with no expiry' },
                { name: 'max_downloads', type: 'integer', required: false, default: 'null (Unlimited)', desc: 'Ceiling on download attempts before automatic revocation' },
                { name: 'allowed_ips', type: 'array[string]', required: false, default: '[] (All IPs)', desc: 'List of authorized IPv4/IPv6 client IP addresses' },
                { name: 'password', type: 'string', required: false, default: 'null', desc: 'Passcode required from the user before decrypting/streaming download' }
            ],
            curl: `curl -X POST https://coss.zcmc.gov.ph/api/v1/files/9f826071-702b-4fc6-bb7c-ffb55921867c/signed-url \\
  -H "COSS-API-Key: YOUR_API_KEY" \\
  -H "COSS-API-Secret: YOUR_API_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{
    "expires_in_minutes": 0,
    "max_downloads": 5,
    "allowed_ips": ["192.168.1.100", "10.0.0.5"],
    "password": "ZCMC-Secure-Pass"
  }'`,
            responseSample: {
                status: 200,
                body: {
                    download_url: "https://coss.zcmc.gov.ph/api/v1/files/download/9f826071-702b-4fc6-bb7c-ffb55921867c?signature=9f...&link=coss_lnk_7a8b9c",
                    portal_url: "https://coss.zcmc.gov.ph/download/coss_lnk_7a8b9c",
                    token: "coss_lnk_7a8b9c",
                    expires_at: null,
                    is_permanent: true,
                    max_downloads: 5,
                    has_password: true,
                    allowed_ips: ["192.168.1.100", "10.0.0.5"]
                }
            }
        },
        {
            id: 'ep-download-public',
            method: 'GET',
            path: '/api/v1/files/download/{uuid}',
            title: 'Direct Binary File Stream & Inline Preview',
            description: 'Public endpoint executed with query parameters `signature`, `link`, and optional `expires`. Verifies HMAC cryptographic signature and link restrictions. Supports direct attachment download or in-browser inline streaming using `view=1`.',
            auth: 'Cryptographic Signature in Query String',
            headers: [
                { name: 'X-Download-Password', type: 'string', required: false, desc: 'Passcode header if the link is password-protected (alternatively use ?password=...)' }
            ],
            bodyParams: [
                { name: 'view', type: 'boolean', required: false, default: 'false', desc: 'When set to 1 or true, returns Content-Disposition: inline and Accept-Ranges: bytes for in-browser PDF, image, audio, or video preview instead of forcing an attachment download.' },
                { name: 'stream', type: 'boolean', required: false, default: 'false', desc: 'Bypass portal UI on browser navigation and immediately trigger binary stream.' },
                { name: 'password', type: 'string', required: false, default: 'null', desc: 'Passcode query parameter as an alternative to X-Download-Password header.' }
            ],
            curl: `# Direct download:
curl -H "X-Download-Password: ZCMC-Secure-Pass" \\
  -O "https://coss.zcmc.gov.ph/api/v1/files/download/9f826071-702b-4fc6-bb7c-ffb55921867c?signature=abcdef123456&link=coss_lnk_7a8b9c"

# Stream / Inline view in browser or player:
curl -H "X-Download-Password: ZCMC-Secure-Pass" \\
  "https://coss.zcmc.gov.ph/api/v1/files/download/9f826071-702b-4fc6-bb7c-ffb55921867c?signature=abcdef123456&link=coss_lnk_7a8b9c&view=1"`,
            responseSample: {
                status: 200,
                body: "[Binary Stream with Content-Disposition: inline or attachment; Accept-Ranges: bytes]"
            }
        },
        {
            id: 'ep-delete-file',
            method: 'DELETE',
            path: '/api/v1/files/{uuid}',
            title: 'Soft-Delete Stored File',
            description: 'Marks file as deleted and starts countdown based on configured client retention days before permanent destruction.',
            auth: 'Client API Key + Secret (COSS-API-Key)',
            headers: [
                { name: 'COSS-API-Key', type: 'string', required: true, desc: 'Client API key (Fallback: X-API-Key)' },
                { name: 'COSS-API-Secret', type: 'string', required: true, desc: 'Client API secret (Fallback: X-API-Secret)' }
            ],
            bodyParams: [],
            curl: `curl -X DELETE https://coss.zcmc.gov.ph/api/v1/files/9f826071-702b-4fc6-bb7c-ffb55921867c \\
  -H "COSS-API-Key: YOUR_API_KEY" \\
  -H "COSS-API-Secret: YOUR_API_SECRET"`,
            responseSample: {
                status: 200,
                body: {
                    success: true,
                    message: "File soft-deleted. Scheduled for permanent purge in 90 days."
                }
            }
        },
        {
            id: 'ep-audit-logs',
            method: 'GET',
            path: '/api/v1/audit-logs',
            title: 'Query Client System Audit Logs',
            description: 'Fetches full tamper-evident audit trail of all upload, scan, signed-url request, and download events for the authenticated client.',
            auth: 'Client API Key + Secret (COSS-API-Key)',
            headers: [
                { name: 'COSS-API-Key', type: 'string', required: true, desc: 'Client API key (Fallback: X-API-Key)' },
                { name: 'COSS-API-Secret', type: 'string', required: true, desc: 'Client API secret (Fallback: X-API-Secret)' }
            ],
            bodyParams: [],
            curl: `curl -X GET "https://coss.zcmc.gov.ph/api/v1/audit-logs?per_page=15" \\
  -H "COSS-API-Key: YOUR_API_KEY" \\
  -H "COSS-API-Secret: YOUR_API_SECRET"`,
            responseSample: {
                status: 200,
                body: {
                    current_page: 1,
                    data: [
                        {
                            id: 1042,
                            action: "file.downloaded",
                            ip_address: "192.168.1.100",
                            file_uuid: "9f826071-702b-4fc6-bb7c-ffb55921867c",
                            created_at: "2026-10-08T09:25:12Z"
                        }
                    ]
                }
            }
        }
    ];

    // CLI and Artisan commands
    const cliCommands = [
        {
            id: 'cli-client-create',
            name: 'Register Client System',
            command: 'php artisan coss:client:create "{System Name}" [options]',
            category: 'Client & Security',
            description: 'Registers an authorized hospital sub-system (EHR, Billing, PACS, Lab) and displays the one-time raw API Secret along with the unique API Key.',
            options: [
                { flag: '--webhook-url', desc: 'Callback URL triggered whenever files complete malware inspection' },
                { flag: '--allowed-ips', desc: 'Comma-separated IP address restriction list for caller verification' },
                { flag: '--rate-limit', desc: 'Max request throttles per minute (Default: 120)' }
            ],
            example: `php artisan coss:client:create "Hospital EHR System" \\
  --webhook-url="https://ehr.hospital.local/api/coss/webhook" \\
  --allowed-ips="192.168.1.100,192.168.1.101" \\
  --rate-limit=300`
        },
        {
            id: 'cli-purge-files',
            name: 'Purge Expired Soft-Deleted Files',
            command: 'php artisan coss:purge-expired-files',
            category: 'Storage & Lifecycle',
            description: 'Scans the database for soft-deleted files whose retention expiration period has elapsed, physically unlinks files from the NAS/Storage disk, and logs permanent destruction audit records.',
            options: [],
            example: `php artisan coss:purge-expired-files`
        },
        {
            id: 'cli-queue-worker',
            name: 'Run Background Scanner & Webhook Worker',
            command: 'php artisan queue:work --queue=default,scans',
            category: 'Background Processing',
            description: 'Continuously consumes background queues for asynchronous ClamAV virus scanning, large chunk stitching, and client webhook delivery.',
            options: [
                { flag: '--queue', desc: 'Priority queues to process (e.g., default, scans)' },
                { flag: '--tries', desc: 'Maximum retry attempts before failing job (e.g., 3)' }
            ],
            example: `php artisan queue:work --queue=default,scans --tries=3`
        },
        {
            id: 'cli-schedule-run',
            name: 'Invoke Scheduled Maintenance',
            command: 'php artisan schedule:run',
            category: 'Cron Automation',
            description: 'Executed by crontab or Windows Task Scheduler every minute to fire periodic jobs (e.g. daily purge of expired files and cleanup of abandoned chunks).',
            options: [],
            example: `php artisan schedule:run`
        },
        {
            id: 'cli-dev-start',
            name: 'Start All Development Services',
            command: 'composer run dev',
            category: 'Development',
            description: 'Runs Laravel server, Vite React compiler, and queue workers concurrently using Concurrently.',
            options: [],
            example: `composer run dev`
        },
        {
            id: 'cli-clear-cache',
            name: 'Clear Cache & Optimize',
            command: 'php artisan optimize:clear',
            category: 'Maintenance',
            description: 'Flushes compiled routes, configuration cache, view cache, and application cache.',
            options: [],
            example: `php artisan optimize:clear`
        }
    ];

    // Environment configurations
    const envVars = [
        { key: 'SCANNER_DRIVER', default: 'mock', values: ['mock', 'clamav'], desc: 'Antivirus scan engine. Use "clamav" for production with ClamAV daemon, or "mock" for testing.' },
        { key: 'CLAMAV_HOST', default: '127.0.0.1', values: ['IP / Hostname'], desc: 'Daemon IP address where clamd is listening.' },
        { key: 'CLAMAV_PORT', default: '3310', values: ['Port Number'], desc: 'TCP socket port for ClamAV service.' },
        { key: 'CLAMAV_TIMEOUT', default: '30', values: ['Seconds'], desc: 'Scan timeout limit in seconds before falling back or failing.' },
        { key: 'NAS_STORAGE_PATH', default: '/mnt/nas/coss_storage', values: ['File Path'], desc: 'Mounted Network Attached Storage path for secure raw object persistence.' }
    ];

    // Filter items
    const filteredEndpoints = apiEndpoints.filter(ep => 
        ep.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ep.method.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ep.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredCommands = cliCommands.filter(cmd =>
        cmd.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cmd.command.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cmd.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cmd.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Method badge colors
    const getMethodBadge = (method) => {
        switch (method) {
            case 'GET':
                return 'bg-blue-900/60 text-blue-300 border-blue-700/80';
            case 'POST':
                return 'bg-emerald-900/60 text-emerald-300 border-emerald-700/80';
            case 'PUT':
                return 'bg-amber-900/60 text-amber-300 border-amber-700/80';
            case 'DELETE':
                return 'bg-rose-900/60 text-rose-300 border-rose-700/80';
            default:
                return 'bg-slate-800 text-slate-300 border-slate-700';
        }
    };

    // Execute simulated playground call
    const handleRunPlayground = () => {
        setIsExecuting(true);
        setPlaygroundOutput(null);
        setTimeout(() => {
            setIsExecuting(false);
            if (testEndpoint === 'status') {
                setPlaygroundOutput({
                    status: 200,
                    statusText: "OK",
                    duration_ms: 42,
                    data: {
                        uuid: playgroundFileUuid,
                        client_name: "Hospital EHR System",
                        original_filename: "lab_specimen_report.pdf",
                        mime_type: "application/pdf",
                        size_bytes: 524288,
                        scan_status: "clean",
                        threat_name: null,
                        retention_days: 90,
                        created_at: new Date().toISOString()
                    }
                });
            } else if (testEndpoint === 'signed-url') {
                try {
                    const parsed = JSON.parse(playgroundBody);
                    const isPermanent = !parsed.expires_in_minutes || parsed.expires_in_minutes === 0;
                    setPlaygroundOutput({
                        status: 200,
                        statusText: "OK",
                        duration_ms: 78,
                        data: {
                            download_url: `https://coss.zcmc.gov.ph/api/v1/files/download/${playgroundFileUuid}?signature=8f4d92a1b7e6c5...&link=coss_lnk_9941a`,
                            portal_url: `https://coss.zcmc.gov.ph/download/coss_lnk_9941a`,
                            token: "coss_lnk_9941a",
                            expires_at: isPermanent ? null : new Date(Date.now() + (parsed.expires_in_minutes || 60) * 60000).toISOString(),
                            is_permanent: isPermanent,
                            max_downloads: parsed.max_downloads || null,
                            has_password: Boolean(parsed.password),
                            allowed_ips: parsed.allowed_ips || []
                        }
                    });
                } catch (e) {
                    setPlaygroundOutput({
                        status: 400,
                        statusText: "Bad Request",
                        error: "Invalid JSON in request payload"
                    });
                }
            } else {
                setPlaygroundOutput({
                    status: 200,
                    statusText: "OK",
                    duration_ms: 55,
                    data: {
                        total_logs: 1,
                        client_id: 1,
                        logs: [
                            {
                                id: 501,
                                action: "signed_url.generated",
                                file_uuid: playgroundFileUuid,
                                ip_address: "127.0.0.1",
                                timestamp: new Date().toISOString()
                            }
                        ]
                    }
                });
            }
        }, 400);
    };

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Header & Swagger-Style Hero Banner */}
            <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/40 border border-slate-800 p-6 md:p-8 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <span className="px-2.5 py-1 rounded-md bg-cyan-500/20 text-cyan-400 font-mono text-xs font-bold border border-cyan-500/30">
                                OPENAPI / SWAGGER SPEC
                            </span>
                            <span className="text-slate-400 text-xs font-mono">v1.2.0-STABLE</span>
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium bg-emerald-950/50 border border-emerald-800/50 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                Live Daemon
                            </span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-2 tracking-tight">
                            Interactive API & Operations Documentation
                        </h1>
                        <p className="text-slate-400 text-sm mt-1 max-w-2xl leading-relaxed">
                            Comprehensive reference for all COSS HTTP REST endpoints, Zero-Trust authentication schemas, background daemon commands, and retention operations.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <a
                            href="/COSS_DEVELOPER_GUIDE.md"
                            download="COSS_DEVELOPER_GUIDE.md"
                            className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-md shadow-cyan-600/20"
                            title="Download developer documentation as Markdown (.md)"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download Docs (.md)</span>
                        </a>

                        <button
                            onClick={() => copyToClipboard('https://coss.zcmc.gov.ph/api/v1', 'base-url')}
                            className="px-3.5 py-2 rounded-lg bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 flex items-center gap-2 transition hover:text-white"
                        >
                            {copiedId === 'base-url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>BASE: /api/v1</span>
                        </button>
                    </div>
                </div>

                {/* Filter and Section Selector */}
                <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                        <button
                            onClick={() => setActiveSection('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                                activeSection === 'all'
                                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                                    : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                        >
                            <BookOpen className="w-3.5 h-3.5" />
                            All Items ({apiEndpoints.length + cliCommands.length})
                        </button>
                        <button
                            onClick={() => setActiveSection('endpoints')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                                activeSection === 'endpoints'
                                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                                    : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                        >
                            <Zap className="w-3.5 h-3.5" />
                            REST Endpoints ({apiEndpoints.length})
                        </button>
                        <button
                            onClick={() => setActiveSection('artisan')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                                activeSection === 'artisan'
                                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                                    : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                        >
                            <Terminal className="w-3.5 h-3.5" />
                            CLI & Artisan ({cliCommands.length})
                        </button>
                        <button
                            onClick={() => setActiveSection('env')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                                activeSection === 'env'
                                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                                    : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                        >
                            <HardDrive className="w-3.5 h-3.5" />
                            Environment Flags ({envVars.length})
                        </button>
                    </div>

                    <div className="relative min-w-[260px]">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter actions, routes, or commands..."
                            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                        />
                    </div>
                </div>
            </div>

            {/* Interactive "Try It Out" API Playground */}
            {(activeSection === 'all' || activeSection === 'endpoints') && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                                <Play className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    Interactive API Console
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-900/60 text-cyan-300 font-normal">Swagger Try-It-Out</span>
                                </h3>
                                <p className="text-xs text-slate-400">Simulate request headers and payload validation in real-time</p>
                            </div>
                        </div>

                        {/* Preset Endpoint Selector */}
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-400">Endpoint:</label>
                            <select
                                value={testEndpoint}
                                onChange={(e) => setTestEndpoint(e.target.value)}
                                className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                            >
                                <option value="status">GET /api/v1/files/{'{uuid}'} (Metadata)</option>
                                <option value="signed-url">POST /api/v1/files/{'{uuid}'}/signed-url (Signed Link)</option>
                                <option value="audit">GET /api/v1/audit-logs (Audit Records)</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Request Inputs */}
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">COSS-API-Key</label>
                                    <input
                                        type="text"
                                        value={playgroundApiKey}
                                        onChange={(e) => setPlaygroundApiKey(e.target.value)}
                                        className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">COSS-API-Secret</label>
                                    <input
                                        type="password"
                                        value={playgroundApiSecret}
                                        onChange={(e) => setPlaygroundApiSecret(e.target.value)}
                                        className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                                    />
                                </div>
                            </div>

                            {testEndpoint !== 'audit' && (
                                <div>
                                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Path Target File UUID</label>
                                    <input
                                        type="text"
                                        value={playgroundFileUuid}
                                        onChange={(e) => setPlaygroundFileUuid(e.target.value)}
                                        className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                                    />
                                </div>
                            )}

                            {testEndpoint === 'signed-url' && (
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-[11px] font-semibold text-slate-400">Request JSON Body</label>
                                        <span className="text-[10px] text-slate-500">expires_in_minutes: 0 = Permanent</span>
                                    </div>
                                    <textarea
                                        rows={5}
                                        value={playgroundBody}
                                        onChange={(e) => setPlaygroundBody(e.target.value)}
                                        className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 resize-none"
                                    />
                                </div>
                            )}

                            <button
                                onClick={handleRunPlayground}
                                disabled={isExecuting}
                                className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition shadow-md shadow-cyan-600/20 disabled:opacity-50"
                            >
                                {isExecuting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                <span>Execute Simulation Call</span>
                            </button>
                        </div>

                        {/* Response Output */}
                        <div className="bg-slate-950 rounded-xl border border-slate-800 p-3.5 flex flex-col justify-between">
                            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2">
                                <span className="text-[11px] font-mono text-slate-400 font-semibold">Server Response</span>
                                {playgroundOutput && (
                                    <div className="flex items-center gap-2 text-[11px]">
                                        <span className={`px-1.5 py-0.5 rounded font-mono font-bold ${
                                            playgroundOutput.status < 300 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                                        }`}>
                                            HTTP {playgroundOutput.status} {playgroundOutput.statusText}
                                        </span>
                                        {playgroundOutput.duration_ms && (
                                            <span className="text-slate-500 font-mono">{playgroundOutput.duration_ms}ms</span>
                                        )}
                                    </div>
                                )}
                            </div>

                            <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto flex-1 p-2 rounded bg-slate-900/60 max-h-52">
                                {playgroundOutput 
                                    ? JSON.stringify(playgroundOutput.data || playgroundOutput, null, 2)
                                    : "// Hit 'Execute Simulation Call' to test headers, restrictions, and mock responses"}
                            </pre>

                            {playgroundOutput?.data?.portal_url && (
                                <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                                    <span className="text-slate-400">Download Portal link:</span>
                                    <a
                                        href={playgroundOutput.data.portal_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-cyan-400 hover:underline flex items-center gap-1 font-mono text-[11px]"
                                    >
                                        <span>Open Link</span>
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* REST API Endpoints Catalog */}
            {(activeSection === 'all' || activeSection === 'endpoints') && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Zap className="w-5 h-5 text-cyan-400" />
                                REST API Endpoints
                            </h2>
                            <p className="text-xs text-slate-400">Zero-Trust client application endpoints protected by API Key and Secret headers</p>
                        </div>
                        <span className="text-xs font-mono text-slate-500">{filteredEndpoints.length} operations</span>
                    </div>

                    <div className="space-y-3">
                        {filteredEndpoints.map(ep => {
                            const isExpanded = !!expandedIds[ep.id];
                            return (
                                <div 
                                    key={ep.id}
                                    className={`rounded-xl border transition overflow-hidden ${
                                        isExpanded ? 'border-slate-700 bg-slate-900/80 shadow-lg' : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                                    }`}
                                >
                                    {/* Collapsed Header Line */}
                                    <div 
                                        onClick={() => toggleExpand(ep.id)}
                                        className="px-4 py-3.5 flex items-center justify-between cursor-pointer select-none gap-4"
                                    >
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold border ${getMethodBadge(ep.method)}`}>
                                                {ep.method}
                                            </span>
                                            <span className="font-mono text-xs sm:text-sm text-white font-semibold">{ep.path}</span>
                                            <span className="text-xs text-slate-400 hidden sm:inline">•</span>
                                            <span className="text-xs text-slate-300 font-medium">{ep.title}</span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-mono text-slate-500 hidden md:inline px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                                                {ep.auth}
                                            </span>
                                            {isExpanded ? <ChevronDown className="w-4 h-4 text-cyan-400" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                                        </div>
                                    </div>

                                    {/* Expanded Details Body */}
                                    {isExpanded && (
                                        <div className="px-5 py-4 border-t border-slate-800 bg-slate-950/60 space-y-5">
                                            <p className="text-xs text-slate-300 leading-relaxed">
                                                {ep.description}
                                            </p>

                                            {/* Headers Section */}
                                            {ep.headers.length > 0 && (
                                                <div className="space-y-2">
                                                    <h4 className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Request Headers</h4>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-left text-xs">
                                                            <thead>
                                                                <tr className="border-b border-slate-800 text-slate-500">
                                                                    <th className="pb-1.5 font-medium">Header</th>
                                                                    <th className="pb-1.5 font-medium">Type</th>
                                                                    <th className="pb-1.5 font-medium">Required</th>
                                                                    <th className="pb-1.5 font-medium">Description</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                                                                {ep.headers.map(h => (
                                                                    <tr key={h.name} className="text-slate-300">
                                                                        <td className="py-2 text-cyan-400 font-semibold">{h.name}</td>
                                                                        <td className="py-2 text-slate-400">{h.type}</td>
                                                                        <td className="py-2">
                                                                            {h.required ? (
                                                                                <span className="text-rose-400 font-sans font-semibold">required</span>
                                                                            ) : (
                                                                                <span className="text-slate-500 font-sans">optional</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="py-2 text-slate-300 font-sans">{h.desc}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Parameters Section */}
                                            {ep.bodyParams.length > 0 && (
                                                <div className="space-y-2">
                                                    <h4 className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Payload / Query Parameters</h4>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-left text-xs">
                                                            <thead>
                                                                <tr className="border-b border-slate-800 text-slate-500">
                                                                    <th className="pb-1.5 font-medium">Parameter</th>
                                                                    <th className="pb-1.5 font-medium">Type</th>
                                                                    <th className="pb-1.5 font-medium">Default</th>
                                                                    <th className="pb-1.5 font-medium">Required</th>
                                                                    <th className="pb-1.5 font-medium">Description</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                                                                {ep.bodyParams.map(param => (
                                                                    <tr key={param.name} className="text-slate-300">
                                                                        <td className="py-2 text-indigo-400 font-semibold">{param.name}</td>
                                                                        <td className="py-2 text-slate-400">{param.type}</td>
                                                                        <td className="py-2 text-slate-500">{param.default || '-'}</td>
                                                                        <td className="py-2">
                                                                            {param.required ? (
                                                                                <span className="text-rose-400 font-sans font-semibold">required</span>
                                                                            ) : (
                                                                                <span className="text-slate-500 font-sans">optional</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="py-2 text-slate-300 font-sans">{param.desc}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Code Snippets & Response Sample */}
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                                                {/* Curl snippet */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Example cURL Request</span>
                                                        <button
                                                            onClick={() => copyToClipboard(ep.curl, `curl-${ep.id}`)}
                                                            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono transition"
                                                        >
                                                            {copiedId === `curl-${ep.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                            <span>Copy</span>
                                                        </button>
                                                    </div>
                                                    <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-cyan-200 overflow-x-auto">
                                                        {ep.curl}
                                                    </pre>
                                                </div>

                                                {/* Response sample */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                                            Response ({ep.responseSample.status} OK)
                                                        </span>
                                                        <button
                                                            onClick={() => copyToClipboard(JSON.stringify(ep.responseSample.body, null, 2), `resp-${ep.id}`)}
                                                            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono transition"
                                                        >
                                                            {copiedId === `resp-${ep.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                            <span>Copy</span>
                                                        </button>
                                                    </div>
                                                    <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-48">
                                                        {typeof ep.responseSample.body === 'string'
                                                            ? ep.responseSample.body
                                                            : JSON.stringify(ep.responseSample.body, null, 2)}
                                                    </pre>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Artisan CLI Commands */}
            {(activeSection === 'all' || activeSection === 'artisan') && (
                <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Terminal className="w-5 h-5 text-indigo-400" />
                                Artisan CLI & Operations Commands
                            </h2>
                            <p className="text-xs text-slate-400">Server maintenance commands, credential generation, daemon workers, and scheduler jobs</p>
                        </div>
                        <span className="text-xs font-mono text-slate-500">{filteredCommands.length} commands</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredCommands.map(cmd => (
                            <div key={cmd.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3 flex flex-col justify-between hover:border-slate-700 transition">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold text-indigo-400 px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-900">
                                            {cmd.category}
                                        </span>
                                        <button
                                            onClick={() => copyToClipboard(cmd.example || cmd.command, `cli-${cmd.id}`)}
                                            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
                                            title="Copy command"
                                        >
                                            {copiedId === `cli-${cmd.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                    <h3 className="font-bold text-white text-sm">{cmd.name}</h3>
                                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{cmd.description}</p>
                                </div>

                                <div className="space-y-2 mt-2">
                                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-xs text-amber-300 overflow-x-auto">
                                        {cmd.command}
                                    </div>

                                    {cmd.options.length > 0 && (
                                        <div className="space-y-1 pt-1">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Available Options</span>
                                            {cmd.options.map(opt => (
                                                <div key={opt.flag} className="text-[11px] flex items-baseline gap-2">
                                                    <span className="font-mono text-cyan-400">{opt.flag}</span>
                                                    <span className="text-slate-400">{opt.desc}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Environment Variables & Flags */}
            {(activeSection === 'all' || activeSection === 'env') && (
                <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <HardDrive className="w-5 h-5 text-emerald-400" />
                                Daemon & Storage Environment Configurations
                            </h2>
                            <p className="text-xs text-slate-400">Settings placed inside .env controlling Antivirus daemon drivers and NAS mount volumes</p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Environment Variable</th>
                                    <th className="px-4 py-3 font-semibold">Default</th>
                                    <th className="px-4 py-3 font-semibold">Valid Options</th>
                                    <th className="px-4 py-3 font-semibold">Description</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {envVars.map(v => (
                                    <tr key={v.key} className="hover:bg-slate-800/30 transition">
                                        <td className="px-4 py-3 font-mono font-bold text-emerald-400">{v.key}</td>
                                        <td className="px-4 py-3 font-mono text-slate-400">{v.default}</td>
                                        <td className="px-4 py-3 font-mono text-cyan-300 text-[11px]">
                                            {v.values.join(', ')}
                                        </td>
                                        <td className="px-4 py-3 text-slate-300">{v.desc}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
