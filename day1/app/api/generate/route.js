import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        const body = await req.json();
        const { text } = body;
        console.log("🔥 API HIT: /api/generate", text);

        // 1. Gemini (LLM)
        const systemPrompt = `
    You are Nexus, a friendly, polite, and warm AI companion. 
    You are speaking to your friend, Smarty.
    Speak casually like a real friend. 
    Keep your answers concise and conversational (1-2 sentences max).
    
    User (Smarty) said: "${text}"
    `;

        // Note: Ensure your API Key supports the model version you are using
        const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`;

        const geminiRes = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }],
            }),
        });

        const geminiRaw = await geminiRes.text();
        let geminiJson;
        try {
            geminiJson = JSON.parse(geminiRaw);
        } catch (e) {
            throw new Error("Failed to parse Gemini response");
        }

        const reply = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't think of a reply.";

        // 2. Murf (TTS)
        const murfRes = await fetch(process.env.MURF_TTS_URL, {
            method: "POST",
            headers: {
                "api-key": process.env.MURF_API_KEY,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                voiceId: "en-US-matthew",
                text: reply,
                multiNativeLocale: "en-US",
                model: "FALCON",
                format: "MP3",
                sampleRate: 24000,
                channelType: "MONO",
            }),
        });

        if (!murfRes.ok) throw new Error("Murf TTS Failed");

        // Stream to Buffer to Base64
        const arrayBuffer = await murfRes.arrayBuffer();
        const base64Audio = Buffer.from(arrayBuffer).toString("base64");

        return NextResponse.json({
            reply: reply,
            audio: `data:audio/mp3;base64,${base64Audio}`,
        });

    } catch (err) {
        console.error("Generate Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}