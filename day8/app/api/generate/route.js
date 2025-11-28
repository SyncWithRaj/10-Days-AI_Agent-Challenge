import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const { text, gameState } = body;
    
    console.log("🔥 STRANGER THINGS API HIT");
    console.log("🗣️ Action:", text);

    // --------------------------------------------------------
    // 0. START SEQUENCE (The Upside Down Intro)
    // --------------------------------------------------------
    if (text === "START_ADVENTURE") {
        const introText = "November 6, 1983. You are riding your bike home past the Hawkins National Laboratory. The lights on your bike flicker and die. A cold wind chills you to the bone, and the world suddenly turns dark and gray. You are in the Upside Down. What do you do?";
        
        try {
            const murfRes = await fetch(process.env.MURF_TTS_URL, {
              method: "POST",
              headers: { "api-key": process.env.MURF_API_KEY, "Content-Type": "application/json" },
              body: JSON.stringify({
                voiceId: "en-US-ken", // Deep Narrator
                text: introText,
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
              reply: introText,
              updatedState: {
                  player: { name: "Will", hp: 100, max_hp: 100, sanity: 100, inventory: ["Flashlight", "Walkie Talkie"] },
                  location: { name: "The Upside Down", description: "A dark mirror of Hawkins." },
                  game_log: [introText]
              },
              event: "NONE",
              audio: `data:audio/mp3;base64,${base64Audio}`,
            });
        } catch (e) {
            return NextResponse.json({ reply: introText, updatedState: gameState, error: "TTS Failed" });
        }
    }

    // --------------------------------------------------------
    // 1. GAME MASTER PROMPT
    // --------------------------------------------------------
    
    const systemPrompt = `
    You are the Dungeon Master for a "Stranger Things" inspired horror RPG set in 1980s Hawkins.
    
    CURRENT STATE:
    ${JSON.stringify(gameState)}

    PLAYER ACTION: "${text}"

    YOUR ROLE:
    1. Narrate the story in a suspenseful, 80s horror tone.
    2. **ROLL DICE:** Decide success/fail.
    3. **UPDATE STATE:** - Attacks by Demogorgons/Soldiers -> Lower 'hp'.
       - Scary events -> Lower 'sanity'.
       - Finding items -> Add to 'inventory' (e.g., Baseball Bat, Radio).
    4. **EVENTS:**
       - "DAMAGE" (Red Flash) for injury.
       - "HEAL" (Green Flash) for eating food/medkits.
       - "LOOT" (Gold Flash) for finding items.
       - "PSYCHIC" (Purple Flash) for Eleven using powers or mind flayer attacks.

    OUTPUT FORMAT (JSON ONLY):
    {
      "speech": "Narrative...",
      "updatedState": { ...full state... },
      "event": "DAMAGE" | "HEAL" | "LOOT" | "PSYCHIC" | "NONE"
    }
    `;

    // --------------------------------------------------------
    // 2. GEMINI CALL
    // --------------------------------------------------------
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
        aiResponse = { speech: "Static on the radio... say again?", updatedState: gameState, event: "NONE" };
    }

    // --------------------------------------------------------
    // 3. MURF TTS
    // --------------------------------------------------------
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); 

    try {
        const murfRes = await fetch(process.env.MURF_TTS_URL, {
          method: "POST",
          headers: { "api-key": process.env.MURF_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            voiceId: "en-US-ken",
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
          updatedState: aiResponse.updatedState,
          event: aiResponse.event,
          audio: `data:audio/mp3;base64,${base64Audio}`,
        });
    } catch (error) {
        return NextResponse.json({ reply: aiResponse.speech, updatedState: gameState, error: "TTS Failed" });
    }
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}