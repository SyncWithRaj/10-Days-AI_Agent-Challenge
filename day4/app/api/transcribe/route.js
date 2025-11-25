import { NextResponse } from "next/server";

// Optional: Increase execution time limit if hosted on Vercel (Free tier is 10s, Pro is longer)
export const maxDuration = 60; 

export async function POST(req) {
  try {
    console.log("🔥 API HIT: /api/transcribe");
    
    // In App Router, we can read the buffer directly without disabling bodyParser
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Upload to AssemblyAI
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

    // 2. Start Transcription
    const transcriptRes = await fetch(process.env.ASSEMBLYAI_TRANSCRIPT_URL, {
      method: "POST",
      headers: {
        Authorization: process.env.ASSEMBLYAI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ audio_url: audioUrl }),
    });
    const transcriptJson = await transcriptRes.json();

    // 3. Poll for Completion
    let transcription = "";
    while (true) {
      // Poll every 500ms for speed
      await new Promise((r) => setTimeout(r, 500));

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

    return NextResponse.json({ transcript: transcription });

  } catch (err) {
    console.error("Transcribe Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ❌ REMOVED the deprecated 'config' object. 
// It is not needed in Next.js App Router.