function isMarketOpeningWindow(ident) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  const ticker = ident.split(" : ")[0].toUpperCase();
  let openTimeMinutes = 9 * 60; // Default 09:00 (Europe)

  if (ticker.endsWith(".US")) {
    openTimeMinutes = 15 * 60 + 30; // 15:30 (USA)
  }

  const startWindow = openTimeMinutes - 60; // -1h
  const endWindow = openTimeMinutes + 60;   // +1h

  const inWindow = currentMinutes >= startWindow && currentMinutes <= endWindow;
  
  if (!inWindow) {
    const openStr = Math.floor(openTimeMinutes / 60) + ":" + (openTimeMinutes % 60 || "00");
    Logger.log(`⏳ Skipped ${ticker}: Outside opening window (${openStr} +/- 1h).`);
  }
  
  return inWindow;
}

function getGoogleFinanceTicker(ident) {
  if (!ident) return "";
  
  // Extract the part before " : "
  let rawTicker = ident.split(" : ")[0].trim().toUpperCase();
  
  // Map of suffixes to Google Finance prefixes
  const mapping = {
    ".PL": "WSE:",    // Poland
    ".DE": "ETR:",    // Germany (Xetra)
    ".UK": "LON:",    // United Kingdom
    ".CH": "SWX:",    // Switzerland
    ".NL": "AMS:",    // Netherlands
    ".PA": "EPA:",
    ".US": ""         // USA (usually no prefix needed)
  };

  for (let suffix in mapping) {
    if (rawTicker.endsWith(suffix)) {
      let ticker = rawTicker.replace(suffix, "");
      // Exception for Tauron (Google uses the abbreviation TPE)
      if (ticker === "TAURON") ticker = "TPE"; 
      return mapping[suffix] + ticker;
    }
  }

  // If there is no dot (e.g. plain GOOGL), return as-is
  return rawTicker;
}

/**
 * Checks whether today is a working day (Mon-Fri).
 * @return {boolean} true if today is Monday through Friday.
 */
function isWorkDay() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Mon, ..., 6 = Sat
  
  // Returns true only for days 1, 2, 3, 4, 5
  return (dayOfWeek >= 1 && dayOfWeek <= 5);
}