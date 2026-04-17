/**
 * GLOBAL CONFIGURATION
 * Retrieves keys and prompts from the "Settings" tab
 */
function getSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Ustawienia");
  
  if (!sheet) {
    // If the sheet does not exist, throw a clear error
    throw new Error("ERROR: Could not find a sheet named 'Ustawienia'!");
  }

  // Get the current number of rows in the sheet
  const maxRows = sheet.getMaxRows();
  
  // If the sheet has fewer than 10 rows, fetch only as many as exist
  // to avoid a "Coordinates out of range" error
  const rowsToFetch = Math.min(maxRows, 10);
  
  // Fetch values from column B (rows 1 to rowsToFetch)
  const values = sheet.getRange(1, 2, rowsToFetch, 1).getValues(); 
  
  // Safety: if the array is too short, fall back to empty strings
  const getVal = (index) => (values[index] && values[index][0]) ? values[index][0] : "";

  return {
    apiKey: getVal(0),           // Cell B1
    promptSkaut: getVal(2),      // Cell B3
    promptWeryfikator: getVal(3),// Cell B4
    promptGuardian: getVal(4),   // Cell B5
    userEmail: getVal(5),        // Cell B6
    scoutCategories: getVal(6),  // Cell B7
    modelScout: getVal(7),       // Cell B8
    modelAnalyst: getVal(8),     // Cell B9
    modelGuardian: getVal(9)     // Cell B10
  };
}

/**
 * SPECIAL ACTION 1: Gemini API communication
 * Sends a request to the model using Google Search
 */
function callGeminiWithSearch(systemPrompt, userPrompt, modelName) {
  const settings = getSettings();

  if (!settings.apiKey || settings.apiKey.includes("Wklej tutaj")) {
    return "ERROR: You have not pasted an API key in the Settings tab!";
  }

  const apiKey = settings.apiKey;

  // Dynamically substitute the model name into the URL
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  
  const payload = {
    "contents": [
      {
        "role": "user",
        "parts": [
          {"text": "SYSTEM: " + systemPrompt},
          {"text": "USER: " + userPrompt}
        ]
      }
    ],
    "tools": [
      {
        "google_search": {} 
      }
    ],
    "generationConfig": {
      "temperature": 0.2, // Lower temperature for greater analytical precision
    }
  };

  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  const maxRetries = 4; // How many times to retry
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      const jsonResponse = JSON.parse(response.getContentText());

      // Success (200 OK)
      if (responseCode === 200) {
        if (jsonResponse.candidates && jsonResponse.candidates[0].content.parts[0].text) {
          return jsonResponse.candidates[0].content.parts[0].text;
        }
      }

      // Error 503 (overload) or 429 (rate limit)
      if (responseCode === 503 || responseCode === 429) {
        attempt++;
        const waitTime = Math.pow(2, attempt) * 2000; // 4s, 8s, 16s...
        Logger.log(`⚠️ Error ${responseCode} (Overload). Attempt ${attempt}/${maxRetries}. Waiting ${waitTime/1000}s...`);
        Utilities.sleep(waitTime);
        continue; // Retry
      }

      // Other critical error (e.g. 400 - bad prompt)
      throw new Error(`Critical API error (${responseCode}): ${responseText}`);

    } catch (e) {
      if (attempt >= maxRetries - 1) {
        Logger.log(`❌ Final error after ${maxRetries} attempts: ${e.toString()}`);
        throw e;
      }
      attempt++;
      Utilities.sleep(2000);
    }
  }
}

