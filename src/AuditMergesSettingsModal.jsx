import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, Download, AlertTriangle, Settings } from 'lucide-react';
import Button from './Button.jsx';
import WindowFrame from './WindowFrame.jsx';
import { useApp } from './AppContext';
import { getLogFileSize, saveAuditLog, saveMergesLog, loadAuditLog, loadMergesLog } from './database.js';

export default function AuditMergesSettingsModal({ isOpen, onClose, onBack }) {
    const { dbData, fileHandle, cleanupAuditLog, cleanupMergeLog, showStatus } = useApp();
    const [auditSize, setAuditSize] = useState({ sizeMB: '0.00', exists: false });
    const [mergesSize, setMergesSize] = useState({ sizeMB: '0.00', exists: false });
    const [auditCount, setAuditCount] = useState(0);
    const [mergesCount, setMergesCount] = useState(0);
    const [loading, setLoading] = useState(false);
    
    // Ladda sparade värden från localStorage
    const getInitialKeepAuditLast = () => {
        try {
            const saved = localStorage.getItem('auditKeepLast');
            return saved ? parseInt(saved) : 1000;
        } catch {
            return 1000;
        }
    };
    
    const getInitialKeepMergesLast = () => {
        try {
            const saved = localStorage.getItem('mergesKeepLast');
            return saved ? parseInt(saved) : 500;
        } catch {
            return 500;
        }
    };
    
    const [keepAuditLast, setKeepAuditLast] = useState(getInitialKeepAuditLast);
    const [keepMergesLast, setKeepMergesLast] = useState(getInitialKeepMergesLast);

    useEffect(() => {
        if (isOpen && fileHandle?.path) {
            loadFileSizes();
            loadCounts();
        }
    }, [isOpen, fileHandle]);

    const loadFileSizes = async () => {
        if (!fileHandle?.path) return;
        try {
            const auditResult = await getLogFileSize(fileHandle.path, 'audit');
            const mergesResult = await getLogFileSize(fileHandle.path, 'merges');
            if (auditResult.success) {
                setAuditSize({ sizeMB: auditResult.sizeMB, exists: auditResult.exists });
            }
            if (mergesResult.success) {
                setMergesSize({ sizeMB: mergesResult.sizeMB, exists: mergesResult.exists });
            }
        } catch (err) {
            console.error('Kunde inte ladda filstorlekar:', err);
        }
    };

    const loadCounts = async () => {
        if (!fileHandle?.path) return;
        try {
            const auditResult = await loadAuditLog(fileHandle.path);
            const mergesResult = await loadMergesLog(fileHandle.path);
            if (auditResult.success) {
                setAuditCount(Array.isArray(auditResult.audit) ? auditResult.audit.length : 0);
            }
            if (mergesResult.success) {
                setMergesCount(Array.isArray(mergesResult.merges) ? mergesResult.merges.length : 0);
            }
        } catch (err) {
            console.error('Kunde inte ladda antal poster:', err);
        }
    };

    const handleCleanupAudit = async () => {
        if (!fileHandle?.path) {
            showStatus('Ingen fil öppen', 'error');
            return;
        }
        setLoading(true);
        try {
            // Ladda aktuell audit
            const result = await loadAuditLog(fileHandle.path);
            if (!result.success || !Array.isArray(result.audit)) {
                showStatus('Kunde inte ladda audit-loggar', 'error');
                return;
            }
            
            // Rensa gamla poster
            const trimmed = result.audit.length > keepAuditLast 
                ? result.audit.slice(-keepAuditLast) 
                : result.audit;
            
            // Spara tillbaka
            const saveResult = await saveAuditLog(fileHandle.path, trimmed);
            if (saveResult.success) {
                const removed = result.audit.length - trimmed.length;
                showStatus(`Rensade ${removed} gamla audit-poster. Behöll ${trimmed.length} senaste.`, 'success');
                await loadFileSizes();
                await loadCounts();
            } else {
                showStatus('Kunde inte spara audit-loggar', 'error');
            }
        } catch (err) {
            console.error('Fel vid rensning av audit:', err);
            showStatus('Fel vid rensning av audit-loggar', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCleanupMerges = async () => {
        if (!fileHandle?.path) {
            showStatus('Ingen fil öppen', 'error');
            return;
        }
        setLoading(true);
        try {
            // Ladda aktuella merges
            const result = await loadMergesLog(fileHandle.path);
            if (!result.success || !Array.isArray(result.merges)) {
                showStatus('Kunde inte ladda merge-loggar', 'error');
                return;
            }
            
            // Rensa gamla poster
            const trimmed = result.merges.length > keepMergesLast 
                ? result.merges.slice(-keepMergesLast) 
                : result.merges;
            
            // Spara tillbaka
            const saveResult = await saveMergesLog(fileHandle.path, trimmed);
            if (saveResult.success) {
                const removed = result.merges.length - trimmed.length;
                showStatus(`Rensade ${removed} gamla merge-poster. Behöll ${trimmed.length} senaste.`, 'success');
                await loadFileSizes();
                await loadCounts();
            } else {
                showStatus('Kunde inte spara merge-loggar', 'error');
            }
        } catch (err) {
            console.error('Fel vid rensning av merges:', err);
            showStatus('Fel vid rensning av merge-loggar', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const handleBack = () => {
        // Spara ändringar när man går tillbaka
        try {
            localStorage.setItem('auditKeepLast', keepAuditLast.toString());
            localStorage.setItem('mergesKeepLast', keepMergesLast.toString());
        } catch (err) {
            console.error('Kunde inte spara inställningar:', err);
        }
        
        if (onBack) {
            onBack();
        } else if (onClose) {
            onClose();
        }
    };

    return (
        <WindowFrame
            windowId="audit-merges-settings"
            title="Audit & Merges Inställningar"
            icon={Settings}
            initialWidth={800}
            initialHeight={700}
            onClose={handleBack}
            zIndex={10001}
        >
            <div className="p-6 h-full overflow-y-auto custom-scrollbar bg-slate-900">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-slate-200">Audit & Merges Inställningar</h2>
                </div>

                <div className="space-y-6">
                    {/* Audit Log */}
                    <div className="bg-slate-900 border border-slate-700 rounded p-4">
                        <h3 className="text-lg font-semibold text-slate-200 mb-3">Audit-loggar</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">Filstorlek:</span>
                                <span className="text-slate-200 font-medium">
                                    {auditSize.exists ? `${auditSize.sizeMB} MB` : 'Filen finns inte'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">Antal poster:</span>
                                <span className="text-slate-200 font-medium">{auditCount.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-4">
                                <label className="text-sm text-slate-400">Behåll senaste:</label>
                                <input
                                    type="number"
                                    min="100"
                                    max="50000"
                                    value={keepAuditLast}
                                    onChange={(e) => setKeepAuditLast(parseInt(e.target.value) || 1000)}
                                    className="w-24 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200 text-sm"
                                />
                                <span className="text-xs text-slate-500">poster</span>
                            </div>
                            <Button
                                onClick={handleCleanupAudit}
                                variant="danger"
                                size="sm"
                                disabled={loading || auditCount <= keepAuditLast}
                            >
                                <Trash2 size={16} className="mr-2" />
                                Rensa gamla audit-poster
                            </Button>
                            {auditCount > 10000 && (
                                <div className="flex items-center gap-2 text-amber-500 text-sm mt-2">
                                    <AlertTriangle size={16} />
                                    <span>Varning: Audit-loggen är stor ({auditCount} poster). Överväg att rensa.</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Merges Log */}
                    <div className="bg-slate-900 border border-slate-700 rounded p-4">
                        <h3 className="text-lg font-semibold text-slate-200 mb-3">Merge-loggar</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">Filstorlek:</span>
                                <span className="text-slate-200 font-medium">
                                    {mergesSize.exists ? `${mergesSize.sizeMB} MB` : 'Filen finns inte'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">Antal poster:</span>
                                <span className="text-slate-200 font-medium">{mergesCount.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-4">
                                <label className="text-sm text-slate-400">Behåll senaste:</label>
                                <input
                                    type="number"
                                    min="50"
                                    max="5000"
                                    value={keepMergesLast}
                                    onChange={(e) => setKeepMergesLast(parseInt(e.target.value) || 500)}
                                    className="w-24 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200 text-sm"
                                />
                                <span className="text-xs text-slate-500">poster</span>
                            </div>
                            <Button
                                onClick={handleCleanupMerges}
                                variant="danger"
                                size="sm"
                                disabled={loading || mergesCount <= keepMergesLast}
                            >
                                <Trash2 size={16} className="mr-2" />
                                Rensa gamla merge-poster
                            </Button>
                            {mergesCount > 1000 && (
                                <div className="flex items-center gap-2 text-amber-500 text-sm mt-2">
                                    <AlertTriangle size={16} />
                                    <span>Varning: Merge-loggen är stor ({mergesCount} poster). Överväg att rensa.</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Info */}
                    <div className="bg-blue-900/20 border border-blue-700 rounded p-3 text-sm text-blue-200">
                        <p>
                            <strong>Info:</strong> Audit- och merge-loggar sparas nu i separata filer 
                            (<code className="bg-slate-800 px-1 rounded">*_audit.json</code> och <code className="bg-slate-800 px-1 rounded">*_merges.json</code>) 
                            istället för i huvuddatabasen. Detta gör databasen mycket mindre och snabbare.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                    <Button onClick={handleBack} variant="secondary" size="sm">
                        <ArrowLeft size={16} className="mr-2" />
                        Bakåt
                    </Button>
                </div>
            </div>
        </WindowFrame>
    );
}

