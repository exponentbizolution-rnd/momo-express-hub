import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { slide } from "@remotion/transitions/slide";
import { IntroScene } from "./scenes/IntroScene";
import { LoginScene } from "./scenes/LoginScene";
import { UploadScene } from "./scenes/UploadScene";
import { ApprovalScene } from "./scenes/ApprovalScene";
import { OutroScene } from "./scenes/OutroScene";
import { colors } from "./styles";
import { loadFont as loadSpaceGrotesk } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

loadSpaceGrotesk();
loadInter();

const transition = springTiming({ config: { damping: 200 }, durationInFrames: 20 });

export const MainVideo = () => {
  const frame = useCurrentFrame();

  // Subtle animated background gradient
  const gradAngle = interpolate(frame, [0, 1800], [135, 180]);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.dark }}>
      {/* Persistent animated gradient */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(${gradAngle}deg, ${colors.dark} 0%, ${colors.surface} 50%, ${colors.darkAlt} 100%)`,
        }}
      />

      {/* Floating accent orbs */}
      <FloatingOrb x={200} y={300} size={400} color={colors.primary} delay={0} frame={frame} />
      <FloatingOrb x={1500} y={600} size={300} color={colors.accent} delay={50} frame={frame} />
      <FloatingOrb x={900} y={800} size={250} color={colors.primaryLight} delay={100} frame={frame} />

      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={270}>
          <IntroScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={transition} />
        <TransitionSeries.Sequence durationInFrames={420}>
          <LoginScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={transition} />
        <TransitionSeries.Sequence durationInFrames={480}>
          <UploadScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={transition} />
        <TransitionSeries.Sequence durationInFrames={420}>
          <ApprovalScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={transition} />
        <TransitionSeries.Sequence durationInFrames={270}>
          <OutroScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {/* Narration caption bar */}
      <CaptionBar frame={frame} />
    </AbsoluteFill>
  );
};

const FloatingOrb = ({ x, y, size, color, delay, frame }: any) => {
  const drift = Math.sin((frame + delay) * 0.015) * 30;
  const driftY = Math.cos((frame + delay) * 0.012) * 20;
  return (
    <div
      style={{
        position: "absolute",
        left: x + drift,
        top: y + driftY,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color}15, transparent 70%)`,
        filter: "blur(40px)",
      }}
    />
  );
};

// Timed narration captions
const captions: { start: number; end: number; text: string }[] = [
  { start: 0, end: 90, text: "Welcome to ExpoPay — Bulk Mobile Money Payments, Simplified." },
  { start: 90, end: 200, text: "Process thousands of MTN MoMo disbursements with enterprise-grade security." },
  { start: 200, end: 270, text: "Let's walk through the key workflows." },
  // Login
  { start: 270, end: 370, text: "Start by signing in with your email and password." },
  { start: 370, end: 480, text: "Built-in lockout protection keeps accounts safe after 5 failed attempts." },
  { start: 480, end: 600, text: "Forgot your password? Reset it via email in seconds." },
  // Upload
  { start: 640, end: 750, text: "Upload your recipients CSV file — up to 10,000 records at once." },
  { start: 750, end: 870, text: "Phone numbers are validated instantly. Errors are flagged for correction." },
  { start: 870, end: 1020, text: "Review totals, verify amounts, and submit the batch." },
  // Approval
  { start: 1060, end: 1180, text: "Dual authorization: a different user must approve the batch." },
  { start: 1180, end: 1300, text: "Review all details — amounts, recipients, and totals." },
  { start: 1300, end: 1400, text: "One click to approve and initiate MTN MoMo disbursements." },
  // Outro
  { start: 1440, end: 1600, text: "Track every action in the audit log. Full compliance, full transparency." },
  { start: 1600, end: 1800, text: "ExpoPay — Enterprise disbursements made simple." },
];

const CaptionBar = ({ frame }: { frame: number }) => {
  const active = captions.find((c) => frame >= c.start && frame < c.end);
  if (!active) return null;

  const progress = (frame - active.start) / (active.end - active.start);
  const fadeIn = interpolate(frame, [active.start, active.start + 15], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [active.end - 15, active.end], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        left: "50%",
        transform: "translateX(-50%)",
        opacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "none",
          borderRadius: 12,
          padding: "16px 40px",
          maxWidth: 1200,
        }}
      >
        <p
          style={{
            color: "#FFFFFF",
            fontSize: 32,
            fontFamily: "Inter, sans-serif",
            fontWeight: 500,
            textAlign: "center",
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {active.text}
        </p>
      </div>
      {/* Progress indicator */}
      <div style={{ width: 200, height: 3, background: "rgba(255,255,255,0.2)", borderRadius: 2 }}>
        <div style={{ width: `${progress * 100}%`, height: "100%", background: colors.primary, borderRadius: 2 }} />
      </div>
    </div>
  );
};
