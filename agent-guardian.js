/**
 * AGENT 3: GUARDIAN (VERSION WITH NOTIFICATIONS AND IMPROVED COLORING)
 */
function runGuardianAgent() {
  if (!isWorkDay()) {
    Logger.log("😴 Today is a weekend. Guardian is resting.");
    return; // Stop execution
  }

  const settings = getSettings();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const portfolio = ss.getSheetByName("Portfolio");
  if (!portfolio) return;
  
  const data = portfolio.getDataRange().getValues();
  const displayData = portfolio.getDataRange().getDisplayValues(); 
  
  Logger.log("Starting Guardian (Repairs, Colors, and Alerts)...");

  for (let i = 1; i < data.length; i++) {
    const ident = data[i][0]; // Column A: Ticker : Name
    if (!ident || ident === "") continue;

    if (!isMarketOpeningWindow(ident)) {
    continue; // Skip to the next company on the list
  }

    const row = i + 1;
    const ticker = ident.includes(" : ") ? ident.split(" : ")[0] : ident;

    const entireRowRange = portfolio.getRange(row, 1, 1, 11);
    const statusCell = portfolio.getRange(row, 10)

    Logger.log(`⚙️ WORKING ON: [Row ${row}] | ${ident}`);
    
    // 1. FETCHING CURRENCY AND PRICE
      const fullPriceString = displayData[i][2]; 
      const walutaMatch = fullPriceString.match(/[A-Z,a-z,$,€,£]+/g);
      const waluta = walutaMatch ? walutaMatch[walutaMatch.length - 1] : "USD";

    // 2. SETTING FORMULAS (To refresh data)
    const mappedTicker = getGoogleFinanceTicker(ident);

    // Set a clean formula in column E
    portfolio.getRange(row, 5).setFormula(`=GOOGLEFINANCE("${mappedTicker}"; "price")`);
    portfolio.getRange(row, 6).setFormula(`=(E${row} / VALUE(REGEXEXTRACT(C${row}; "[0-9.,]+"))) - 1`);
    portfolio.getRange(row, 7).setFormula(`=(E${row} - VALUE(REGEXEXTRACT(C${row}; "[0-9.,]+"))) * VALUE(SUBSTITUTE(SUBSTITUTE(D${row}; ","; "."); "."; MID(1/2; 2; 1)))`);

    // Currency formatting
    const formatWaluty = `#,##0.00" ${waluta}"`;
    [3, 5, 7, 8, 9].forEach(col => portfolio.getRange(row, col).setNumberFormat(formatWaluty));
    portfolio.getRange(row, 6).setNumberFormat("0.00%");

    SpreadsheetApp.flush(); // Force price recalculation

    // 3. ANALIZA AI
    const userPrompt = `Działaj jako analityk. Spółka: ${ident}. 
    Aktualna cena: ${displayData[i][4]}. Cena zakupu: ${fullPriceString}.
    Zweryfikuj obecny SL (${portfolio.getRange(row, 8)}) i CEL (${portfolio.getRange(row, 9)}) i jeżeli to konieczne zaproponuj NOWY SL i NOWY CEL (liczba) (cena zakupu nie musi być pomiędzy tymi wartościami, jeżeli nie jest oznacza to że trzeba sprzedać a w analizie potrzebuje informacji o szczegółach wyjścia). Potrzebuje też jasnej rekomendacji co zrobić z tymi akcjami oraz informacji czy inwestycja jest obecnie bezpieczna czy ryzkowna`;

    const rawText = callGeminiWithSearch(settings.promptGuardian, userPrompt, settings.modelGuardian);
    const wynikJSON = parseToStructuredJson(rawText, AGENT_SCHEMAS.GUARDIAN)
    
    try {
      const cleanJson = wynikJSON.replace(/```json/g, "").replace(/```/g, "").trim();
      const res = JSON.parse(cleanJson);

      // Save new levels
      if (res.sugerowany_sl) portfolio.getRange(row, 8).setValue(res.sugerowany_sl);
      if (res.sugerowany_cel) portfolio.getRange(row, 9).setValue(res.sugerowany_cel);

      // 4. STATUS COLORING LOGIC (Column J)
      statusCell.setValue(`📢 STATUS: ${res.status}\n💡 ${res.rekomendacja}`);

      entireRowRange.setBackground("#ffffff"); 
      
      if (res.status === "BEZPIECZNIE") statusCell.setBackground("#b7e1cd");
        else if (res.status === "OSTRZEŻENIE") statusCell.setBackground("#fce8b2");
        else statusCell.setBackground("#f4cccc");

      portfolio.getRange(row, 11).setValue(new Date());

    } catch (e) {
      Logger.log("Row error " + row + ": " + e.toString());
    }

    Utilities.sleep(15000); 
  }
}

/**
 * LIGHTWEIGHT MONITOR: Checks prices and sends alerts without using AI.
 * Can be run very frequently (e.g. every 30 min).
 */
function checkPortfolioAlerts() {
  if (!isWorkDay()) return;

  const settings = getSettings();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const portfolio = ss.getSheetByName("Portfolio");
  if (!portfolio) return;

  const data = portfolio.getDataRange().getValues();
  const emailAddress = settings.userEmail || "your-email@gmail.com";

  Logger.log("🔍 START: Quick SL/TARGET level scan");

  for (let i = 1; i < data.length; i++) {
    const ident = data[i][0];
    if (!ident) continue;

    const row = i + 1;
    const ticker = ident.split(" : ")[0];
    const currentPrice = portfolio.getRange(row, 5).getValue(); // Current Price (E)
    const slValue = portfolio.getRange(row, 8).getValue();      // Stop-Loss (H)
    const celValue = portfolio.getRange(row, 9).getValue();     // Target (I)
    const entireRowRange = portfolio.getRange(row, 1, 1, 11);

    // Fetch currency from cell C formatting
    const fullPriceString = portfolio.getRange(row, 3).getDisplayValue();
    const walutaMatch = fullPriceString.match(/[A-Z,a-z,$,€,£]+/g);
    const waluta = walutaMatch ? walutaMatch[walutaMatch.length - 1] : "";

    let triggerAlert = false;
    let alertReason = "";

    // Comparison logic (mathematical)
    if (currentPrice > 0 && slValue > 0 && currentPrice <= slValue) {
      triggerAlert = true;
      alertReason = "🔴 STOP-LOSS REACHED (or price dropped below)";
    } else if (currentPrice > 0 && celValue > 0 && currentPrice >= celValue) {
      triggerAlert = true;
      alertReason = "🟢 TARGET REACHED (or price rose above)";
    }

    if (triggerAlert) {
      entireRowRange.setBackground("#cfe2f3"); // Blue for rows requiring action

      const subject = `🚨 ALERT: ${ticker} - ${alertReason}`;
      const body = `Akcja wymagana dla: ${ident}\n\n` +
          `Cena: ${currentPrice} ${waluta}\n` +
          `Twój poziom SL: ${slValue} ${waluta}\n` +
          `Twój poziom CEL: ${celValue} ${waluta}\n\n` +
          `Wiadomość wygenerowana automatycznie przez monitor portfela.`;
      
      MailApp.sendEmail(emailAddress, subject, body);
      Logger.log(`✅ Alert sent for ${ticker}`);
    }
  }
}