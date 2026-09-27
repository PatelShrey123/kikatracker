/**
 * Auto-add new Kirka skins to the price sheet.
 *
 * Paste this into the sheet itself: Extensions -> Apps Script. It runs on Google's servers on a
 * timer, so there is nothing to host and nothing to deploy. It runs as you, which is why it can
 * write to the sheet without a service account or any credentials beyond the Kirka API key.
 *
 * SETUP
 *   1. Extensions -> Apps Script, delete whatever is there, paste this in.
 *   2. Project Settings -> Script Properties -> add:
 *        KIRKA_API_KEY   = your key
 *        SHEET_NAME      = the tab name, e.g. Sheet1   (optional, defaults to the first tab)
 *   3. Run `addNewSkins` once by hand and approve the permissions prompt.
 *   4. Triggers (clock icon) -> Add Trigger -> addNewSkins -> Time-driven -> every 6 hours.
 *
 * WHAT IT ADDS
 *   Only skins that are in circulation - totalOwned above zero. Kirka's catalog carries a lot of
 *   content that has never dropped (at the time of writing, 895 of 943 unpriced skins were owned
 *   by nobody). Adding those would bury the real ones. A skin appears here the first run after
 *   somebody actually owns one.
 *
 *   Expect the first run to add around 48 rows. After that it will usually add nothing, and a
 *   handful when a new set drops.
 *
 * COLUMNS
 *   Columns are matched by their header text, not by position, so reordering the sheet will not
 *   put data in the wrong place. It fills whichever of these exist and leaves the rest alone:
 *
 *     Skin Name | Type | Skin Rarity | Hub Value | Base Value | Obtainable By | Created | Owners
 *
 *   "Hub Value" and "Base Value" are set to TBD - the site and bot already display TBD rather
 *   than a zero, so an unpriced skin reads as unpriced rather than worthless. "Obtainable By"
 *   is left blank. Those are the judgement calls, and they stay yours.
 *
 *   Add a "Created" or "Owners" column if you want those filled; it is optional.
 */

var ITEMS_URL = 'https://api.kirka.io/api/inventory/items';

function addNewSkins() {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('KIRKA_API_KEY');
  if (!apiKey) throw new Error('Set KIRKA_API_KEY in Script Properties first.');

  var sheetName = props.getProperty('SHEET_NAME');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getSheets()[0];
  if (!sheet) throw new Error('Sheet "' + sheetName + '" not found.');

  // ---------------------------------------------------------------- read what we already have
  var values = sheet.getDataRange().getValues();
  if (!values.length) throw new Error('Sheet is empty - it needs a header row.');

  var headers = values[0].map(function (h) { return String(h).trim(); });
  var col = {};
  headers.forEach(function (h, i) { col[h] = i; });

  if (col['Skin Name'] === undefined) {
    throw new Error('No "Skin Name" column found in row 1.');
  }

  var have = {};
  for (var r = 1; r < values.length; r++) {
    var name = String(values[r][col['Skin Name']] || '').trim().toLowerCase();
    if (!name) continue;
    var type = col['Type'] !== undefined
      ? String(values[r][col['Type']] || '').trim().toLowerCase()
      : '';
    have[name + '|' + type] = true;
  }

  // ---------------------------------------------------------------- ask Kirka what exists
  var res = UrlFetchApp.fetch(ITEMS_URL, {
    headers: { ApiKey: apiKey, 'User-Agent': 'Mozilla/5.0 KirkaHub-Sheet/1.0' },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('Kirka API returned ' + res.getResponseCode());
  }

  var data = JSON.parse(res.getContentText());
  var items = Array.isArray(data) ? data : (data.items || []);

  // ---------------------------------------------------------------- work out what is new
  var additions = [];

  items.forEach(function (it) {
    if (it.type !== 'WEAPON_SKIN' && it.type !== 'BODY_SKIN') return;
    if (!(it.totalOwned > 0)) return;                 // not in circulation yet

    var type = it.type === 'BODY_SKIN' ? 'Character' : ((it.parent && it.parent.name) || '');
    var key = String(it.name || '').trim().toLowerCase() + '|' + type.toLowerCase();
    if (have[key]) return;

    have[key] = true;                                 // guard against duplicates within one run

    var row = new Array(headers.length).fill('');
    function put(header, value) {
      if (col[header] !== undefined) row[col[header]] = value;
    }

    put('Skin Name', it.name);
    put('Type', type);
    put('Skin Rarity', titleCase(it.rarity));
    put('Hub Value', 'TBD');
    put('Base Value', 'TBD');
    put('Obtainable By', '');
    put('Created', it.createdAt ? it.createdAt.slice(0, 10) : '');
    put('Owners', it.totalOwned || 0);

    additions.push(row);
  });

  if (!additions.length) {
    Logger.log('Nothing new. %s skins checked.', items.length);
    return;
  }

  // ---------------------------------------------------------------- write, in one call
  // Appending row by row would be slow and burns through the execution quota on a big first run.
  sheet
    .getRange(sheet.getLastRow() + 1, 1, additions.length, headers.length)
    .setValues(additions);

  Logger.log('Added %s new skin(s).', additions.length);

  // Highlight the new rows so they are easy to find and price.
  sheet
    .getRange(sheet.getLastRow() - additions.length + 1, 1, additions.length, headers.length)
    .setBackground('#fff4d6');
}

function titleCase(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/(^|[\s-])\w/g, function (m) { return m.toUpperCase(); });
}

/**
 * Optional: a one-off dry run. Logs what would be added without touching the sheet.
 * Run this first if you would rather see the damage before it happens.
 */
function previewNewSkins() {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('KIRKA_API_KEY');
  var sheetName = props.getProperty('SHEET_NAME');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getSheets()[0];

  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var col = {};
  headers.forEach(function (h, i) { col[h] = i; });

  var have = {};
  for (var r = 1; r < values.length; r++) {
    var n = String(values[r][col['Skin Name']] || '').trim().toLowerCase();
    if (!n) continue;
    var t = col['Type'] !== undefined ? String(values[r][col['Type']] || '').trim().toLowerCase() : '';
    have[n + '|' + t] = true;
  }

  var res = UrlFetchApp.fetch(ITEMS_URL, { headers: { ApiKey: apiKey }, muteHttpExceptions: true });
  var data = JSON.parse(res.getContentText());
  var items = Array.isArray(data) ? data : (data.items || []);

  var out = [];
  items.forEach(function (it) {
    if (it.type !== 'WEAPON_SKIN' && it.type !== 'BODY_SKIN') return;
    if (!(it.totalOwned > 0)) return;
    var type = it.type === 'BODY_SKIN' ? 'Character' : ((it.parent && it.parent.name) || '');
    if (have[String(it.name).trim().toLowerCase() + '|' + type.toLowerCase()]) return;
    out.push(it.name + '  (' + type + ', ' + titleCase(it.rarity) + ', ' + it.totalOwned + ' owners)');
  });

  Logger.log('Would add %s skin(s):\n%s', out.length, out.join('\n'));
}
