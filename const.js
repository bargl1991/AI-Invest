const AGENT_SCHEMAS = {
  SKOUT: {
    type: "array",
    items: {
      type: "object",
      properties: {
        ticker: { type: "string" },
        nazwa: { type: "string" },
        cena: { type: "string" },
        uzasadnienie: { type: "string" },
        google_ticker: { type: "string" }
      },
      required: ["ticker", "nazwa", "cena", "uzasadnienie", "google_ticker"]
    }
  },
  ANALYST: {
    type: "object",
    properties: {
      werdykt: { type: "string", enum: ["POZYTYWNA", "RYZYKOWNA", "PUŁAPKA"] },
      potencjalny_zysk: { type: "string" },
      cel_cenowy: { type: "string" },
      stop_loss: { type: "string" },
      analiza: { type: "string" }
    },
    required: ["werdykt", "potencjalny_zysk", "cel_cenowy", "stop_loss", "analiza"]
  },
  GUARDIAN: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["BEZPIECZNIE", "UWAŻAJ"] },
      sugerowany_sl: { type: "number" },
      sugerowany_cel: { type: "number" },
      rekomendacja: { type: "string" }
    },
    required: ["status", "sugerowany_sl", "sugerowany_cel", "rekomendacja"]
  }
};