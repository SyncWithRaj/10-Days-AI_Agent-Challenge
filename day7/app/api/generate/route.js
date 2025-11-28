import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req) {
  try {
    const body = await req.json();
    const { text, currentCart } = body;
    
    console.log("🔥 FOOD API HIT");
    console.log("🗣️ User:", text);

    // --------------------------------------------------------
    // 0. HANDLE INIT SESSION (The Greeting)
    // --------------------------------------------------------
    if (text === "INIT_SESSION") {
        const greeting = "Welcome to GourmetGo! What are you craving?";
        console.log("🤖 Sending Greeting:", greeting);

        // Generate Audio for Greeting
        try {
            const murfRes = await fetch(process.env.MURF_TTS_URL, {
              method: "POST",
              headers: { "api-key": process.env.MURF_API_KEY, "Content-Type": "application/json" },
              body: JSON.stringify({
                voiceId: "en-US-matthew",
                text: greeting,
                multiNativeLocale: "en-US",
                model: "FALCON",
                format: "MP3",
                sampleRate: 24000,
                channelType: "MONO",
              }),
            });
    
            if (!murfRes.ok) throw new Error("Murf Failed");
            const arrayBuffer = await murfRes.arrayBuffer();
            const base64Audio = Buffer.from(arrayBuffer).toString("base64");
    
            return NextResponse.json({
              reply: `Chef Neo: ${greeting}`,
              cart: [],
              isComplete: false,
              audio: `data:audio/mp3;base64,${base64Audio}`,
            });
        } catch (e) {
            return NextResponse.json({ reply: `Chef Neo: ${greeting}`, cart: [], error: "TTS Failed" });
        }
    }

    // --------------------------------------------------------
    // 1. LOAD CATALOG
    // --------------------------------------------------------
    const catalogPath = path.join(process.cwd(), "food_catalog.json");
    let catalog = [];
    try {
        catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
    } catch (e) { console.error("Catalog Load Error", e); }

    // --------------------------------------------------------
    // 2. SYSTEM PROMPT (Chef Neo)
    // --------------------------------------------------------
    const systemPrompt = `
    You are 'Chef Neo', an intelligent ordering assistant for "GourmetGo" India.
    
    CATALOG DATA: ${JSON.stringify(catalog)}
    CURRENT CART: ${JSON.stringify(currentCart)}
    USER INPUT: "${text}"

    GOAL: Manage the user's shopping cart.

    LOGIC RULES:
    1. **ADD ITEMS:** If user asks for an item, add it to the cart. 
    2. **REMOVE ITEMS:** If user says "Remove [Item]" or "Delete [Item]", YOU MUST return a new cart array WITHOUT that item.
    3. **DECREASE QTY:** If user says "Remove one pizza" (and they have 2), reduce qty to 1.
    4. **SMART INGREDIENTS:** If user says "I want to make a sandwich", add relevant items (Bread, Butter, Cheese) from catalog automatically.
    5. **FINISH:** If user says "Checkout", "That's all", or "Place order", set isComplete = true.

    RESPONSE GUIDELINES:
    - Currency is **Indian Rupees (₹)**. Say "Rupees".
    - Be brief and appetizing.
    - Always confirm what was added OR removed.

    JSON OUTPUT FORMAT:
    {
      "speech": "Your response...",
      "cart": [ 
        { "id": "string", "name": "string", "price": number, "qty": number } 
      ],
      "isComplete": boolean
    }
    `;

    // 3. CALL GEMINI
        const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`;


    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] }),
    });

    const geminiRaw = await geminiRes.text();
    let rawText = JSON.parse(geminiRaw).candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
    
    let aiResponse;
    try {
        aiResponse = JSON.parse(rawText);
    } catch (e) {
        console.error("JSON Fail", rawText);
        aiResponse = { speech: "Recipe unclear. Could you repeat that?", cart: currentCart, isComplete: false };
    }

    // 4. SAVE ORDER
    if (aiResponse.isComplete) {
        const orderPath = path.join(process.cwd(), "active_order.json");
        const orderData = {
            orderId: `ORD-${Date.now()}`,
            timestamp: new Date().toISOString(),
            items: aiResponse.cart,
            total: aiResponse.cart.reduce((sum, item) => sum + (item.price * item.qty), 0).toFixed(2),
            status: "RECEIVED"
        };
        fs.writeFileSync(orderPath, JSON.stringify(orderData, null, 2));
        console.log("💾 Order Placed!");
    }

    // 5. MURF TTS
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); 

    try {
        const murfRes = await fetch(process.env.MURF_TTS_URL, {
          method: "POST",
          headers: { "api-key": process.env.MURF_API_KEY, "Content-Type": "application/json" },
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
        if (!murfRes.ok) throw new Error("Murf Failed");
        const arrayBuffer = await murfRes.arrayBuffer();
        const base64Audio = Buffer.from(arrayBuffer).toString("base64");

        return NextResponse.json({
          reply: aiResponse.speech,
          cart: aiResponse.cart,
          isComplete: aiResponse.isComplete,
          audio: `data:audio/mp3;base64,${base64Audio}`,
        });
    } catch (error) {
        return NextResponse.json({ reply: aiResponse.speech, cart: aiResponse.cart, error: "TTS Failed" });
    }
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}