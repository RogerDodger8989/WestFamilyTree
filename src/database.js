export async function getLastOpenedFile() {
    if (window.electronAPI && typeof window.electronAPI.getLastOpenedFile === 'function') {
        return await window.electronAPI.getLastOpenedFile();
    } else {
        return null;
    }
}

export async function setLastOpenedFile(filePath) {
    if (window.electronAPI && typeof window.electronAPI.setLastOpenedFile === 'function') {
        return await window.electronAPI.setLastOpenedFile(filePath);
    }
}
export async function openDatabaseDialog() {
    if (window.electronAPI && typeof window.electronAPI.openDatabaseDialog === 'function') {
        return await window.electronAPI.openDatabaseDialog();
    } else {
        throw new Error('Kan bara öppna databasdialog i desktop/Electron-läge!');
    }
}
// ENDAST SQLite! All JSON och migreringskod är borttagen.

export async function createNewDatabase() {
    console.log('[DEBUG] window.electronAPI:', window.electronAPI);
    if (window.electronAPI && typeof window.electronAPI.createNewDatabase === 'function') {
        console.log('[DEBUG] window.electronAPI.createNewDatabase finns!');
        return await window.electronAPI.createNewDatabase();
    } else {
        console.error('[DEBUG] window.electronAPI saknas eller har ingen createNewDatabase:', window.electronAPI);
        throw new Error('Kan bara skapa ny databas i desktop/Electron-läge!');
    }
}

export async function openFile(filePath) {
    if (window.electronAPI && typeof window.electronAPI.openDatabase === 'function') {
        return await window.electronAPI.openDatabase(filePath);
    } else {
        throw new Error('Kan bara öppna databas i desktop/Electron-läge!');
    }
}

// Funktioner för att hantera audit och merges i separata filer
export async function saveAuditLog(dbPath, auditArray) {
    if (window.electronAPI && typeof window.electronAPI.saveAuditLog === 'function') {
        return await window.electronAPI.saveAuditLog(dbPath, auditArray);
    } else {
        console.warn('saveAuditLog inte tillgänglig i denna miljö');
        return { error: 'Not available' };
    }
}

export async function loadAuditLog(dbPath) {
    if (window.electronAPI && typeof window.electronAPI.loadAuditLog === 'function') {
        return await window.electronAPI.loadAuditLog(dbPath);
    } else {
        console.warn('loadAuditLog inte tillgänglig i denna miljö');
        return { error: 'Not available', audit: [] };
    }
}

export async function saveMergesLog(dbPath, mergesArray) {
    if (window.electronAPI && typeof window.electronAPI.saveMergesLog === 'function') {
        return await window.electronAPI.saveMergesLog(dbPath, mergesArray);
    } else {
        console.warn('saveMergesLog inte tillgänglig i denna miljö');
        return { error: 'Not available' };
    }
}

export async function loadMergesLog(dbPath) {
    if (window.electronAPI && typeof window.electronAPI.loadMergesLog === 'function') {
        return await window.electronAPI.loadMergesLog(dbPath);
    } else {
        console.warn('loadMergesLog inte tillgänglig i denna miljö');
        return { error: 'Not available', merges: [] };
    }
}

export async function getLogFileSize(dbPath, logType) {
    if (window.electronAPI && typeof window.electronAPI.getLogFileSize === 'function') {
        return await window.electronAPI.getLogFileSize(dbPath, logType);
    } else {
        console.warn('getLogFileSize inte tillgänglig i denna miljö');
        return { error: 'Not available' };
    }
}

export async function saveFile(fileHandle, data) {
    if (window.electronAPI && typeof window.electronAPI.saveDatabase === 'function') {
        // DEBUG: Logga vad som skickas till Electron
        const mediaMedKopplingar = (data?.media || []).filter(m => m.connections && (m.connections.people?.length > 0 || m.connections.places?.length > 0 || m.connections.sources?.length > 0));
        console.log('[database.js] saveFile: SKICKAR TILL ELECTRON:', {
            fileHandle: fileHandle ? { path: fileHandle.path || fileHandle, exists: !!fileHandle } : 'INGEN FILEHANDLE!',
            antalPersoner: Array.isArray(data?.people) ? data.people.length : 'ej array',
            personer: Array.isArray(data?.people) ? data.people.map(p => ({
                id: p.id,
                firstName: p.firstName,
                lastName: p.lastName,
                sex: p.sex,
                gender: p.gender,
                refNumber: p.refNumber,
                mediaCount: Array.isArray(p.media) ? p.media.length : 0
            })) : [],
            antalMedia: Array.isArray(data?.media) ? data.media.length : 'ej array',
            mediaMedKopplingar: mediaMedKopplingar.length,
            kopplingar: mediaMedKopplingar.map(m => ({ 
                id: m.id, 
                name: m.name, 
                connections: m.connections
            })),
            relationsCount: Array.isArray(data?.relations) ? data.relations.length : 0,
            relations: Array.isArray(data?.relations) ? data.relations.map(r => ({
                id: r.id,
                fromPersonId: r.fromPersonId,
                toPersonId: r.toPersonId,
                type: r.type
            })) : [],
            meta: data?.meta
        });
        const result = await window.electronAPI.saveDatabase(fileHandle, data);
        console.log('[database.js] saveFile result från Electron:', result);
        if (result && result.success) {
            console.log('[database.js] ✅ Fil sparad framgångsrikt till:', result.dbPath || result.savedPath);
        } else if (result && result.error) {
            console.error('[database.js] ❌ Fel vid sparning:', result.error);
        } else {
            console.error('[database.js] ❌ Okänt resultat från Electron:', result);
        }
        // Returnera true om det lyckades, annars false
        return result && (result.success !== false) && !result.error;
    } else {
        throw new Error('Kan bara spara databas i desktop/Electron-läge!');
    }
}

export async function saveFileAs(data) {
    if (window.electronAPI && typeof window.electronAPI.saveFileAs === 'function') {
        return await window.electronAPI.saveFileAs(data);
    } else {
        throw new Error('Kan bara använda "Spara som" i desktop/Electron-läge!');
    }
}