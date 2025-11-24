import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req) {
  try {
    const body = await req.json();
    const { text, currentVitals } = body;

    console.log("🔥 API HIT: /api/generate");
    console.log("🗣️ User said:", text);

    // --------------------------------------------------------
    // 1. MEMORY ACCESS
    // --------------------------------------------------------
    const filePath = path.join(process.cwd(), "wellness_log.json");
    let memoryContext = "No previous records. Initializing baseline.";

    try {
      if (fs.existsSync(filePath)) {
        const fileData = fs.readFileSync(filePath, "utf8");
        const history = JSON.parse(fileData);
        const lastEntry = history[history.length - 1];
        if (lastEntry) {
          memoryContext = `LAST LOG (${lastEntry.timestamp}): Mood ${lastEntry.biometrics.mood_score}/10.`;
        }
      }
    } catch (e) { }

    // --------------------------------------------------------
    // 2. GEMINI (LLM) - FINAL LOGIC FIX
    // --------------------------------------------------------

    const systemPrompt = `
    You are Nexus, a Bio-Optimization AI. User: "Operator Smarty".
    
    YOUR GOAL: Extract bio-data and goals into JSON.
    
    DATA STRUCTURE:
    {
      "biometrics": {
        "mood_status": "string",
        "mood_score": "integer (1-10)",
        "energy_level": "string (LOW/MODERATE/HIGH)",
        "stress_load": "integer (0-100)",
        "sleep_status": "string"
      },
      "directives": [ { "priority": "HIGH/MED/LOW", "task": "string" } ],
      "analysis": { "recommendation": "string" }
    }

    CURRENT STATE: ${JSON.stringify(currentVitals)}
    USER INPUT: "${text}"

    STRICT PROTOCOL:
    
    1. **DATA EXTRACTION**: 
       - Extract Mood, Energy, Stress, Sleep, and Directives from input.
       - If user mentions tasks ("I need to...", "My goals are..."), add to 'directives'.

    2. **MISSING DATA CHECK**:
       - IF 'mood_status' is missing -> Ask for Mood.
       - IF 'energy_level' is missing -> Ask for Energy/Stress.
       - IF 'directives' is empty -> Ask for Goals.

    3. **COMPLETION TRIGGER (CRITICAL)**:
       - IF (Mood + Energy + Directives) are ALL present:
         1. Set "isComplete": true.
         2. **AUTO-GENERATE RECOMMENDATION**: You MUST write a specific, actionable tip in "analysis.recommendation" based on their stress/energy levels. (e.g., "High stress detected. Execute 5m breathing protocol.")
         3. SPEECH: "Directives logged. Protocol locked. Recommendation: [Speak the Recommendation]. Session complete."

    JSON RESPONSE FORMAT:
    {
      "speech": "Your verbal response...",
      "vitals": { ...merged state, INCLUDING RECOMMENDATION... },
      "isComplete": boolean
    }
    `;

    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`;

    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] }),
    });

    const geminiRaw = await geminiRes.text();
    let geminiData;
    try { geminiData = JSON.parse(geminiRaw); } catch (e) { throw new Error("Gemini JSON Error"); }

    if (!geminiData.candidates || geminiData.candidates.length === 0) throw new Error("No candidates");

    let rawText = geminiData.candidates[0].content.parts[0].text;
    rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

    console.log("🤖 AI Data:", rawText);

    let aiResponse;
    try {
      aiResponse = JSON.parse(rawText);
    } catch (e) {
      console.error("JSON Parse Fail", rawText);
      aiResponse = { speech: "Data packet corrupted. Please repeat.", vitals: currentVitals, isComplete: false };
    }

    // --------------------------------------------------------
    // 3. PERSISTENCE
    // --------------------------------------------------------
    if (aiResponse.isComplete) {
      let logs = [];
      try {
        if (fs.existsSync(filePath)) logs = JSON.parse(fs.readFileSync(filePath, "utf8"));
      } catch (e) { }

      const newEntry = {
        id: `LOG-${Date.now().toString(36).toUpperCase()}`,
        timestamp: new Date().toISOString(),
        ...aiResponse.vitals
      };

      logs.push(newEntry);
      fs.writeFileSync(filePath, JSON.stringify(logs, null, 2));
      console.log(`💾 Session Saved.`);
    }

    // --------------------------------------------------------
    // 4. MURF TTS
    // --------------------------------------------------------
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const textToSpeak = aiResponse.speech || "Processing...";

      const murfRes = await fetch(process.env.MURF_TTS_URL, {
        method: "POST",
        headers: {
          "api-key": process.env.MURF_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voiceId: "en-US-matthew",
          text: textToSpeak,
          multiNativeLocale: "en-US",
          model: "FALCON",
          format: "MP3",
          sampleRate: 24000,
          channelType: "MONO",
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!murfRes.ok) throw new Error("Murf Failed");
      const arrayBuffer = await murfRes.arrayBuffer();
      const base64Audio = Buffer.from(arrayBuffer).toString("base64");

      return NextResponse.json({
        reply: aiResponse.speech,
        vitals: aiResponse.vitals,
        isComplete: aiResponse.isComplete,
        audio: `data:audio/mp3;base64,${base64Audio}`,
      });
    } catch (error) {
      return NextResponse.json({ reply: aiResponse.speech, vitals: aiResponse.vitals, error: "TTS Failed" });
    }

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}