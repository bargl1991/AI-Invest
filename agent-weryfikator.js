/**
 * AGENT 2: VERIFIER (WITH COLORING AND PROFIT ANALYSIS)
 */
function runVerifierAgent() {
  if (!isWorkDay()) {
    Logger.log("😴 Today is a weekend. Verifier is resting.");
    return; // Stop execution
  }
  
  const settings = getSettings();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const skaner = ss.getSheetByName("Skaner");
  const data = skaner.getDataRange().getValues();

  Logger.log("Starting Verifier Agent...");

  for (let i = 1; i < data.length; i++) {
    const ident = data[i][0]; // Column A (Ticker : Name)
    const status = data[i][5]; // Column F (Status)

    if (ident && status === "Waiting for Verifier...") {
      // Extract just the Ticker for analysis
      const ticker = ident.split(" : ")[0];
      Logger.log("Verification: " + ticker);

      const userPrompt = `Dokonaj rygorystycznej weryfikacji spółki: ${ticker}. 
      Przeszukaj najnowsze newsy i raporty. Potrzebuje danych które w przyszłości można by przedstawić za pomocą struktury: werdykt: { type: "string", enum: ["POZYTYWNA", "RYZYKOWNA", "PUŁAPKA"] },
      potencjalny_zysk: { type: "string" },
      cel_cenowy: { type: "string" },
      stop_loss: { type: "string" },
      analiza: { type: "string" }`;

      const rawText = callGeminiWithSearch(settings.promptWeryfikator, userPrompt, settings.modelAnalyst);
      const wynikJSON = parseToStructuredJson(rawText, AGENT_SCHEMAS.ANALYST)
      
      try {
        const res = JSON.parse(wynikJSON);

        // Set verdict colors and text
        const cellStatus = skaner.getRange(i + 1, 6);
        const cellAnaliza = skaner.getRange(i + 1, 7);
        
        let color = "#ffffff"; // default white
        let werdyktTekst = res.werdykt;

        if (res.werdykt === "POZYTYWNA") {
          color = "#b7e1cd"; // Light green
        } else if (res.werdykt === "RYZYKOWNA") {
          color = "#fce8b2"; // Light yellow
        } else if (res.werdykt === "PUŁAPKA") {
          color = "#f4cccc"; // Light red
        }

        // Format the final analysis text
        const raport = `💰 POTENCJAŁ: ${res.potencjalny_zysk}\n` +
                       `🎯 TARGET: ${res.cel_cenowy} | 🛡️ SL: ${res.stop_loss}\n\n` +
                       `📝 ANALIZA: ${res.analiza}`;

        // Write to the sheet
        cellStatus.setValue(werdyktTekst).setBackground(color);
        cellAnaliza.setValue(raport);

        Logger.log("Verified: " + ticker + " as " + res.werdykt);

      } catch (e) {
        Logger.log("Verification error for " + ticker + ": " + e.toString());
        skaner.getRange(i + 1, 6).setValue("ANALYSIS ERROR");
      }

      // 15s pause for RPM limits
      Utilities.sleep(15000);
    }
  }
}