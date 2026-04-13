import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { colors } from "../styles";

export const OutroScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Features list
  const features = [
    { icon: "📊", text: "Full Audit Trail" },
    { icon: "📈", text: "Real-Time Reports" },
    { icon: "🔒", text: "Enterprise Security" },
    { icon: "⚡", text: "MTN MoMo Integration" },
  ];

  // Logo reveal
  const logoScale = spring({ frame: frame - 60, fps, config: { damping: 12 } });
  const logoOpacity = interpolate(frame, [60, 80], [0, 1], { extrapolateRight: "clamp" });

  // Tagline
  const tagOpacity = interpolate(frame, [100, 120], [0, 1], { extrapolateRight: "clamp" });

  // Glow pulse
  const pulse = Math.sin(frame * 0.08) * 0.3 + 0.7;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {/* Central glow */}
      <div
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${colors.primary}20, transparent 60%)`,
          opacity: pulse,
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
        {/* Features grid */}
        <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
          {features.map((f, i) => {
            const fDelay = 10 + i * 12;
            const fScale = spring({ frame: frame - fDelay, fps, config: { damping: 12 } });
            const fOpacity = interpolate(frame, [fDelay, fDelay + 15], [0, 1], { extrapolateRight: "clamp" });
            return (
              <div
                key={i}
                style={{
                  background: `${colors.white}08`,
                  border: `1px solid ${colors.white}12`,
                  borderRadius: 14,
                  padding: "20px 28px",
                  textAlign: "center",
                  opacity: fOpacity,
                  transform: `scale(${fScale})`,
                }}
              >
                <span style={{ fontSize: 32 }}>{f.icon}</span>
                <p style={{ fontFamily: "'Inter'", fontSize: 14, color: colors.grayLight, margin: "8px 0 0", fontWeight: 500 }}>
                  {f.text}
                </p>
              </div>
            );
          })}
        </div>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, opacity: logoOpacity, transform: `scale(${logoScale})` }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: colors.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 50px ${colors.accent}40`,
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={colors.dark} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <span style={{ fontFamily: "'Space Grotesk'", fontSize: 56, fontWeight: 700, color: colors.white }}>
            Expo<span style={{ color: colors.accent }}>Pay</span>
          </span>
        </div>

        {/* Tagline */}
        <p
          style={{
            fontFamily: "'Inter'",
            fontSize: 24,
            color: colors.grayLight,
            opacity: tagOpacity,
            fontWeight: 400,
          }}
        >
          Enterprise disbursements made simple.
        </p>
      </div>
    </AbsoluteFill>
  );
};
