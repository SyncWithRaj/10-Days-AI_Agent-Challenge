import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req) {
  try {
    const body = await req.json();
    const { text, currentOrder } = body;
    
    console.log("🔥 API HIT: /api/generate");
    console.log("🗣️ User said:", text);

    // --------------------------------------------------------
    // 1. GEMINI (LLM) - Barista Logic
    // --------------------------------------------------------
    
    const systemPrompt = `
    You are Nexus, a cyber-barista at "Neon Brews". 
    You speak to "Smarty" (the user) in a cool, cyberpunk slang style.
    
    Your GOAL is to fill this Order State:
    {
      "drinkType": "string (e.g. Latte, Espresso)",
      "size": "string (Small, Medium, Large)",
      "milk": "string (Whole, Oat, Almond, None)",
      "extras": ["string (e.g. Sugar, Syrup)"],
      "name": "string (Customer Name)"
    }

    Current State: ${JSON.stringify(currentOrder)}
    User Input: "${text}"

    INSTRUCTIONS:
    1. Analyze the User Input and update the Current State.
    2. If fields are missing, ask for them one by one. Priority: Drink -> Size -> Milk -> Name.
    3. If the user just says "Hello", greet them and ask what they want to drink.
    4. If all fields are filled, confirm the order and say "Order Complete".
    
    IMPORTANT: You must return ONLY a valid JSON object. Do not add any extra text or markdown.
    
    JSON FORMAT:
    {
      "speech": "Your verbal response here...",
      "order": { ...updated state... },
      "isComplete": boolean
    }
    `;

    // ✅ FIXED URL: Using v1beta and gemini-1.5-flash
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`;

    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }]
      }),
    });

    const geminiRaw = await geminiRes.text();
    
    // Parse the API Response wrapper
    let geminiData;
    try {
        geminiData = JSON.parse(geminiRaw);
    } catch (e) {
        throw new Error("Gemini API returned invalid JSON structure.");
    }

    // Check if we actually got a candidate
    if (!geminiData.candidates || geminiData.candidates.length === 0) {
        console.error("❌ Gemini Error Debug:", JSON.stringify(geminiData, null, 2));
        if (geminiData.promptFeedback) {
             throw new Error("Gemini blocked the prompt due to safety settings.");
        }
        throw new Error("Gemini returned no candidates.");
    }

    // Extract the text content
    let rawText = geminiData.candidates[0].content.parts[0].text;
    
    // 🧹 CLEANUP: Remove markdown code blocks if present
    rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

    console.log("🤖 Raw AI Text:", rawText);

    let aiResponse;
    try {
        aiResponse = JSON.parse(rawText);
    } catch (e) {
        console.error("❌ Failed to parse internal AI JSON. Raw text was:", rawText);
        // Emergency Fallback
        aiResponse = { 
            speech: "System glitch. Say that again, Smarty?", 
            order: currentOrder, 
            isComplete: false 
        };
    }

    // --------------------------------------------------------
    // 2. SAVE TO FILE (If Complete)
    // --------------------------------------------------------
    if (aiResponse.isComplete) {
        const filePath = path.join(process.cwd(), "orders.json");
        const newOrder = { ...aiResponse.order, timestamp: new Date().toISOString() };
        
        let orders = [];
        try {
            if (fs.existsSync(filePath)) {
                const fileData = fs.readFileSync(filePath, "utf8");
                orders = JSON.parse(fileData);
            }
        } catch (e) { console.log("New order file created"); }

        orders.push(newOrder);
        fs.writeFileSync(filePath, JSON.stringify(orders, null, 2));
        console.log("💾 Order Saved to orders.json");
    }

    // --------------------------------------------------------
    // 3. MURF (TTS)
    // --------------------------------------------------------
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

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
          order: aiResponse.order, 
          isComplete: aiResponse.isComplete,
          audio: `data:audio/mp3;base64,${base64Audio}`,
        });

    } catch (error) {
        console.error("❌ TTS Error:", error.message);
        return NextResponse.json({
            reply: aiResponse.speech,
            order: aiResponse.order,
            error: "Audio failed, text only."
        });
    }

  } catch (err) {
    console.error("Server Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}