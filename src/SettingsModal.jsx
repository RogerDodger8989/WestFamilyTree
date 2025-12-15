import React, { useState } from 'react';
import WindowFrame from './WindowFrame.jsx';
import { Settings } from 'lucide-react';
import Button from './Button.jsx';
import RelationSettings from './RelationSettings.jsx';

export default function SettingsModal({ isOpen, onClose, auditBackupDir, setAuditBackupDirState, setAuditBackupDir, chooseAuditBackupDir, handleExportZip, handleImportZip, showStatus, setShowAuditMergesSettings }) {
    const [showRelationSettings, setShowRelationSettings] = useState(false);

    if (!isOpen) return null;

    const handleSaveAndClose = () => {
        // Spara inställningar
        if (setAuditBackupDir) {
            setAuditBackupDir(auditBackupDir);
        }
        showStatus('Inställningar sparade.');
        onClose();
    };

    return (
        <WindowFrame
            windowId="settings"
            title="Inställningar"
            icon={Settings}
            initialWidth={800}
            initialHeight={600}
            onClose={handleSaveAndClose}
            zIndex={10000}
        >
            <div className="p-6 h-full overflow-y-auto custom-scrollbar bg-slate-900">
                <div className="space-y-6">
                    {/* Audit-backup-mapp */}
                    <div className="text-slate-400">
                        <div className="mb-2">Audit-backup-mapp (valfritt):</div>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={auditBackupDir}
                                onChange={(e) => setAuditBackupDirState(e.target.value)}
                                placeholder="Sökväg till mapp eller lämna tomt för standard"
                                className="flex-1 border rounded px-2 py-1 bg-slate-800 border-slate-600 text-slate-200"
                            />
                            <Button onClick={chooseAuditBackupDir} variant="secondary" size="sm">Välj...</Button>
                            <Button onClick={() => setAuditBackupDirState('')} variant="danger" size="sm">Rensa</Button>
                        </div>
                    </div>

                    {/* Knappar */}
                    <div className="flex flex-col gap-2">
                        <div className="flex gap-2 justify-end flex-wrap">
                            <Button onClick={handleExportZip} variant="primary" size="sm">Exportera allt som zip</Button>
                            <Button onClick={handleImportZip} variant="secondary" size="sm">Importera zip-backup</Button>
                            <Button onClick={() => setShowRelationSettings(true)} variant="secondary" size="sm">Relationsinställningar</Button>
                            <Button onClick={() => { onClose(); setShowAuditMergesSettings(true); }} variant="secondary" size="sm">Audit & Merges</Button>
                        </div>
                    </div>

                    {/* Relationsinställningar */}
                    {showRelationSettings && (
                        <div className="mt-4 p-4 border border-slate-700 rounded bg-slate-900">
                            <RelationSettings inline={true} onClose={() => setShowRelationSettings(false)} />
                        </div>
                    )}
                </div>
            </div>
        </WindowFrame>
    );
}

