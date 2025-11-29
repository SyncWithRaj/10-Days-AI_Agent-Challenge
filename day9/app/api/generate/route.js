import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req) {
  try {
    const body = await req.json();
    const { text, cart } = body;

    console.log("🔥 STYLE API HIT");
    console.log("🗣️ User:", text);

    // 1. LOAD CATALOG
    const catalogPath = path.join(process.cwd(), "products.json");
    let catalog = [];
    try {
      catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
    } catch (e) { console.error("Catalog Error", e); }

    // 2. AI PROMPT
    const systemPrompt = `
    You are "StyleSync", a luxury fashion voice assistant.
    
    CATALOG: ${JSON.stringify(catalog)}
    CURRENT CART: ${JSON.stringify(cart)}
    USER INPUT: "${text}"

    YOUR ROLE:
    1. **SEARCH:** If user asks to browse, return matching items in 'matches'.
    2. **CART:** Add/Remove items. 
       - IMPORTANT: When adding, just provide the 'id' and 'qty'.
    3. **CHECKOUT:** If user says "Checkout" or "Place Order", set 'isOrderPlaced' to true.
    4. **SPEAK:** - Be trendy and polite.
       - **CRITICAL:** If items were added/removed, you MUST calculate the new total mentally (Price * Qty) and say: "Your total is now ₹[Amount]."
       - Keep it under 2 sentences.

    OUTPUT FORMAT (JSON ONLY):
    {
      "speech": "Your response including the total...",
      "cart": [ { "id": "string", "qty": number } ], 
      "matches": [ ...list of matching product objects... ],
      "isOrderPlaced": boolean
    }
    `;

    // 3. GEMINI CALL
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`;

    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] }),
    });

    const geminiRaw = await geminiRes.text();
    let aiResponse;
    try {
      let rawText = JSON.parse(geminiRaw).candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
      aiResponse = JSON.parse(rawText);
    } catch (e) {
      aiResponse = { speech: "I didn't catch that. Could you repeat?", cart: cart, matches: [], isOrderPlaced: false };
    }

    // ------------------------------------------------------------
    // HYDRATE CART WITH REAL PRICES
    // ------------------------------------------------------------
    let finalCart = [];
    let orderTotal = 0;

    if (aiResponse.cart && Array.isArray(aiResponse.cart)) {
      finalCart = aiResponse.cart.map(cartItem => {
        const product = catalog.find(p => p.id === cartItem.id);
        if (product) {
          const qty = cartItem.qty || 1;
          orderTotal += product.price * qty;
          return { ...product, qty: qty };
        }
        return null;
      }).filter(item => item !== null);
    }

    // 4. SAVE ORDER
    if (aiResponse.isOrderPlaced) {
      const ordersPath = path.join(process.cwd(), "orders.json");
      let orders = [];
      try {
        if (fs.existsSync(ordersPath)) orders = JSON.parse(fs.readFileSync(ordersPath, "utf8"));
      } catch (e) { }

      const newOrder = {
        id: `ORD-${Date.now()}`,
        items: finalCart,
        total: orderTotal,
        currency: "INR",
        status: "CONFIRMED",
        created_at: new Date().toISOString()
      };

      orders.push(newOrder);
      fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
      console.log("💾 Order Saved:", newOrder.id);
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
        cart: finalCart,
        matches: aiResponse.matches,
        isOrderPlaced: aiResponse.isOrderPlaced,
        audio: `data:audio/mp3;base64,${base64Audio}`,
      });
    } catch (error) {
      return NextResponse.json({ reply: aiResponse.speech, cart: finalCart, matches: [], error: "TTS Failed" });
    }
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}