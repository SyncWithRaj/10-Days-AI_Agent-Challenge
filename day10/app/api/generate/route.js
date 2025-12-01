import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Helper to load scenarios
const getScenarios = () => {
  try {
    const filePath = path.join(process.cwd(), "scenarios.json");
    const fileData = fs.readFileSync(filePath, "utf8");
    return JSON.parse(fileData);
  } catch (e) {
    console.error("Error loading scenarios:", e);
    return [];
  }
};

export async function POST(req) {
  try {
    const body = await req.json();
    const { text, gameState } = body;
    const scenarios = getScenarios();

    console.log("🔥 API HIT | Phase:", gameState?.phase || 'Start');

    let { round, phase, userName, currentScenario, history } = gameState || { 
        round: 0, 
        phase: 'start', 
        userName: '', 
        currentScenario: '',
        history: []
    };
    
    if (!history) history = [];

    const maxRounds = 3;
    let isGameOver = false;
    let promptContext = "";
    
    // Default values for response
    let nextScenarioText = "";
    let nextScenarioScreen = "";

    // ------------------------------------------------------------
    // LOGIC FLOW
    // ------------------------------------------------------------

    // 1. START: ASK NAME
    if (phase === 'start' || !phase) {
        promptContext = `
        PHASE: INTRO_ASK_NAME
        ACTION: 
        1. Speak in Hinglish: "Namaste Dosto! Murfs Got Latent mein swagat hai! Main hoon aapka Host Samay Raina."
        2. Subtitle (Hindi): "नमस्ते दोस्तों! Murf's Got Latent में स्वागत है! मैं हूँ आपका होस्ट समय रैना।"
        3. Ask Name: "Shuru karne se pehle, apna naam batayein."
        4. Subtitle Ask: "शुरू करने से पहले, अपना नाम बताएं।"
        5. Screen Text: "TELL ME YOUR NAME"
        `;
        phase = 'waiting_for_name';
        round = 0;
    } 
    
    // 2. NAME RECEIVED -> START ROUND 1
    else if (phase === 'waiting_for_name') {
        userName = text.length < 20 ? text : "Dost"; 
        
        // Load Fixed Scenario 1
        const scen = scenarios[0]; 
        nextScenarioText = scen.prompt_hindi; // For subtitle
        nextScenarioScreen = scen.screen_text; // For TV

        promptContext = `
        PHASE: GREET_AND_START
        USER_NAME: "${userName}"
        SCENARIO_TO_GIVE: "${scen.prompt_hinglish}"
        
        ACTION:
        1. Say: "Shukriya ${userName}! Chaliye shuru karte hain!"
        2. Give the SCENARIO instructions clearly in Hinglish.
        3. Subtitle should be in Hindi.
        `;
        phase = 'playing';
        round = 1;
        currentScenario = scen.role;
    }

    // 3. GAMEPLAY
    else if (phase === 'playing') {
        // Save history
        history.push({ round: round, scenario: currentScenario, user_performance: text });

        if (round < maxRounds) {
            // --- NEXT ROUND (2 or 3) ---
            const nextScenIndex = round; // round 1 done -> index 1 (Scenario 2)
            const scen = scenarios[nextScenIndex];
            nextScenarioText = scen.prompt_hindi;
            nextScenarioScreen = scen.screen_text;
            currentScenario = scen.role;

            promptContext = `
            PHASE: MID_GAME
            CURRENT ROUND: ${round} of ${maxRounds}
            USER_NAME: "${userName}"
            USER_PERFORMANCE: "${text}"
            NEXT_SCENARIO: "${scen.prompt_hinglish}"
            
            ACTION:
            1. React to performance (Roast/Praise) in Hinglish/Hindi.
            2. Introduce the NEXT SCENARIO: "${scen.prompt_hinglish}".
            `;
            round++;
        } else {
            // --- END GAME SUMMARY ---
            const historyString = JSON.stringify(history);
            
            promptContext = `
            PHASE: END_GAME_SUMMARY
            USER_NAME: "${userName}"
            GAME_HISTORY: ${historyString}
            LAST_PERFORMANCE: "${text}"
            
            ACTION:
            1. React to final performance.
            2. Give a short, funny summary of ${userName}'s acting style.
            3. Mention one specific funny moment.
            4. Say "Goodbye" / "Alvida".
            `;
            isGameOver = true;
            nextScenarioScreen = "SHOW ENDED";
        }
    }

    const systemPrompt = `
    You are the host of "MURF'S GOT LATENT".
    
    INSTRUCTIONS:
    1. **speech**: Hinglish (Roman Hindi) for Audio.
    2. **subtitle**: Pure Hindi (Devanagari) for Text.
    3. **scenarioText**: "${nextScenarioScreen}" (Use this exact text if provided, otherwise '...').

    ${promptContext}

    OUTPUT FORMAT (JSON ONLY):
    {
      "speech": "Hinglish text...",
      "subtitle": "Hindi text...",
      "scenarioText": "TV Screen text...",
      "isGameOver": boolean
    }
    `;

    // ------------------------------------------------------------
    // GEMINI CALL
    // ------------------------------------------------------------
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
      console.error("Gemini Error", e);
      aiResponse = { speech: "Technical error.", subtitle: "तकनीकी खराबी।", scenarioText: "ERROR", isGameOver: true };
    }

    // ------------------------------------------------------------
    // SAVE TO JSON (IF GAME OVER)
    // ------------------------------------------------------------
    if (aiResponse.isGameOver) {
        try {
            const filePath = path.join(process.cwd(), "game_history.json");
            let existingData = [];
            if (fs.existsSync(filePath)) existingData = JSON.parse(fs.readFileSync(filePath, "utf8"));
            
            existingData.push({
                id: Date.now(),
                timestamp: new Date().toISOString(),
                user: userName,
                game_data: history,
                host_summary: aiResponse.speech
            });
            
            fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));
        } catch (e) { console.error("Save Error", e); }
    }

    // ------------------------------------------------------------
    // MURF TTS
    // ------------------------------------------------------------
    let base64Audio = null;
    try {
      const murfRes = await fetch(process.env.MURF_TTS_URL, {
        method: "POST",
        headers: { "api-key": process.env.MURF_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceId: "hi-IN-karan",
          text: aiResponse.speech,
          multiNativeLocale: "hi-IN",
          model: "FALCON",
          format: "MP3",
          sampleRate: 24000,
          channelType: "MONO",
        }),
      });
      if (murfRes.ok) {
        const arrayBuffer = await murfRes.arrayBuffer();
        base64Audio = Buffer.from(arrayBuffer).toString("base64");
      }
    } catch (error) { console.error(error); }

    return NextResponse.json({
      reply: aiResponse.speech,
      subtitle: aiResponse.subtitle,
      scenario: aiResponse.scenarioText || nextScenarioScreen, // Fallback to hardcoded screen text
      gameState: {
          round: round,
          phase: phase,
          userName: userName,
          currentScenario: currentScenario,
          history: history,
          isGameOver: aiResponse.isGameOver || isGameOver
      },
      audio: base64Audio ? `data:audio/mp3;base64,${base64Audio}` : null,
    });

  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}