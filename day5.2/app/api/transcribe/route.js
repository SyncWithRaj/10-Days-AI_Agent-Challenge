import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    console.log("🔥 API HIT: /api/transcribe");

    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ⏳ Setup a 60-second timeout to prevent crashes on slow networks
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); 

    // -----------------------------------------
    // 1. UPLOAD AUDIO TO ASSEMBLYAI
    // -----------------------------------------
    console.log("🟡 Uploading to AssemblyAI...");
    
    const uploadRes = await fetch(process.env.ASSEMBLYAI_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: process.env.ASSEMBLYAI_API_KEY,
        "Content-Type": "application/octet-stream",
      },
      body: buffer,
      signal: controller.signal, // Attach timeout
    });

    if (!uploadRes.ok) throw new Error(`Upload Failed: ${uploadRes.statusText}`);

    const uploadJson = await uploadRes.json();
    const audioUrl = uploadJson.upload_url;

    // -----------------------------------------
    // 2. START TRANSCRIPTION JOB
    // -----------------------------------------
    const transcriptRes = await fetch(process.env.ASSEMBLYAI_TRANSCRIPT_URL, {
      method: "POST",
      headers: {
        Authorization: process.env.ASSEMBLYAI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ audio_url: audioUrl }),
      signal: controller.signal,
    });

    if (!transcriptRes.ok) throw new Error("Transcript Start Failed");
    const transcriptJson = await transcriptRes.json();
    const transcriptId = transcriptJson.id;

    // -----------------------------------------
    // 3. POLL FOR COMPLETION
    // -----------------------------------------
    console.log(`🟡 Polling ID: ${transcriptId}`);
    let transcriptionText = "";

    while (true) {
      await new Promise((r) => setTimeout(r, 1000)); // Wait 1s

      const pollRes = await fetch(
        `${process.env.ASSEMBLYAI_TRANSCRIPT_URL}/${transcriptId}`,
        { 
            headers: { Authorization: process.env.ASSEMBLYAI_API_KEY },
            signal: controller.signal 
        }
      );

      const pollJson = await pollRes.json();

      if (pollJson.status === "completed") {
        transcriptionText = pollJson.text;
        break;
      } else if (pollJson.status === "error") {
        throw new Error(`Transcription Failed: ${pollJson.error}`);
      }
    }

    clearTimeout(timeoutId); // Clear timeout on success
    console.log("🟢 Transcript:", transcriptionText);

    return NextResponse.json({ transcript: transcriptionText });

  } catch (err) {
    console.error("❌ Transcribe Error:", err.message);
    // Return a fallback error message so the UI doesn't freeze
    return NextResponse.json({ 
        transcript: "", 
        error: "Connection timed out. Please try speaking again." 
    });
  }
}