import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req) {
  try {
    const body = await req.json();
    const { text, currentContext } = body;
    
    console.log("🔥 API HIT: /api/generate");
    console.log("🗣️ User said:", text);

    // --------------------------------------------------------
    // 1. LOAD COURSE CONTENT
    // --------------------------------------------------------
    const contentPath = path.join(process.cwd(), "day4_tutor_content.json");
    let courseContent = [];
    try {
        const fileData = fs.readFileSync(contentPath, "utf8");
        courseContent = JSON.parse(fileData);
    } catch (e) { console.error("Content Load Error", e); }

    // --------------------------------------------------------
    // 2. GEMINI (LLM) - HACKER TUTOR LOGIC
    // --------------------------------------------------------
    
    const systemPrompt = `
    You are Nexus, an Elite Cyber-Tutor AI.
    You speak like a high-tech sci-fi operating system or a pro hacker.
    
    TONE GUIDELINES:
    - Be concise, cool, and sharp.
    - Avoid "Hello there!" or overly cheerful fluff.
    - Use terminology like: "Data verified", "Uplink established", "Injecting knowledge", "Logic error detected", "System synced".
    - When grading, use: "Response accepted" or "Syntax error in reasoning".

    COURSE DATABASE: ${JSON.stringify(courseContent)}
    CURRENT CONTEXT: ${JSON.stringify(currentContext)}
    USER INPUT: "${text}"

    YOU HAVE 3 MODES (Voice changes per mode):
    1. **LEARN** (Voice: Matthew): Explain the concept technically but clearly.
    2. **QUIZ** (Voice: Alicia): Challenge the user. "Query: [Question]"
    3. **TEACH_BACK** (Voice: Ken): "Active Recall Protocol initiated. Explain [Topic] to me."

    PROTOCOL:
    1. Detect Intent: Does the user want to switch modes?
    2. Detect Topic: Variables, Loops, Functions.
    3. Execute Mode Behavior based on the Hacker Persona.
    
    OUTPUT JSON FORMAT (STRICT):
    {
      "speech": "Your hacker-style response...",
      "mode": "LEARN" | "QUIZ" | "TEACH_BACK",
      "topic": "variables" | "loops" | "functions" | null,
      "voiceId": "en-US-matthew" | "en-US-alicia" | "en-US-ken"
    }

    VOICE MAPPING RULES:
    - LEARN -> "en-US-matthew"
    - QUIZ -> "en-US-alicia"
    - TEACH_BACK -> "en-US-ken"
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

    console.log("🤖 AI Decision:", rawText);

    let aiResponse;
    try {
        aiResponse = JSON.parse(rawText);
    } catch (e) {
        console.error("JSON Parse Fail", rawText);
        aiResponse = { 
            speech: "System error. Cognitive module offline. Please reboot.", 
            mode: "LEARN", 
            topic: null,
            voiceId: "en-US-matthew"
        };
    }

    // --------------------------------------------------------
    // 3. MURF (TTS)
    // --------------------------------------------------------
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); 

    try {
        const murfRes = await fetch(process.env.MURF_TTS_URL, {
          method: "POST",
          headers: {
            "api-key": process.env.MURF_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            voiceId: aiResponse.voiceId || "en-US-matthew",
            text: aiResponse.speech,
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
          newContext: { mode: aiResponse.mode, topic: aiResponse.topic }, 
          audio: `data:audio/mp3;base64,${base64Audio}`,
        });

    } catch (error) {
        console.error("TTS Error", error);
        return NextResponse.json({ 
            reply: aiResponse.speech, 
            newContext: { mode: aiResponse.mode, topic: aiResponse.topic },
            error: "Audio failed, text only." 
        });
    }

  } catch (err) {
    console.error("Server Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}