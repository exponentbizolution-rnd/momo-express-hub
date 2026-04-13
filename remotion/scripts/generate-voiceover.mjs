// Script to generate voiceover audio segments via ElevenLabs TTS edge function,
// then merge them into a single audio track with proper timing.
import fs from "fs";
import path from "path";

const SUPABASE_URL = "https://zmjobyudzvkgibakfghr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inptam9ieXVkenZrZ2liYWtmZ2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwOTI0MDIsImV4cCI6MjA4NzY2ODQwMn0.2ZfxzGC2UbkiwO7dG1NS_skFDutCFGKevWhr6QsEoEE";
const VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // George - professional male voice
const FPS = 30;

// Narration segments with timing (from MainVideo.tsx captions)
const segments = [
  { start: 0, end: 90, text: "Welcome to ExpoPay — Bulk Mobile Money Payments, Simplified." },
  { start: 90, end: 200, text: "Process thousands of MTN MoMo disbursements with enterprise-grade security." },
  { start: 200, end: 270, text: "Let's walk through the key workflows." },
  { start: 270, end: 370, text: "Start by signing in with your email and password." },
  { start: 370, end: 480, text: "Built-in lockout protection keeps accounts safe after 5 failed attempts." },
  { start: 480, end: 600, text: "Forgot your password? Reset it via email in seconds." },
  { start: 640, end: 750, text: "Upload your recipients CSV file — up to 10,000 records at once." },
  { start: 750, end: 870, text: "Phone numbers are validated instantly. Errors are flagged for correction." },
  { start: 870, end: 1020, text: "Review totals, verify amounts, and submit the batch." },
  { start: 1060, end: 1180, text: "Dual authorization: a different user must approve the batch." },
  { start: 1180, end: 1300, text: "Review all details — amounts, recipients, and totals." },
  { start: 1300, end: 1400, text: "One click to approve and initiate MTN MoMo disbursements." },
  { start: 1440, end: 1600, text: "Track every action in the audit log. Full compliance, full transparency." },
  { start: 1600, end: 1800, text: "ExpoPay — Enterprise disbursements made simple." },
];

const outDir = "/tmp/voiceover";
fs.mkdirSync(outDir, { recursive: true });

async function generateSegment(index, segment) {
  const outFile = path.join(outDir, `segment_${String(index).padStart(2, "0")}.mp3`);
  if (fs.existsSync(outFile)) {
    console.log(`  [${index}] Already exists, skipping.`);
    return outFile;
  }

  console.log(`  [${index}] Generating: "${segment.text.substring(0, 50)}..."`);

  const res = await fetch(`${SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ text: segment.text, voiceId: VOICE_ID }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`TTS failed for segment ${index}: ${res.status} ${errText}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outFile, buffer);
  console.log(`  [${index}] Saved (${buffer.length} bytes)`);
  return outFile;
}

async function main() {
  const totalDuration = 1800 / FPS; // 60 seconds

  console.log("=== Generating voiceover segments ===");
  for (let i = 0; i < segments.length; i++) {
    await generateSegment(i, segments[i]);
    // Small delay to avoid rate limiting
    if (i < segments.length - 1) await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\n=== Building FFmpeg filter for timed audio ===");

  // Build ffmpeg command to place each segment at the right time
  const inputs = [];
  const filterParts = [];

  for (let i = 0; i < segments.length; i++) {
    const file = path.join(outDir, `segment_${String(i).padStart(2, "0")}.mp3`);
    const startSec = (segments[i].start / FPS).toFixed(3);
    inputs.push(`-i "${file}"`);
    filterParts.push(`[${i}]adelay=${Math.round(segments[i].start / FPS * 1000)}|${Math.round(segments[i].start / FPS * 1000)}[d${i}]`);
  }

  const mixInputs = segments.map((_, i) => `[d${i}]`).join("");
  const filter = filterParts.join(";") + `;${mixInputs}amix=inputs=${segments.length}:duration=longest:dropout_transition=0[out]`;

  const ffmpegCmd = `ffmpeg -y ${inputs.join(" ")} -filter_complex "${filter}" -map "[out]" -t ${totalDuration} -ar 44100 -ac 2 /tmp/voiceover/narration.mp3`;

  console.log("Running FFmpeg mix...");
  const { execSync } = await import("child_process");
  execSync(ffmpegCmd, { stdio: "inherit", maxBuffer: 50 * 1024 * 1024 });

  console.log("\n=== Narration track ready at /tmp/voiceover/narration.mp3 ===");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
