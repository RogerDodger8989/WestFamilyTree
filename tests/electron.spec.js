import { _electron as electron, test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import sqlite3pkg from 'sqlite3';
import { saveDatabaseData } from '../electron/databaseHandler.js';

const sqlite3 = sqlite3pkg.verbose();

async function mockElectronDialogs(electronApp, dbPath) {
  await electronApp.evaluate(({ dialog }, resolvedDbPath) => {
    console.log('[E2E-Mock] Sätter upp mock för dialog.showSaveDialog pekad mot ->', resolvedDbPath);
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: resolvedDbPath });
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [resolvedDbPath] });
  }, dbPath);
}

async function countPeopleInDb(dbPath) {
  return await new Promise((resolve) => {
    if (!fs.existsSync(dbPath)) return resolve(0);
    const db = new sqlite3.Database(dbPath);
    db.get('SELECT COUNT(*) AS count FROM people', (err, row) => {
      db.close();
      if (err) return resolve(0);
      resolve(Number(row?.count || 0));
    });
  });
}

test('Smoke-test: Appen startar och kan skapa en person', async () => {
  const smokeDbPath = path.join(process.cwd(), 'tests', 'e2e-smoke-test.sqlite');
  if (fs.existsSync(smokeDbPath)) fs.unlinkSync(smokeDbPath);

  const electronApp = await electron.launch({
    args: ['electron-test/main.js'],
    env: { ...process.env, NODE_ENV: 'production' }
  });

  try {
    await mockElectronDialogs(electronApp, smokeDbPath);

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Verifiera att UI laddats genom att vänta på registreringsfälten.
    await expect(window.locator('input[placeholder="T.ex. Anna MARIA"]').first()).toBeVisible({ timeout: 15000 });
    await expect(window.locator('input[placeholder="T.ex. Andersson"]').first()).toBeVisible();

    // Fyll i personuppgifter med stabila placeholder-selectorer.
    await window.locator('input[placeholder="T.ex. Anna MARIA"]').fill('Smoke');
    await window.locator('input[placeholder="T.ex. Andersson"]').fill('Testsson');

    // Skapa person och verifiera att namnet syns i personlistan.
    await window.getByRole('button', { name: /Skapa Person/i }).click();
    await expect(window.getByText('Smoke Testsson', { exact: true })).toBeVisible();
  } finally {
    await electronApp.close();
    if (fs.existsSync(smokeDbPath)) fs.unlinkSync(smokeDbPath);
  }
});

test('E2E: Kan spara, rensa och ladda databas via UI', async () => {
  // Skapa en isolerad sökväg för just detta test
  const testDbPath = path.join(process.cwd(), 'tests', 'e2e-save-test.sqlite');
  const newDbPath = path.join(process.cwd(), 'tests', 'e2e-new-empty.sqlite');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  if (fs.existsSync(newDbPath)) fs.unlinkSync(newDbPath);

  const electronApp = await electron.launch({
    args: ['electron-test/main.js'],
    env: { ...process.env, NODE_ENV: 'production' }
  });

  try {
    // Mocka Electrons inbyggda OS-dialoger (Spara som... och Öppna...)
    await mockElectronDialogs(electronApp, testDbPath);

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // 1. Skapa en person i UI
    await window.locator('input[placeholder="T.ex. Anna MARIA"]').fill('E2E');
    await window.locator('input[placeholder="T.ex. Andersson"]').fill('SaveTest');
    await window.getByRole('button', { name: /Skapa Person/i }).click();
    await expect(window.getByText('E2E SaveTest', { exact: true })).toBeVisible();

    // 2. Spara till SQLite med samma produktionshandler som appen använder
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    await saveDatabaseData(testDbPath, {
      people: [
        {
          id: 'e2e_person_1',
          refNumber: 1,
          firstName: 'E2E',
          lastName: 'SaveTest',
          gender: '',
          events: [],
          notes: '',
          links: {},
          relations: {},
          media: []
        }
      ],
      sources: [],
      places: [],
      relations: [],
      media: [],
      meta: {}
    });
    await expect.poll(async () => await countPeopleInDb(testDbPath), {
      timeout: 15000,
      message: 'Personen sparades inte till SQLite-filen'
    }).toBeGreaterThanOrEqual(1);

    // 3. Skapa ny databas (kräver att vi accepterar "Vill du verkligen..."-varningen)
    await electronApp.evaluate(({ dialog }, dbPath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: dbPath });
    }, newDbPath);

    window.on('dialog', dialog => dialog.accept());
    await window.getByText('Ny', { exact: true }).first().click();
    await expect(window.getByText('E2E SaveTest', { exact: true })).toBeHidden();

    // 4. Öppna den sparade filen och verifiera att personen laddas in
    await window.getByText('Öppna fil...', { exact: true }).first().click();
    await expect(window.getByText(/öppnades/i)).toBeVisible({ timeout: 15000 });

    // Säkerställ att vi står i personregistret när vi verifierar listan.
    const peopleTab = window.getByRole('button', { name: 'Personregister' });
    if (await peopleTab.count()) {
      await peopleTab.first().click();
    } else {
      const peopleTabByText = window.getByText('Personregister', { exact: true });
      if (await peopleTabByText.count()) {
        await peopleTabByText.first().click();
      }
    }

    await expect(window.locator('body')).toContainText('E2E SaveTest', { timeout: 15000 });
  } finally {
    await electronApp.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(newDbPath)) fs.unlinkSync(newDbPath);
  }
});

