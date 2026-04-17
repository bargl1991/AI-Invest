/**
 * AGENT 1: SCOUT (UPDATED)
 */
function runScoutAgent() {
  if (!isWorkDay()) {
    Logger.log("😴 Today is a weekend. Scout is resting.");
    return; // Stop execution
  }
  
  const settings = getSettings();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const skanerSheet = ss.getSheetByName("Skaner");
  
  // List of sectors to analyse
  const sektory = settings.scoutCategories === '' ? ["Technology (USA)", "Energy Sector", "Consumer Goods"] : settings.scoutCategories.split(", ");
  
  Logger.log("Starting Scout Agent...");

  for (let i = 0; i < sektory.length; i++) {
    const sektor = sektory[i];
    Logger.log("Scanning sector: " + sektor);
    
    // Prompt for agent-skaner
    const userPrompt = `Przeszukaj rynek dla sektora: ${sektor}. 
    Znajdź 3 najlepsze spółki w silnej przecenie (min. 10% spadku w 30 dni) z USA i Europy.
    WAŻNE: Ticker musi być w formacie giełdowym (np. AAPL dla USA, ABEA.DE dla Niemiec, PKN.WA dla Polski). Google_ticker musi być zrozumiały dla googlefinanse (np. GOOGL). Informacja musi zawierać dane na temat Ticker, Nazwy spółki, jej obecnej ceny, krótkie uzasadnienie i google_ticker.`;

    // Using the 3.1 Flash Lite Preview model for the highest rate limits
    const rawText = callGeminiWithSearch(settings.promptSkaut, userPrompt, settings.modelScout);
    const wynikJSON = parseToStructuredJson(rawText, AGENT_SCHEMAS.SKOUT);
  
    try {
      const okazje = JSON.parse(wynikJSON);

      okazje.forEach(okazja => {
        // Build the "TICKER : FULL NAME" format
        const pelnaIdent = `${okazja.ticker} : ${okazja.nazwa}`;
        
        if (!isTickerInSheet(skanerSheet, pelnaIdent)) {
          insertIntoScanner(skanerSheet, okazja, pelnaIdent, okazja.google_ticker);
        }
      });
    } catch (e) {
      Logger.log("Processing error for sector " + sektor + ": " + e.toString());
    }

    // 15-second pause for RPM limits
    if (i < sektory.length - 1) {
      Logger.log("Pausing 15s...");
      Utilities.sleep(15000);
    }
  }
}

/**
 * Finds the first empty row (where column A is blank)
 * and inserts data there instead of always appending at the bottom.
 */
function insertIntoScanner(sheet, okazja, pelnaIdent, googleTicker) {
  const data = sheet.getRange("A:A").getValues();
  let targetRow = -1;

  // Find the first empty row
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === "" || data[i][0] === null) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow === -1) {
    targetRow = sheet.getLastRow() + 1;
  }

  const dzisiaj = new Date();
  
  // Extract the ticker: assumes pelnaIdent is "TICKER : Name"
  const tickerPart = pelnaIdent.split(" : ")[0];

  // Prepare row data
  const rowData = [
    pelnaIdent,                                     // A: Ticker : Name
    dzisiaj,                                        // B: Date
    `=GOOGLEFINANCE("${googleTicker}"; "price")`,     // C: Price (temporary formula)
    "",                                             // D: 1M Change
    okazja.uzasadnienie,                            // E: Scout description
    "Waiting for Verifier...",                      // F: Status
    "",                                             // G: Verifier justification
    false                                           // H: Decision checkbox
  ];

  // 1. Insert base data (including the price formula in column C)
  sheet.getRange(targetRow, 1, 1, 8).setValues([rowData]);

  // 2. Insert the 1M change formula in column D
  // Note: C${targetRow} will shortly become a static number
  const formula1M = `=((C${targetRow} / INDEX(GOOGLEFINANCE("${googleTicker}"; "price"; TODAY()-30); 2; 2)) - 1)`;
  sheet.getRange(targetRow, 4).setFormula(formula1M);

  // --- KEY MOMENT: FREEZING ---
  
  // Force formula recalculation before proceeding
  SpreadsheetApp.flush(); 

  // Fetch the just-calculated price from column C and the result from column D
  const cellC = sheet.getRange(targetRow, 3);
  const cellD = sheet.getRange(targetRow, 4);
  
  const finalPrice = cellC.getValue();
  const finalChange = cellD.getValue();

  // Overwrite formulas with plain values
  if (finalPrice !== "#N/A" && finalPrice !== "") {
    cellC.setValue(finalPrice); // Price becomes a number
  }
  
  if (finalChange !== "#N/A" && finalChange !== "") {
    cellD.setValue(finalChange); // 1M change becomes a number
  }
  
  console.log(`Saved and frozen data for ${tickerPart} in row ${targetRow}`);
}

/**
 * Checks whether a given ticker already exists in the Scanner or in Portfolio.
 * Extracts just the symbol (e.g. "AAPL.US") to avoid mismatches caused by company name differences.
 */
function isTickerInSheet(sheet, pelnaIdent) {
  // 1. Extract the clean ticker from the input (e.g. "AAPL.US")
  const tickerToFind = pelnaIdent.split(" : ")[0].trim().toUpperCase();

  // Helper function to check for ticker presence in sheet data
  const containsTicker = (values) => {
    return values.flat().some(cellValue => {
      if (!cellValue) return false;
      // Extract the ticker from the cell and compare
      const existingTicker = cellValue.toString().split(" : ")[0].trim().toUpperCase();
      return existingTicker === tickerToFind;
    });
  };

  // 2. Check the current sheet (e.g. Scanner)
  const dataSkaner = sheet.getRange("A2:A").getValues(); // Start from A2, skipping the header
  if (containsTicker(dataSkaner)) {
    Logger.log(`[SCOUT] ${tickerToFind} is already in the Scanner.`);
    return true;
  }

  // 3. Check the Portfolio sheet
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const portfolioSheet = ss.getSheetByName("Portfolio");

  if (portfolioSheet) {
    const dataPortfolio = portfolioSheet.getRange("A2:A").getValues();
    if (containsTicker(dataPortfolio)) {
      Logger.log(`[SCOUT] Skipped: ${tickerToFind} - already in Portfolio!`);
      return true;
    }
  }

  return false;
}