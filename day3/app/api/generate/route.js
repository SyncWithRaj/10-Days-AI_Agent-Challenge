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
    let memoryContext = "No previous records found. This is the first session.";

    try {
      if (fs.existsSync(filePath)) {
        const fileData = fs.readFileSync(filePath, "utf8");
        const history = JSON.parse(fileData);
        const lastEntry = history[history.length - 1];

        if (lastEntry) {
          memoryContext = `
                PREVIOUS SESSION DATA:
                Date: ${lastEntry.timestamp}
                Mood: ${lastEntry.mood}
                Energy: ${lastEntry.energy}
                Goals: ${lastEntry.goals.join(", ")}
                Agent Summary: ${lastEntry.summary}
                
                INSTRUCTION: Use this history to gently reference their past state (e.g., "Are you feeling better than yesterday?").
                `;
        }
      }
    } catch (e) { console.error("Memory Read Error", e); }

    // --------------------------------------------------------
    // 2. GEMINI (LLM) - Wellness Logic
    // --------------------------------------------------------

    const systemPrompt = `
    You are Nexus, a "Bio-Optimization Companion" (Cyberpunk Wellness Coach).
    You speak to "Operator Smarty" in a grounded, supportive, but cool technical style.
    
    YOUR MISSION: Conduct a daily wellness check-in.
    
    GOAL STATE TO FILL:
    {
      "mood": "string (e.g., Stressed, Happy, Anxious)",
      "energy": "string (e.g., Low, High, Optimal)",
      "goals": ["string (1-3 actionable objectives)"],
      "summary": "string (Brief agent reflection)"
    }

    CONTEXT:
    ${memoryContext}

    CURRENT STATE: ${JSON.stringify(currentVitals)}
    USER INPUT: "${text}"

    PROTOCOL:
    1. Acknowledge the user's input warmly.
    2. If this is the start, mention their previous state from memory (if available).
    3. Ask clarifying questions to fill missing fields (Mood -> Energy -> Goals).
    4. OFFER ADVICE: Give 1 short, grounded, non-medical tip based on their mood (e.g., "Take a 5m walk", "Drink water").
    5. If all fields are filled, Recap the plan and say "Session Complete".
    
    IMPORTANT: Return ONLY valid JSON.
    
    JSON FORMAT:
    {
      "speech": "Your verbal response...",
      "vitals": { ...updated state... },
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
    rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

    console.log("🤖 Raw AI Text:", rawText);

    let aiResponse;
    try {
      aiResponse = JSON.parse(rawText);
    } catch (e) {
      console.error("❌ JSON Parse Fail:", rawText);
      aiResponse = {
        speech: "Data corruption detected. Could you repeat your status?",
        vitals: currentVitals,
        isComplete: false
      };
    }

    // --------------------------------------------------------
    // 3. PERSISTENCE (Save Log)
    // --------------------------------------------------------
    if (aiResponse.isComplete) {
      let logs = [];
      try {
        if (fs.existsSync(filePath)) {
          logs = JSON.parse(fs.readFileSync(filePath, "utf8"));
        }
      } catch (e) { }

      const newEntry = {
        id: logs.length + 1,
        timestamp: new Date().toLocaleDateString(),
        ...aiResponse.vitals
      };

      logs.push(newEntry);
      fs.writeFileSync(filePath, JSON.stringify(logs, null, 2));
      console.log(`💾 Wellness Log #${newEntry.id} Saved.`);
    }

    // --------------------------------------------------------
    // 4. MURF (TTS)
    // --------------------------------------------------------
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const textToSpeak = aiResponse.speech || "Processing bio-metrics...";

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