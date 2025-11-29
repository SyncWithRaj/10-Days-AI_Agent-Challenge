import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const { text, gameState } = body;

    console.log("🔥 RPG API HIT");
    console.log("🗣️ Action:", text);

    // --------------------------------------------------------
    // 0. START SEQUENCE (Hardcoded for consistency)
    // --------------------------------------------------------
    if (text === "START_ADVENTURE") {
      const introText = "You awaken in the Whispering Crypt. The air is cold and smells of dust. A dark corridor lies ahead. What do you do?";

      try {
        const murfRes = await fetch(process.env.MURF_TTS_URL, {
          method: "POST",
          headers: { "api-key": process.env.MURF_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            voiceId: "en-US-ken",
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
            player: { name: "Traveler", hp: 100, max_hp: 100, gold: 10, inventory: ["Rusty Sword", "Potion"] },
            location: { name: "Whispering Crypt", description: "A cold, stone chamber." },
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
    You are the Dungeon Master for a Dark Fantasy RPG.
    
    CURRENT STATE:
    ${JSON.stringify(gameState)}

    PLAYER ACTION: "${text}"

    YOUR ROLE:
    1. Update the game state based on the action (HP, Inventory, Gold).
    2. **NARRATE:** Keep it SHORT (Max 2 sentences). Be vivid but concise.
    3. **EVENTS:**
       - Player takes damage -> "DAMAGE" (Red Flash).
       - Player heals -> "HEAL" (Green Flash).
       - Player finds gold/items -> "LOOT" (Gold Flash).
       - Player uses magic -> "MAGIC" (Purple Flash).

    OUTPUT FORMAT (JSON ONLY):
    {
      "speech": "Short narrative (Max 2 sentences)...",
      "updatedState": { ...full state... },
      "event": "DAMAGE" | "HEAL" | "LOOT" | "MAGIC" | "NONE"
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

    let aiResponse;
    try {
      let rawText = JSON.parse(geminiRaw).candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
      aiResponse = JSON.parse(rawText);
    } catch (e) {
      aiResponse = { speech: "The shadows block my vision. Say again?", updatedState: gameState, event: "NONE" };
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