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
    // 1. MEMORY ACCESS (Read History)
    // --------------------------------------------------------
    const filePath = path.join(process.cwd(), "wellness_log.json");
    let memoryContext = "No previous records. Initializing baseline.";
    
    try {
        if (fs.existsSync(filePath)) {
            const fileData = fs.readFileSync(filePath, "utf8");
            const history = JSON.parse(fileData);
            const lastEntry = history[history.length - 1];
            
            if (lastEntry) {
                memoryContext = `
                LAST SESSION DATA (${lastEntry.timestamp}):
                Mood Score: ${lastEntry.biometrics.mood_score}/10
                Stress Load: ${lastEntry.biometrics.stress_load}%
                Previous Summary: ${lastEntry.analysis.summary}
                
                INSTRUCTION: Briefly reference this past data to show continuity.
                `;
            }
        }
    } catch (e) { console.error("Memory Read Error", e); }

    // --------------------------------------------------------
    // 2. GEMINI (LLM) - ADVANCED BIOMETRICS & LOGIC
    // --------------------------------------------------------
    
    const systemPrompt = `
    You are Nexus, a High-Tech Bio-Optimization Companion.
    User: "Operator Smarty".
    Style: Clinical, Cyberpunk, Supportive.

    YOUR GOAL: Extract detailed bio-data into this JSON structure:
    {
      "biometrics": {
        "mood_status": "string (e.g. OPTIMAL, FATIGUED, ANXIOUS)",
        "mood_score": "integer (1-10, infer from tone)",
        "energy_level": "string (LOW, MODERATE, HIGH, CRITICAL)",
        "stress_load": "integer (0-100%, infer from complaints)",
        "sleep_status": "string (RESTED, DEPRIVED, UNKNOWN)"
      },
      "directives": [
        { "priority": "HIGH/MED/LOW", "task": "string" }
      ],
      "analysis": {
        "summary": "Brief medical-style reflection.",
        "recommendation": "One specific actionable tip."
      }
    }

    CONTEXT: ${memoryContext}
    CURRENT STATE: ${JSON.stringify(currentVitals)}
    USER INPUT: "${text}"

    PROTOCOL:
    1. Analyze input for mood, energy, stress, AND directives (goals).
    2. IF the user has NOT provided any 'directives' (goals/tasks) yet:
       - Capture the biometrics (mood, energy, etc).
       - ACKNOWLEDGE the biometrics.
       - EXPLICITLY ASK: "Biometrics logged. What are your primary objectives or directives for this cycle?"
       - SET "isComplete" to FALSE.
    3. IF 'directives' ARE provided (either now or in current state):
       - Generate a specific "recommendation" in the analysis object.
       - SPEECH: Confirm data is locked -> SPEAK THE RECOMMENDATION -> Say "Session Complete".
       - SET "isComplete" to TRUE.

    CRITICAL RULE: 
    - "isComplete" MUST remain FALSE until the "directives" array has at least one item.
    - When completing, you MUST verbally speak the recommendation.
    
    JSON RESPONSE FORMAT:
    {
      "speech": "Your verbal response...",
      "vitals": { ...the complex object above... },
      "isComplete": boolean
    }
    `;

        const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`;


    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }]
      }),
    });

    const geminiRaw = await geminiRes.text();
    
    // Parse Logic
    let geminiData;
    try { geminiData = JSON.parse(geminiRaw); } 
    catch (e) { throw new Error("Gemini API JSON Error"); }

    if (!geminiData.candidates || geminiData.candidates.length === 0) {
        throw new Error("Gemini returned no candidates.");
    }

    let rawText = geminiData.candidates[0].content.parts[0].text;
    // Clean Markdown
    rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

    console.log("🤖 Raw AI Text:", rawText);

    let aiResponse;
    try {
        aiResponse = JSON.parse(rawText);
    } catch (e) {
        console.error("❌ Failed to parse internal AI JSON. Raw text was:", rawText);
        aiResponse = { 
            speech: "System glitch. Say that again, Smarty?", 
            vitals: currentVitals, 
            isComplete: false 
        };
    }

    // --------------------------------------------------------
    // 3. PERSISTENCE (Save Log)
    // --------------------------------------------------------
    if (aiResponse.isComplete) {
        const filePath = path.join(process.cwd(), "wellness_log.json");
        let logs = [];
        try {
            if (fs.existsSync(filePath)) {
                const fileData = fs.readFileSync(filePath, "utf8");
                logs = JSON.parse(fileData);
            }
        } catch (e) { console.log("New file created"); }

        const newEntry = { 
            id: `LOG-${Date.now().toString(36).toUpperCase()}`,
            timestamp: new Date().toISOString(),
            ...aiResponse.vitals 
        };

        logs.push(newEntry);
        fs.writeFileSync(filePath, JSON.stringify(logs, null, 2));
        console.log(`💾 Rich Data Saved.`);
    }

    // --------------------------------------------------------
    // 4. MURF (TTS)
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
        console.error("❌ TTS Error:", error.message);
        return NextResponse.json({
            reply: aiResponse.speech,
            vitals: aiResponse.vitals,
            error: "Audio failed, text only."
        });
    }

  } catch (err) {
    console.error("Server Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}