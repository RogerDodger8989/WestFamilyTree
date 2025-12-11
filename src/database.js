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

export async function saveFile(fileHandle, data) {
    if (window.electronAPI && typeof window.electronAPI.saveDatabase === 'function') {
        // DEBUG: Logga vad som skickas till Electron
        console.log('[database.js] saveFile:', {
            fileHandle,
            antalPersoner: Array.isArray(data?.people) ? data.people.length : 'ej array',
            personer: (Array.isArray(data?.people) && data.people.length > 0) ? data.people.map(p => ({ id: p.id, firstName: p.firstName, lastName: p.lastName })) : data?.people
        });
        return await window.electronAPI.saveDatabase(fileHandle, data);
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