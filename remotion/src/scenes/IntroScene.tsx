import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Sequence } from "remotion";
import { colors } from "../styles";

export const IntroScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo icon spring
  const iconScale = spring({ frame, fps, config: { damping: 12, stiffness: 150 } });
  const iconRotate = interpolate(spring({ frame, fps, config: { damping: 20 } }), [0, 1], [-90, 0]);

  // Title reveal
  const titleX = interpolate(spring({ frame: frame - 15, fps, config: { damping: 20 } }), [0, 1], [80, 0]);
  const titleOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" });

  // Tagline
  const tagOpacity = interpolate(frame, [40, 60], [0, 1], { extrapolateRight: "clamp" });
  const tagY = interpolate(spring({ frame: frame - 40, fps, config: { damping: 20 } }), [0, 1], [30, 0]);

  // Stats bar
  const statsOpacity = interpolate(frame, [80, 100], [0, 1], { extrapolateRight: "clamp" });

  const stats = [
    { label: "Transactions/mo", value: "500K+" },
    { label: "Success Rate", value: "99.2%" },
    { label: "Avg. Speed", value: "<3s" },
  ];

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {/* Radial glow behind logo */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${colors.primary}25, transparent 70%)`,
          transform: `scale(${iconScale})`,
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 16,
              background: colors.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${iconScale}) rotate(${iconRotate}deg)`,
              boxShadow: `0 0 40px ${colors.accent}40`,
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={colors.dark} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div style={{ transform: `translateX(${titleX}px)`, opacity: titleOpacity }}>
            <span
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 72,
                fontWeight: 700,
                color: colors.white,
              }}
            >
              Expo<span style={{ color: colors.accent }}>Pay</span>
            </span>
          </div>
        </div>

        {/* Tagline */}
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 28,
            color: colors.grayLight,
            opacity: tagOpacity,
            transform: `translateY(${tagY}px)`,
            fontWeight: 400,
          }}
        >
          Bulk Mobile Money Payments, Simplified.
        </p>

        {/* Stats */}
        <div style={{ display: "flex", gap: 30, opacity: statsOpacity, marginTop: 20 }}>
          {stats.map((s, i) => {
            const delay = 90 + i * 10;
            const sScale = spring({ frame: frame - delay, fps, config: { damping: 15 } });
            return (
              <div
                key={s.label}
                style={{
                  background: `${colors.white}08`,
                  border: `1px solid ${colors.white}15`,
                  borderRadius: 12,
                  padding: "20px 36px",
                  textAlign: "center",
                  transform: `scale(${sScale})`,
                }}
              >
                <p style={{ fontFamily: "'Space Grotesk'", fontSize: 36, fontWeight: 700, color: colors.accent, margin: 0 }}>
                  {s.value}
                </p>
                <p style={{ fontFamily: "'Inter'", fontSize: 14, color: colors.gray, margin: "6px 0 0" }}>
                  {s.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
