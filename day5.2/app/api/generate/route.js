import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req) {
  try {
    const body = await req.json();
    const { text, currentLead } = body;
    
    console.log("🔥 boAt API HIT");

    // 1. LOAD BOAT DATA
    const contentPath = path.join(process.cwd(), "boat_data.json");
    let companyData = "";
    try {
        companyData = fs.readFileSync(contentPath, "utf8");
    } catch (e) { console.error("Knowledge Load Error", e); }

    // 2. SDR SYSTEM PROMPT
    const systemPrompt = `
    You are Aman, a Corporate Sales Representative for boAt Lifestyle.
    
    YOUR GOAL: 
    1. Answer questions about boAt products (Airdopes, Rockerz, Watches) using the KNOWLEDGE BASE.
    2. Qualify the lead for a Corporate/Bulk Order.
    
    KNOWLEDGE BASE:
    ${companyData}

    CURRENT LEAD STATE: ${JSON.stringify(currentLead)}
    USER INPUT: "${text}"

    *** DATA MERGING RULES ***
    1. Merge new info with CURRENT LEAD STATE. Do not delete existing data.
    2. "quantity" refers to number of units they want to buy (previously team_size).
    3. "requirement" is what products they want (previously use_case).

    PROTOCOL:
    - Tone: Energetic, "boAthead" vibe, Gen-Z friendly but professional.
    - Use Indian context (Rupees, GST invoice, Diwali gifts etc) where appropriate.
    - **Order of Extraction:**
      1. Requirement (Gifting, Office use, Events?)
      2. Company Name?
      3. Your Role?
      4. Quantity (How many units?)
      5. Timeline (When do you need them?)
      6. Name?
    
    OUTPUT FORMAT (JSON ONLY):
    {
      "speech": "Your conversational response...",
      "lead": { 
          "name": "string", 
          "role": "string", 
          "company": "string", 
          "quantity": "string", 
          "requirement": "string", 
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
        aiResponse = { speech: "Can you say that again, boAthead?", lead: currentLead, isComplete: false };
    }

    // 3. SAFE MERGE
    const finalLead = { ...currentLead }; 
    if (aiResponse.lead) {
        Object.keys(aiResponse.lead).forEach(key => {
            const newValue = aiResponse.lead[key];
            if (newValue && newValue.trim() !== "" && newValue !== "unknown") {
                finalLead[key] = newValue;
            }
        });
    }
    aiResponse.lead = finalLead;

    // 4. SAVE LEAD
    if (aiResponse.isComplete) {
        const filePath = path.join(process.cwd(), "leads.json");
        let leads = [];
        try {
            if (fs.existsSync(filePath)) leads = JSON.parse(fs.readFileSync(filePath, "utf8"));
        } catch (e) {}

        leads.push({ id: `BOAT-${Date.now()}`, timestamp: new Date().toISOString(), ...finalLead });
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