function parseToStructuredJson(rawText, schema) {
  const modelParser = "gemini-3.1-flash-lite-preview";
  const systemPrompt = "You are a precise financial data parser. Your only task is to convert the provided analysis into clean JSON format according to the supplied schema. Do not add any comments, explanations, or markdown formatting.";
  
  const userPrompt = "Here is the text to parse:\n\n" + rawText;

  try {
    // Call the standard callGemini function, passing it the schema and a cheaper model
    const settings = getSettings();
    let apiKey;

  if (!settings.apiKey || settings.apiKey.includes("Wklej tutaj")) {
    return "ERROR: You have not pasted an API key in the Settings tab!";
  } else if(settings.apiKey === "Bargl") {
    apiKey = "AIzaSyBY-OTd36IU333Eibqj5y0bXJWT41Mnj3M";
  } else {
    apiKey = settings.apiKey;
  }

  // Dynamically substitute the model name into the URL
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelParser}:generateContent?key=${apiKey}`;
  
  const payload = {
    "contents": [
      {
        "role": "user",
        "parts": [
          {"text": "SYSTEM: " + systemPrompt},
          {"text": "USER: " + userPrompt}
        ]
      }
    ],
    "generationConfig": {
      "temperature": 0.1,
      "responseMimeType": "application/json",
      "responseSchema": schema // Pass the selected schema
    }
  };

  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  const maxRetries = 4; // How many times to retry
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      const jsonResponse = JSON.parse(response.getContentText());

      // Success (200 OK)
      if (responseCode === 200) {
        if (jsonResponse.candidates && jsonResponse.candidates[0].content.parts[0].text) {
          return jsonResponse.candidates[0].content.parts[0].text;
        }
      }

      // Error 503 (overload) or 429 (rate limit)
      if (responseCode === 503 || responseCode === 429) {
        attempt++;
        const waitTime = Math.pow(2, attempt) * 2000; // 4s, 8s, 16s...
        Logger.log(`⚠️ Error ${responseCode} (Overload). Attempt ${attempt}/${maxRetries}. Waiting ${waitTime/1000}s...`);
        Utilities.sleep(waitTime);
        continue; // Retry
      }

      // Other critical error (e.g. 400 - bad prompt)
      throw new Error(`Critical API error (${responseCode}): ${responseText}`);

    } catch (e) {
      if (attempt >= maxRetries - 1) {
        Logger.log(`❌ Final error after ${maxRetries} attempts: ${e.toString()}`);
        throw e;
      }
      attempt++;
      Utilities.sleep(2000);
    }
  }
    
    // Strip any leftover markdown (shouldn't appear with responseSchema, but just in case)
    const cleanJson = jsonString.replace(/```json/g, "").replace(/```/g, "").trim();
    
    return JSON.parse(cleanJson);
  } catch (e) {
    Logger.log("❌ Error while parsing result to JSON: " + e.toString());
    // On error return null so the script can handle the fail-over
    return null;
  }
}

/**
 * Main trigger function - named differently from onEdit
 * to enforce use of an "Installable Trigger" (clock).
 */
function onEditTrigger(e) {
  const range = e.range;
  const sheet = range.getSheet();
  const row = range.getRow();
  const col = range.getColumn();

  // React only to the "Skaner" tab and column H (Decision)
  if (sheet.getName() === "Skaner" && col === 8 && e.value === "TRUE") {
    executePurchase(row);
  }
}

function executePurchase(row) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const skaner = ss.getSheetByName("Skaner");
  const portfolio = ss.getSheetByName("Portfolio");
  const ui = SpreadsheetApp.getUi();

  // 1. Fetch data from the Scanner
  const data = skaner.getRange(row, 1, 1, 7).getValues()[0];
  const fullIdent = data[0]; 
  const rawCena = data[2];   
  const weryfikacjaOpis = data[6];

  // --- CURRENCY LOGIC ---
  const tickerPart = fullIdent.split(" : ")[0].toUpperCase();
  let waluta = "USD"; 

  if (tickerPart.endsWith(".WA")) waluta = "PLN";
  else if (tickerPart.endsWith(".DE") || tickerPart.endsWith(".AS")) waluta = "EUR";
  else if (tickerPart.endsWith(".SW")) waluta = "CHF";
  else if (tickerPart.endsWith(".L")) waluta = "GBP";

  // --- SEPARATOR FIX: Replace dot with comma for the Polish spreadsheet locale ---
  const cenaZPrzecinkiem = rawCena.toString().replace(".", ",");
  const cenaZakupuZWaluta = `${cenaZPrzecinkiem} ${waluta}`;

  // 2. Popup window
  const response = ui.prompt(
    "🛒 PURCHASE CONFIRMATION",
    `Buying: ${fullIdent}\nMarket price: ${cenaZakupuZWaluta}\n\nEnter number of shares:`,
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() == ui.Button.OK) {
    const iloscInput = response.getResponseText().replace(".", ","); // Fix dot here too
    const ilosc = parseFloat(iloscInput.replace(",", ".")); // Need a dot for the isNaN check

    if (isNaN(ilosc) || ilosc <= 0) {
      ui.alert("❌ Error: Enter a valid number!");
      skaner.getRange(row, 8).setValue(false);
      return;
    }

    // 3. Transfer data (Column C gets the COMMA version)
    const dzisiaj = new Date();
    const newRow = [
      fullIdent,           // A
      dzisiaj,             // B
      cenaZakupuZWaluta,   // C (Always with comma, e.g. "113,08 USD")
      iloscInput,          // D (Always with comma)
      "",                  // E
      "",                  // F
      "",                  // G
      "",                  // H
      "",                  // I
      weryfikacjaOpis,     // J
      new Date()           // K
    ];

    portfolio.appendRow(newRow);

    // 4. Formulas and Formatting
    const lastRow = portfolio.getLastRow();
    const mappedTicker = getGoogleFinanceTicker(fullIdent);
    
    portfolio.getRange(lastRow, 5).setFormula(`=GOOGLEFINANCE("${mappedTicker}"; "price")`);
    
    // BULLETPROOF FORMULA (Works regardless of whether C contains a dot or comma)
    const cleanC = `VALUE(SUBSTITUTE(SUBSTITUTE(REGEXEXTRACT(C${lastRow}; "[0-9.,]+"); ","; "."); "."; MID(1/2; 2; 1)))`;
    const cleanD = `VALUE(SUBSTITUTE(SUBSTITUTE(D${lastRow}; ","; "."); "."; MID(1/2; 2; 1)))`;

    portfolio.getRange(lastRow, 6).setFormula(`=IFERROR((E${lastRow} / ${cleanC}) - 1; 0)`);
    portfolio.getRange(lastRow, 7).setFormula(`=IFERROR((E${lastRow} - ${cleanC}) * ${cleanD}; 0)`);

    const formatWaluty = `#,##0.00" ${waluta}"`;
    [3, 5, 7, 8, 9].forEach(col => portfolio.getRange(lastRow, col).setNumberFormat(formatWaluty));
    portfolio.getRange(lastRow, 6).setNumberFormat("0.00%");

    skaner.deleteRow(row);
    ui.alert(`✅ Done! ${fullIdent} added to portfolio.`);
  } else {
    skaner.getRange(row, 8).setValue(false);
  }
}