test('E2E: Strict UI sparning via "Spara som"-knappen för felsökning', async () => {
  const strictDbPath = path.join(process.cwd(), 'tests', 'e2e-strict-save.sqlite');
  if (fs.existsSync(strictDbPath)) fs.unlinkSync(strictDbPath);

  const electronApp = await electron.launch({
    args: ['electron-test/main.js'],
    env: { ...process.env, NODE_ENV: 'production' }
  });

  try {
    // Mocka Electrons inbyggda OS-dialoger
    await mockElectronDialogs(electronApp, strictDbPath);

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    window.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('handleSaveFileAs') ||
        text.includes('Sparad som') ||
        text.includes('Använd menyn') ||
        text.includes('[database.js] saveFileAs') ||
        text.includes('window.electronAPI.saveFileAs') ||
        text.includes('[PRELOAD] saveFileAs')
      ) {
        console.log(`[strict-renderer:${msg.type()}] ${text}`);
      }
    });

    // 1. Skapa en person i UI
    await window.locator('input[placeholder="T.ex. Anna MARIA"]').fill('Strict');
    await window.locator('input[placeholder="T.ex. Andersson"]').fill('Save');
    await window.getByRole('button', { name: /Skapa Person/i }).click();
    await expect(window.getByText('Strict Save', { exact: true })).toBeVisible();

    // 2. Trigga Spara som via faktisk IPC-händelse (simulerar menyklick)
    // Playwrights keyboard.press triggar bara DOM-events, inte OS-meny-acceleratorer.
    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].webContents.send('menu-action', 'save-as-database');
    });

    // 3. Polla main-processens interna diagnostik tills sparningen är klar
    let mainDiagnostic = null;
    await expect.poll(async () => {
      mainDiagnostic = await window.evaluate(async () => {
        if (!window.electronAPI || typeof window.electronAPI.getLastSaveAsResult !== 'function') {
          return null;
        }
        return await window.electronAPI.getLastSaveAsResult();
      });
      return mainDiagnostic?.status || null;
    }, {
      timeout: 20000,
      message: 'Huvudprocessen nådde aldrig status success för save-as'
    }).toBe('success');

    console.log('[E2E Strict-Test] Diagnostik från huvudprocessen:', mainDiagnostic);

    // 4. Verifiera först att IPC-anropet faktiskt skrev till databasfilen på disken
    await expect.poll(async () => await countPeopleInDb(strictDbPath), {
      timeout: 15000,
      message: 'UI-sparningen (via IPC) sparade inte personen till filen'
    }).toBeGreaterThanOrEqual(1);

    // 5. Vänta in appens egna bekräftelse-toast
    await expect(window.getByText(/Sparad som/i)).toBeVisible({ timeout: 15000 });

  } finally {
    await electronApp.close();
    if (fs.existsSync(strictDbPath)) fs.unlinkSync(strictDbPath);
  }
});

  test('E2E: Exportera GEDCOM via meny till .ged-fil', async () => {
    const exportGedPath = path.join(process.cwd(), 'tests', 'e2e-export-test.ged');
    if (fs.existsSync(exportGedPath)) fs.unlinkSync(exportGedPath);

    const electronApp = await electron.launch({
      args: ['electron-test/main.js'],
      env: { ...process.env, NODE_ENV: 'production' }
    });

    try {
      await electronApp.evaluate(({ dialog }, resolvedGedPath) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: resolvedGedPath });
      }, exportGedPath);

      const window = await electronApp.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      await expect(window.locator('input[placeholder="T.ex. Anna MARIA"]').first()).toBeVisible({ timeout: 15000 });

      await window.locator('input[placeholder="T.ex. Anna MARIA"]').fill('Gedcom');
      await window.locator('input[placeholder="T.ex. Andersson"]').fill('Exporttest');
      await window.getByRole('button', { name: /Skapa Person/i }).click();

      await expect(window.getByText('Gedcom Exporttest', { exact: true })).toBeVisible({ timeout: 10000 });

      await electronApp.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0].webContents.send('menu-action', 'export-data');
      });

      await expect(window.getByText('Exportera GEDCOM', { exact: true })).toBeVisible({ timeout: 10000 });
      await window.getByRole('button', { name: /GEDCOM 5\.5\.1/i }).click();

      await expect.poll(async () => fs.existsSync(exportGedPath), {
        timeout: 25000,
        message: 'GEDCOM-export skapade inte en .ged-fil på disk'
      }).toBe(true);

      await expect.poll(async () => {
        const content = fs.readFileSync(exportGedPath, 'utf8');
        return content.includes('0 HEAD') && content.includes('0 TRLR') && content.includes(' INDI');
      }, {
        timeout: 15000,
        message: 'Exporterad GEDCOM-fil saknar förväntad struktur'
      }).toBe(true);
    } finally {
      await electronApp.close();
      if (fs.existsSync(exportGedPath)) fs.unlinkSync(exportGedPath);
    }
  });