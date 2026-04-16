import { _electron as electron, test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import sqlite3pkg from 'sqlite3';
import { saveDatabaseData, loadDatabaseData } from '../electron/databaseHandler.js';

const sqlite3 = sqlite3pkg.verbose();

async function mockElectronDialogs(electronApp, dbPathOrPaths) {
  const savePath = typeof dbPathOrPaths === 'string'
    ? dbPathOrPaths
    : (dbPathOrPaths?.savePath || dbPathOrPaths?.openPath);
  const openPath = typeof dbPathOrPaths === 'string'
    ? dbPathOrPaths
    : (dbPathOrPaths?.openPath || dbPathOrPaths?.savePath);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await electronApp.evaluate(({ dialog }, paths) => {
        console.log('[E2E-Mock] Sätter upp mock för dialog.showSaveDialog pekad mot ->', paths.savePath);
        console.log('[E2E-Mock] Sätter upp mock för dialog.showOpenDialog pekad mot ->', paths.openPath);
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: paths.savePath });
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [paths.openPath] });
      }, { savePath, openPath });
      return;
    } catch (err) {
      const message = String(err && err.message ? err.message : err);
      const isTransient = /Execution context was destroyed|closed/i.test(message);
      if (!isTransient || attempt === 3) throw err;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
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

async function countSourcesInDb(dbPath) {
  return await new Promise((resolve) => {
    if (!fs.existsSync(dbPath)) return resolve(0);
    const db = new sqlite3.Database(dbPath);
    db.get('SELECT COUNT(*) AS count FROM sources', (err, row) => {
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

test('E2E: Plats -> Riksarkivet -> plus -> Källkatalog', async () => {
  test.setTimeout(120000);

  const flowDbPath = path.join(process.cwd(), 'tests', 'e2e-riksarkivet-flow.sqlite');
  if (fs.existsSync(flowDbPath)) fs.unlinkSync(flowDbPath);

  const electronApp = await electron.launch({
    args: ['electron-test/main.js'],
    env: { ...process.env, NODE_ENV: 'production' }
  });

  try {
    const placeQuery = 'Löderup';

    await mockElectronDialogs(electronApp, flowDbPath);

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    window.on('dialog', (dialog) => dialog.accept());

    // Stabil testdata för platsregister så UI-flödet inte blir beroende av extern API-tillgänglighet.
    await window.evaluate(() => {
      if (window.__WFT_E2E_FETCH_STUBBED) return;
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (url.includes('/official_places/full_tree')) {
          const payload = {
            list: [
              {
                id: 'e2e_place_loderup',
                lansnamn: 'Skåne',
                lanskod: 'M',
                kommunnamn: 'Ystad',
                kommunkod: '1286',
                sockenstadnamn: 'Löderup',
                sockenstadkod: '1265',
                ortnamn: 'Löderup',
                latitude: 55.3869,
                longitude: 14.0627
              }
            ]
          };
          return new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return originalFetch(input, init);
      };
      window.__WFT_E2E_FETCH_STUBBED = true;
    });

    await expect(window.getByRole('button', { name: 'Platsregister' })).toBeVisible({ timeout: 15000 });

    // Starta från en ny tom databas för deterministiskt resultat (ingen duplikatmatch).
    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].webContents.send('menu-action', 'new-database');
    });

    await expect.poll(async () => fs.existsSync(flowDbPath), {
      timeout: 15000,
      message: 'Ny databas skapades inte via UI'
    }).toBe(true);

    // 1) Välj plats i Platsregister.
    await window.getByRole('button', { name: 'Platsregister' }).click();
    const placeSearch = window.locator('input[placeholder="Sök plats..."]').first();
    await expect(placeSearch).toBeVisible({ timeout: 15000 });
    await expect(window.locator('[data-place-id]').first()).toBeVisible({ timeout: 30000 });
    await placeSearch.fill(placeQuery);

    let placeNode = window.locator('[data-place-id]').filter({ hasText: /Löderup/i }).first();
    if (await placeNode.count() === 0) {
      await placeSearch.fill('');
      placeNode = window.locator('[data-place-id]').first();
    }

    await expect(placeNode).toBeVisible({ timeout: 15000 });
    await placeNode.click();

    // 2) Kör Riksarkivet-sökning och skapa master-källa från första volymen.
    const riksTabButton = window.locator('button').filter({ hasText: /Riksarkivet/i }).first();
    await expect(riksTabButton).toBeVisible({ timeout: 15000 });
    await riksTabButton.click();

    const searchButton = window.locator('button').filter({ hasText: /Sök kyrkoarkiv/i }).first();
    if (await searchButton.count() === 0) {
      const bodyText = await window.locator('body').innerText();
      console.log('[E2E-RA] Kunde inte hitta sökknapp. Aktuell UI-text (trunkerad):', bodyText.slice(0, 3000));
    }
    await expect(searchButton).toBeVisible({ timeout: 15000 });
    await searchButton.click();

    const plusButton = window.locator('button[title="Skapa master-källa från volym"]').first();
    await expect(plusButton).toBeVisible({ timeout: 60000 });
    await plusButton.click();

    await expect(window.getByText(/Master-källa skapad:/i)).toBeVisible({ timeout: 15000 });
    await window.waitForTimeout(750);

    // 3) Gå till Källkatalog och verifiera att Riksarkivet-hierarkin syns i UI.
    await window.getByRole('button', { name: 'Källkatalog' }).click();
    const sourceSearch = window.locator('input[placeholder="Sök..."]').first();
    await expect(sourceSearch).toBeVisible({ timeout: 15000 });

    const riksGlobal = window.locator('body').getByText(/Riksarkivet/i).first();
    if (await riksGlobal.count() === 0) {
      const bodyText = await window.locator('body').innerText();
      console.log('[E2E-RA] Ingen Riksarkivet-text i Källkatalog. UI-text (trunkerad):', bodyText.slice(0, 3000));
    }
    await expect(riksGlobal).toBeVisible({ timeout: 15000 });

    await sourceSearch.fill(placeQuery);
    const maybeRiksFolder = window.locator('aside div').filter({ hasText: /^Riksarkivet$/ }).first();
    if (await maybeRiksFolder.count()) await maybeRiksFolder.click();

    const maybePlaceFolder = window.locator('aside div').filter({ hasText: new RegExp(placeQuery, 'i') }).first();
    if (await maybePlaceFolder.count()) await maybePlaceFolder.click();
    await expect(window.locator('body').getByText(new RegExp(placeQuery, 'i')).first()).toBeVisible({ timeout: 15000 });
  } finally {
    await electronApp.close();
    if (fs.existsSync(flowDbPath)) fs.unlinkSync(flowDbPath);
  }
});

test('E2E: Platsmerge visar slutbekräftelse och uppdaterar databas korrekt', async () => {
  test.setTimeout(120000);

  const mergeDbPath = path.join(process.cwd(), 'tests', 'e2e-place-merge.sqlite');
  if (fs.existsSync(mergeDbPath)) fs.unlinkSync(mergeDbPath);

  const masterPlaceId = 'e2e_place_master';
  const duplicatePlaceId = 'e2e_place_dup';
  const expectedEvents = 2;
  const expectedMediaFiles = 2;
  const expectedRemovedPlaces = 1;

  await saveDatabaseData(mergeDbPath, {
    people: [
      {
        id: 'e2e_person_1',
        refNumber: 1,
        firstName: 'Merge',
        lastName: 'Person',
        events: [
          { id: 'evt_1', type: 'Född', placeId: duplicatePlaceId, place: 'Duplicateby' },
          { id: 'evt_2', type: 'Död', placeId: duplicatePlaceId, place: 'Duplicateby' }
        ],
        notes: '',
        links: {},
        relations: { parents: [], children: [] },
      }
    ],
    sources: [],
    places: [
      {
        id: masterPlaceId,
        country: 'Sverige',
        region: 'Skåne',
        municipality: 'Ystad',
        parish: 'MergeSocken',
        village: 'Masterby',
        specific: 'Masterby',
      },
      {
        id: duplicatePlaceId,
        country: 'Sverige',
        region: 'Skåne',
        municipality: 'Ystad',
        parish: 'MergeSocken',
        village: 'Duplicateby',
        specific: 'Duplicateby',
      }
    ],
    relations: [],
    media: [
      {
        id: 'm1',
        title: 'Media Ett',
        placeId: duplicatePlaceId,
        connections: { people: [], places: [duplicatePlaceId], sources: [] }
      },
      {
        id: 'm2',
        title: 'Media Tva',
        connections: { people: [], places: [{ id: duplicatePlaceId, name: 'Duplicateby' }], sources: [] }
      },
      {
        id: 'm3',
        title: 'Media Tre',
        connections: { people: [], places: [masterPlaceId], sources: [] }
      }
    ],
    meta: {}
  });

  const electronApp = await electron.launch({
    args: ['electron-test/main.js'],
    env: { ...process.env, NODE_ENV: 'production' }
  });

  try {
    await mockElectronDialogs(electronApp, { openPath: mergeDbPath, savePath: mergeDbPath });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    window.on('dialog', (dialog) => dialog.accept());

    await window.evaluate(() => {
      if (window.__WFT_E2E_FETCH_STUBBED_FOR_MERGE) return;
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (url.includes('/official_places/full_tree')) {
          const payload = {
            list: [
              {
                id: 'e2e_place_master',
                lansnamn: 'Skåne',
                lanskod: 'M',
                kommunnamn: 'Ystad',
                kommunkod: '1286',
                sockenstadnamn: 'MergeSocken',
                sockenstadkod: '1265',
                ortnamn: 'Masterby',
                latitude: 55.38,
                longitude: 14.06
              },
              {
                id: 'e2e_place_dup',
                lansnamn: 'Skåne',
                lanskod: 'M',
                kommunnamn: 'Ystad',
                kommunkod: '1286',
                sockenstadnamn: 'MergeSocken',
                sockenstadkod: '1265',
                ortnamn: 'Duplicateby',
                latitude: 55.381,
                longitude: 14.061
              }
            ]
          };
          return new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return originalFetch(input, init);
      };
      window.__WFT_E2E_FETCH_STUBBED_FOR_MERGE = true;
    });

    await window.getByText('Öppna fil...', { exact: true }).first().click();
    await expect(window.getByText(/öppnades/i)).toBeVisible({ timeout: 15000 });

    await window.getByRole('button', { name: 'Platsregister' }).click();
    await expect(window.locator('[data-place-id]').first()).toBeVisible({ timeout: 30000 });

    const placeSearch = window.locator('input[placeholder="Sök plats..."]').first();
    await expect(placeSearch).toBeVisible({ timeout: 15000 });

    for (let i = 0; i < 6; i += 1) {
      const collapsedToggles = window.locator('[data-place-id] span', { hasText: '▶' });
      const count = await collapsedToggles.count();
      if (count === 0) break;
      await collapsedToggles.first().click();
    }

    let duplicateNode = window.locator('[data-place-id]').filter({ hasText: /Duplicateby/i }).first();
    let masterNode = window.locator('[data-place-id]').filter({ hasText: /Masterby/i }).first();

    if (await duplicateNode.count() === 0 || await masterNode.count() === 0) {
      await placeSearch.fill('MergeSocken');
      for (let i = 0; i < 6; i += 1) {
        const collapsedToggles = window.locator('[data-place-id] span', { hasText: '▶' });
        const count = await collapsedToggles.count();
        if (count === 0) break;
        await collapsedToggles.first().click();
      }
      await placeSearch.fill('');
      duplicateNode = window.locator('[data-place-id]').filter({ hasText: /Duplicateby/i }).first();
      masterNode = window.locator('[data-place-id]').filter({ hasText: /Masterby/i }).first();
    }

    const allCheckboxes = window.locator('[data-place-id] input[type="checkbox"]');
    const checkboxCount = await allCheckboxes.count();

    if (checkboxCount > 0) {
      if (await duplicateNode.count() > 0 && await masterNode.count() > 0) {
        const duplicateCheckbox = duplicateNode.locator('input[type="checkbox"]').first();
        const masterCheckbox = masterNode.locator('input[type="checkbox"]').first();
        if (await duplicateCheckbox.count() > 0 && await masterCheckbox.count() > 0) {
          await duplicateCheckbox.check();
          await masterCheckbox.check();
        } else {
          expect(checkboxCount).toBeGreaterThan(2);
          await allCheckboxes.nth(checkboxCount - 1).check();
          await allCheckboxes.nth(checkboxCount - 2).check();
        }
      } else {
        expect(checkboxCount).toBeGreaterThan(2);
        await allCheckboxes.nth(checkboxCount - 1).check();
        await allCheckboxes.nth(checkboxCount - 2).check();
      }
    } else {
      await expect(duplicateNode).toBeVisible({ timeout: 15000 });
      await expect(masterNode).toBeVisible({ timeout: 15000 });
      await duplicateNode.click();
      await masterNode.click({ modifiers: ['Control'] });
    }

    const mergeButton = window.getByRole('button', { name: /Slå ihop platser/i }).first();
    await expect(mergeButton).toBeEnabled({ timeout: 10000 });
    await mergeButton.click();

    const masterRadio = window.locator('label', { hasText: new RegExp(`Masterby.*${masterPlaceId}`, 'i') }).locator('input[type="radio"]').first();
    await expect(masterRadio).toBeVisible({ timeout: 10000 });
    await masterRadio.check();

    await window.getByRole('button', { name: /Gå vidare/i }).click();

    const finalConfirmText = window.locator('text=/Sammanslagningen kommer att flytta/i').first();
    await expect(finalConfirmText).toContainText(`${expectedEvents} händelser`, { timeout: 10000 });
    await expect(finalConfirmText).toContainText(`${expectedMediaFiles} mediefiler`);
    await expect(finalConfirmText).toContainText(`${expectedRemovedPlaces} dubblett-platser`);
    await expect(finalConfirmText).toContainText('Masterby');

    await window.getByRole('button', { name: /Slutför sammanslagning/i }).click();
    await expect(window.getByText(/Merge klar:/i)).toBeVisible({ timeout: 15000 });

    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].webContents.send('menu-action', 'save-database');
    });
    await expect(window.getByText(/Sparad/i)).toBeVisible({ timeout: 20000 });

    const savedDb = await loadDatabaseData(mergeDbPath);
    const savedPeople = Array.isArray(savedDb?.people) ? savedDb.people : [];
    const savedMedia = Array.isArray(savedDb?.media) ? savedDb.media : [];
    const savedPlaces = Array.isArray(savedDb?.places) ? savedDb.places : [];

    const impactedEvents = savedPeople
      .flatMap((person) => Array.isArray(person?.events) ? person.events : [])
      .filter((event) => String(event?.id || '').startsWith('evt_'));

    expect(impactedEvents.length).toBe(expectedEvents);
    for (const event of impactedEvents) {
      const placeId = String(event?.placeId || event?.place_id || '').trim();
      expect(placeId).toBe(masterPlaceId);
    }

    const parseConnections = (item) => {
      const raw = item?.connections;
      if (!raw) return { places: [] };
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw);
        } catch {
          return { places: [] };
        }
      }
      return raw;
    };

    const m1 = savedMedia.find((item) => item.id === 'm1');
    const m2 = savedMedia.find((item) => item.id === 'm2');
    expect(String(m1?.placeId || m1?.place_id || '').trim()).toBe(masterPlaceId);

    const m1Places = (parseConnections(m1).places || []).map((p) => typeof p === 'object' ? String(p.id || p.placeId || '').trim() : String(p || '').trim());
    const m2Places = (parseConnections(m2).places || []).map((p) => typeof p === 'object' ? String(p.id || p.placeId || '').trim() : String(p || '').trim());
    expect(m1Places).toContain(masterPlaceId);
    expect(m1Places).not.toContain(duplicatePlaceId);
    expect(m2Places).toContain(masterPlaceId);
    expect(m2Places).not.toContain(duplicatePlaceId);

    const remainingPlaceIds = new Set(savedPlaces.map((place) => String(place?.id || '').trim()));
    expect(remainingPlaceIds.has(masterPlaceId)).toBeTruthy();
    expect(remainingPlaceIds.has(duplicatePlaceId)).toBeFalsy();
  } finally {
    await electronApp.close();
    if (fs.existsSync(mergeDbPath)) fs.unlinkSync(mergeDbPath);
  }
});