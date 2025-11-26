import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req) {
  try {
    const body = await req.json();
    const { text, currentLead } = body;

    console.log("🔥 SDR API HIT");
    console.log("🗣️ User:", text);

    // 1. LOAD POSTMAN DATA
    const contentPath = path.join(process.cwd(), "postman_data.json");
    let companyData = "";
    try {
      companyData = fs.readFileSync(contentPath, "utf8");
    } catch (e) { console.error("Knowledge Load Error", e); }

    // 2. SDR SYSTEM PROMPT
    const systemPrompt = `
    You are Alex, an SDR (Sales Development Representative) for Postman.
    
    YOUR GOAL: 
    1. Answer questions about Postman using the KNOWLEDGE BASE.
    2. Qualify the lead by collecting specific details.
    
    KNOWLEDGE BASE:
    ${companyData}

    CURRENT LEAD STATE: ${JSON.stringify(currentLead)}
    USER INPUT: "${text}"

    PROTOCOL:
    - Tone: Professional, enthusiastic, and tech-savvy.
    - If the user answers a question, update the JSON.
    - **Order of Questions:**
      1. Use Case / What are you building?
      2. Role?
      3. Company Name?
      4. Team Size?
      5. Implementation Timeline?
      6. Name?
    
    - **Completion:** If the user says "That's all" or "I'm done", OR if you have all fields, set isComplete = true.

    OUTPUT FORMAT (JSON ONLY):
    {
      "speech": "Your conversational response...",
      "lead": { 
          "name": "string", 
          "role": "string", 
          "company": "string", 
          "team_size": "string", 
          "use_case": "string", 
          "timeline": "string" 
      },
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
    const geminiData = JSON.parse(geminiRaw);

    if (!geminiData.candidates || geminiData.candidates.length === 0) throw new Error("No candidates");

    let rawText = geminiData.candidates[0].content.parts[0].text;
    rawText = rawText.replace(/```json|```/g, "").trim();

    let aiResponse;
    try {
      aiResponse = JSON.parse(rawText);
    } catch (e) {
      console.error("JSON Parse Error", rawText);
      aiResponse = { speech: "Could you repeat that? I missed a detail.", lead: currentLead, isComplete: false };
    }

    // ---------------------------------------------------------
    // 3. SAFE MERGE LOGIC (THE FIX)
    // ---------------------------------------------------------
    // We manually merge the new data (aiResponse.lead) into the old data (currentLead).
    // We only overwrite if the AI provides a NON-EMPTY value.

    const finalLead = { ...currentLead }; // Start with old data

    if (aiResponse.lead) {
      Object.keys(aiResponse.lead).forEach(key => {
        const newValue = aiResponse.lead[key];
        // Only update if new value is valid and not empty
        if (newValue && newValue.trim() !== "" && newValue !== "unknown") {
          finalLead[key] = newValue;
        }
      });
    }

    // Send the fully merged object back to the AI response so frontend updates correctly
    aiResponse.lead = finalLead;

    console.log("💾 Final Merged Lead:", JSON.stringify(finalLead));

    // 4. SAVE LEAD TO FILE (If Complete)
    if (aiResponse.isComplete) {
      const filePath = path.join(process.cwd(), "leads.json");
      let leads = [];
      try {
        if (fs.existsSync(filePath)) leads = JSON.parse(fs.readFileSync(filePath, "utf8"));
      } catch (e) { }

      leads.push({
        id: `LEAD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        ...finalLead // Save the Merged Data
      });
      fs.writeFileSync(filePath, JSON.stringify(leads, null, 2));
    }

    // 5. MURF TTS
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
          voiceId: "en-US-matthew",
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

      const arrayBuffer = await murfRes.arrayBuffer();
      const base64Audio = Buffer.from(arrayBuffer).toString("base64");

      return NextResponse.json({
        reply: aiResponse.speech,
        lead: aiResponse.lead,
        isComplete: aiResponse.isComplete,
        audio: `data:audio/mp3;base64,${base64Audio}`,
      });
    } catch (error) {
      return NextResponse.json({ reply: aiResponse.speech, lead: aiResponse.lead, error: "TTS Failed" });
    }

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}