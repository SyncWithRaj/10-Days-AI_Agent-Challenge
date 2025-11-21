import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        console.log("🔥 API HIT: /api/voice");

        // -----------------------------------------
        // Read raw audio buffer
        // -----------------------------------------
        const arrayBuffer = await req.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // -----------------------------------------
        // ASSEMBLYAI → Upload audio
        // -----------------------------------------
        console.log("🟡 Uploading audio to AssemblyAI…");

        const uploadRes = await fetch(process.env.ASSEMBLYAI_UPLOAD_URL, {
            method: "POST",
            headers: {
                Authorization: process.env.ASSEMBLYAI_API_KEY,
                "Content-Type": "application/octet-stream",
            },
            body: buffer,
        });

        const uploadJson = await uploadRes.json();
        const audioUrl = uploadJson.upload_url || uploadJson.url;

        console.log("🟢 AssemblyAI Upload URL:", audioUrl);

        // -----------------------------------------
        // ASSEMBLYAI → Create transcript job
        // -----------------------------------------
        const transcriptRes = await fetch(process.env.ASSEMBLYAI_TRANSCRIPT_URL, {
            method: "POST",
            headers: {
                Authorization: process.env.ASSEMBLYAI_API_KEY,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ audio_url: audioUrl }),
        });

        const transcriptJson = await transcriptRes.json();
        console.log("🟡 Transcript ID:", transcriptJson.id);

        // -----------------------------------------
        // Poll transcript status
        // -----------------------------------------
        let transcription = "";

        while (true) {
            await new Promise((r) => setTimeout(r, 1500));

            const poll = await fetch(
                `${process.env.ASSEMBLYAI_TRANSCRIPT_URL}/${transcriptJson.id}`,
                { headers: { Authorization: process.env.ASSEMBLYAI_API_KEY } }
            );

            const pollJson = await poll.json();

            if (pollJson.status === "completed") {
                transcription = pollJson.text;
                break;
            }

            if (pollJson.status === "failed") throw new Error("STT Failed");
        }

        console.log("🟢 Transcript:", transcription);

        // -----------------------------------------
        // GEMINI → FINAL FIX (v1 endpoint)
        // -----------------------------------------
        console.log("🟡 Sending to Gemini:", transcription);

        const systemPrompt = `
    You are a friendly, polite, and warm AI companion. 
    You speak casually like a real friend. 
    Keep your answers concise and conversational (1-2 sentences max).
    
    User said: "${transcription}"
    `;

        const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`;

        const geminiRes = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: transcription }] }],
            }),
        });

        const geminiRaw = await geminiRes.text();
        console.log("🔵 Gemini Raw:", geminiRaw);

        let geminiJson;
        try {
            geminiJson = JSON.parse(geminiRaw);
        } catch {
            console.log("❌ Gemini JSON ERROR");
            geminiJson = null;
        }

        const reply =
            geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text ||
            "I could not generate a reply.";

        console.log("🟢 Gemini Reply:", reply);

        // -----------------------------------------
        // MURF FALCON TTS → STREAM
        // -----------------------------------------
        console.log("🟡 Sending to Murf Falcon TTS…");

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

        if (!murfRes.ok) {
            const t = await murfRes.text();
            console.log("❌ Murf Error:", t);
            throw new Error("Murf Falcon failed");
        }

        // STREAM → BUFFER
        const reader = murfRes.body.getReader();
        const chunks = [];
        let total = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            total += value.length;
        }

        console.log("🔵 Murf Audio Bytes:", total);

        const audioBuffer = new Uint8Array(total);
        let offset = 0;
        for (let chunk of chunks) {
            audioBuffer.set(chunk, offset);
            offset += chunk.length;
        }

        const base64Audio = Buffer.from(audioBuffer).toString("base64");

        // FINAL RESPONSE
        return NextResponse.json({
            transcript: transcription,
            reply: reply,
            audio: `data:audio/mp3;base64,${base64Audio}`,
        });

    } catch (err) {
        console.log("❌ SERVER ERROR:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// app/api/voice/route.js

export const config = {
    api: {
        bodyParser: false, // Disables the default body parser to allow streams
    },
};

// For Next.js 13+ App Router, sometimes you specifically need this:
export const maxDuration = 60; // Allow the function to run for 60 seconds