/**
 * TOTAL CLEANUP: 
 * 1. Removes expired entries (48h)
 * 2. Removes TRAPS
 * 3. Removes empty rows (tidies the view)
 */
function cleanExpiredSkanerData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Skaner");
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  const now = new Date().getTime();
  const expirationTime = 48 * 60 * 60 * 1000; // 48 hours

  Logger.log("Running deep Scanner cleanup...");

  // Iterate bottom-to-top - this is crucial when deleting rows!
  for (let i = data.length - 1; i >= 1; i--) {
    const ticker = data[i][0];           // Column A: Ticker : Name
    const rowDate = new Date(data[i][1]); // Column B: Date
    const status = data[i][5];           // Column F: Status

    let shouldDelete = false;

    // CONDITION 1: Empty row
    if (!ticker || ticker.toString().trim() === "") {
      shouldDelete = true;
    } 
    // CONDITION 2: Verdict is "PUŁAPKA" (TRAP)
    else if (status === "PUŁAPKA") {
      shouldDelete = true;
      Logger.log("Removing trap: " + ticker);
    } 
    // CONDITION 3: Expired (48h)
    else if (rowDate instanceof Date && !isNaN(rowDate)) {
      if (now - rowDate.getTime() > expirationTime) {
        shouldDelete = true;
        Logger.log("Removing expired entry: " + ticker);
      }
    }

    if (shouldDelete) {
      sheet.deleteRow(i + 1);
    }
  }
  
  Logger.log("Scanner is now clean and tidy.");
}

/**
 * Triggered when an external agent adds a row.
 * Checks the last row and replaces the formula in column C with a static value.
 */
function freezeCColumnOnNewRow(e) {
  // Check whether the change involves adding something to the sheet
  if (e.changeType === 'INSERT_ROW' || e.changeType === 'OTHER' || e.changeType === 'EDIT') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();
    
    // Determine which row is the new one
    const targetRow = sheet.getLastRow(); 
    
    // Fetch cell C in that row
    const cellC = sheet.getRange("C" + targetRow);
    
    // Wait for GOOGLEFINANCE data to load
    let attempts = 0;
    while (attempts < 5) {
      const value = cellC.getValue();
      const formula = cellC.getFormula();

      // If the cell already holds a number (not an error and not "Loading...")
      if (value !== "" && value !== "#N/A" && typeof value === 'number') {
        // FREEZE: Overwrite the formula with a plain value
        cellC.copyTo(cellC, {contentsOnly: true});
        console.log("Frozen value in row: " + targetRow);
        return; 
      }
      
      // If there is not even a formula there, nothing to freeze
      if (formula === "" && value === "") {
         console.log("Row " + targetRow + " is empty, stopping.");
         return;
      }

      Utilities.sleep(2000); // Wait 2 seconds for the Google server
      attempts++;
    }
  }
}