import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req) {
  try {
    const body = await req.json();
    const { text, currentCase } = body;
    
    console.log("🔥 BANK API HIT");
    console.log("🗣️ User:", text);

    // 1. LOAD FRAUD DATABASE
    const dbPath = path.join(process.cwd(), "fraud_cases.json");
    const convPath = path.join(process.cwd(), "conversation.json");

    let allCases = [];
    let activeCase = null;

    try {
        if (fs.existsSync(dbPath)) {
            const fileData = fs.readFileSync(dbPath, "utf8");
            allCases = JSON.parse(fileData);
            
            // ✅ DYNAMIC SELECTION: Find the first case that needs review
            activeCase = allCases.find(c => c.status === "PENDING_REVIEW");
            
            // Fallback: If all are resolved, just pick the first one to demo "completed" state
            if (!activeCase) activeCase = allCases[0];
        }
    } catch (e) { console.error("DB Error", e); }

    // Safety Fallback (Mock Data if file fails)
    if (!activeCase) {
        activeCase = {
            userName: "John",
            securityIdentifier: "STB-8821-X",
            cardEnding: "4242",
            status: "PENDING_REVIEW",
            transaction: {
                merchant: "Apple Store NYC",
                amount: "$1,299.00",
                location: "New York, USA"
            },
            securityQuestion: "What is the name of your first pet?",
            securityAnswer: "Max",
            notes: "" 
        };
    }

    // 2. FRAUD AGENT PROMPT
    const systemPrompt = `
    You are 'Agent Carter', a Senior Fraud Prevention Specialist at Sentinel Trust Bank.
    You are speaking to customer: ${activeCase.userName}.
    
    CURRENT CASE DATA:
    ${JSON.stringify(activeCase)}
    
    CURRENT CALL STEP: "${currentCase.step}"
    USER INPUT: "${text}"

    STRICT SECURITY PROTOCOL (State Machine):
    
    1. **IF STEP IS 'GREETING'**:
       - IF USER SAYS "Yes", "This is ${activeCase.userName}": 
         - SAY: "Thank you. For security, please answer your security question: ${activeCase.securityQuestion}" 
         - SET NEXT STEP: "VERIFYING"
       - IF USER SAYS "No": 
         - SAY: "Is ${activeCase.userName} available? This is an urgent matter regarding card ending in ${activeCase.cardEnding}."
         - SET NEXT STEP: "GREETING"
       - DEFAULT (Start of call): 
         - SAY: "This is Agent Carter from Sentinel Trust Bank. I'm calling about a suspicious transaction on card ${activeCase.cardEnding}. Is this ${activeCase.userName}?" 
         - SET NEXT STEP: "GREETING"

    2. **IF STEP IS 'VERIFYING'**:
       - CHECK ANSWER: "${activeCase.securityAnswer}".
       - IF MATCH (Fuzzy match ok): 
         - SAY: "Identity verified. We flagged a transaction at ${activeCase.transaction.merchant} for ${activeCase.transaction.amount} in ${activeCase.transaction.location}. Did you authorize this?" 
         - SET NEXT STEP: "DECISION"
       - IF WRONG: 
         - SAY: "That is incorrect. I must terminate this call. Please visit a branch." 
         - STATUS: "VERIFICATION_FAILED", SHOULD_HANGUP: true, SUMMARY: "Security verification failed."

    3. **IF STEP IS 'DECISION'**:
       - IF USER CONFIRMS (It was them): 
         - SAY: "Thank you. I have marked this transaction as SAFE. The hold is lifted." 
         - STATUS: "CONFIRMED_SAFE", SHOULD_HANGUP: true, SUMMARY: "Customer confirmed transaction."
       - IF USER DENIES (Fraud): 
         - SAY: "Understood. Marked as FRAUDULENT. Card blocked. New card shipped in 24h." 
         - STATUS: "CONFIRMED_FRAUD", SHOULD_HANGUP: true, SUMMARY: "Customer denied transaction. Card blocked."

    JSON OUTPUT FORMAT:
    {
      "speech": "Your response...",
      "step": "GREETING" | "VERIFYING" | "DECISION" | "COMPLETED",
      "caseStatus": "PENDING_REVIEW" | "CONFIRMED_SAFE" | "CONFIRMED_FRAUD" | "VERIFICATION_FAILED",
      "summary": "Short outcome string (Required if status changed, else null)",
      "shouldHangUp": boolean
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
    let geminiData = JSON.parse(geminiRaw);
    let rawText = geminiData.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
    
    let aiResponse;
    try {
        aiResponse = JSON.parse(rawText);
    } catch (e) {
        aiResponse = { speech: "Could you repeat that?", step: currentCase.step, caseStatus: activeCase.status, shouldHangUp: false };
    }

    // ------------------------------------------------------------
    // 4. UPDATE DATABASES
    // ------------------------------------------------------------

    // A. Update Case Status & Summary in fraud_cases.json
    if (aiResponse.caseStatus && aiResponse.caseStatus !== "PENDING_REVIEW") {
        activeCase.status = aiResponse.caseStatus;
        if (aiResponse.summary) activeCase.notes = aiResponse.summary;
        
        // Find the specific user we were working on and update them
        const index = allCases.findIndex(c => c.userName === activeCase.userName);
        if (index !== -1) allCases[index] = activeCase;
        
        fs.writeFileSync(dbPath, JSON.stringify(allCases, null, 2));
        console.log(`💾 Case [${activeCase.userName}] Updated: ${aiResponse.caseStatus}`);
    }

    // B. Log Conversation in conversation.json
    let conversationLog = [];
    try {
        if (fs.existsSync(convPath)) {
            conversationLog = JSON.parse(fs.readFileSync(convPath, "utf8"));
        }
    } catch (e) {}

    conversationLog.push({
        caseId: activeCase.securityIdentifier,
        role: "user",
        message: text,
        timestamp: new Date().toISOString()
    });

    conversationLog.push({
        caseId: activeCase.securityIdentifier,
        role: "agent",
        message: aiResponse.speech,
        timestamp: new Date().toISOString()
    });

    fs.writeFileSync(convPath, JSON.stringify(conversationLog, null, 2));

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
          updatedState: { step: aiResponse.step, status: aiResponse.caseStatus },
          shouldHangUp: aiResponse.shouldHangUp,
          audio: `data:audio/mp3;base64,${base64Audio}`,
        });

    } catch (error) {
        return NextResponse.json({ reply: aiResponse.speech, updatedState: currentCase, error: "TTS Failed" });
    }

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}