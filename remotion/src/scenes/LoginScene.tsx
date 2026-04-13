import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Sequence } from "remotion";
import { colors } from "../styles";

export const LoginScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Section title
  const titleScale = spring({ frame, fps, config: { damping: 15 } });
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  // Login card
  const cardY = interpolate(spring({ frame: frame - 20, fps, config: { damping: 18 } }), [0, 1], [60, 0]);
  const cardOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" });

  // Typing animation for email
  const email = "john@company.com";
  const emailChars = Math.min(email.length, Math.max(0, Math.floor((frame - 80) / 3)));
  const typedEmail = email.slice(0, emailChars);

  // Password dots appear
  const passDots = Math.min(8, Math.max(0, Math.floor((frame - 140) / 4)));

  // Button press
  const btnPress = frame >= 200 && frame <= 210;
  const btnScale = btnPress ? 0.96 : 1;

  // Success indicator
  const successOpacity = interpolate(frame, [220, 240], [0, 1], { extrapolateRight: "clamp" });
  const successScale = spring({ frame: frame - 220, fps, config: { damping: 10 } });

  // Lockout warning appears
  const lockoutOpacity = interpolate(frame, [280, 300], [0, 1], { extrapolateRight: "clamp" });
  const lockoutY = interpolate(spring({ frame: frame - 280, fps, config: { damping: 15 } }), [0, 1], [20, 0]);

  // Forgot password dialog
  const forgotOpacity = interpolate(frame, [340, 360], [0, 1], { extrapolateRight: "clamp" });
  const forgotScale = spring({ frame: frame - 340, fps, config: { damping: 15 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {/* Section label */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 100,
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 4, height: 32, background: colors.primary, borderRadius: 2 }} />
          <span style={{ fontFamily: "'Space Grotesk'", fontSize: 24, color: colors.grayLight, fontWeight: 600 }}>
            STEP 1
          </span>
        </div>
        <h2 style={{ fontFamily: "'Space Grotesk'", fontSize: 48, color: colors.white, fontWeight: 700, marginTop: 8 }}>
          Secure Login
        </h2>
      </div>

      {/* Login card mock */}
      <div
        style={{
          width: 420,
          background: `${colors.surface}ee`,
          border: `1px solid ${colors.white}15`,
          borderRadius: 16,
          padding: 40,
          opacity: cardOpacity,
          transform: `translateY(${cardY}px)`,
          boxShadow: `0 25px 60px ${colors.dark}80`,
        }}
      >
        <h3 style={{ fontFamily: "'Space Grotesk'", fontSize: 24, color: colors.white, fontWeight: 700, margin: "0 0 6px" }}>
          Welcome back
        </h3>
        <p style={{ fontFamily: "'Inter'", fontSize: 14, color: colors.gray, margin: "0 0 24px" }}>
          Sign in to your ExpoPay account
        </p>

        {/* Email field */}
        <label style={{ fontFamily: "'Inter'", fontSize: 13, color: colors.grayLight, fontWeight: 500 }}>Email Address</label>
        <div
          style={{
            marginTop: 6,
            marginBottom: 16,
            background: `${colors.white}08`,
            border: `1px solid ${frame >= 80 ? colors.primary : colors.white + "20"}`,
            borderRadius: 8,
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            transition: "none",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.gray} strokeWidth="2">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
          <span style={{ fontFamily: "'Inter'", fontSize: 14, color: typedEmail ? colors.white : colors.gray }}>
            {typedEmail || "you@company.com"}
            {frame >= 80 && emailChars < email.length && (
              <span style={{ opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0, color: colors.primary }}>|</span>
            )}
          </span>
        </div>

        {/* Password field */}
        <label style={{ fontFamily: "'Inter'", fontSize: 13, color: colors.grayLight, fontWeight: 500 }}>Password</label>
        <div
          style={{
            marginTop: 6,
            marginBottom: 20,
            background: `${colors.white}08`,
            border: `1px solid ${frame >= 140 ? colors.primary : colors.white + "20"}`,
            borderRadius: 8,
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.gray} strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span style={{ fontFamily: "'Inter'", fontSize: 14, color: colors.white, letterSpacing: 4 }}>
            {"●".repeat(passDots)}
          </span>
        </div>

        {/* Sign in button */}
        <div
          style={{
            background: frame >= 220 ? colors.green : colors.primary,
            borderRadius: 8,
            padding: "12px 0",
            textAlign: "center",
            transform: `scale(${btnScale})`,
            boxShadow: frame >= 200 ? `0 0 20px ${colors.primary}40` : "none",
          }}
        >
          <span style={{ fontFamily: "'Inter'", fontSize: 14, fontWeight: 600, color: colors.white }}>
            {frame >= 220 ? "✓ Signed In" : frame >= 200 ? "Signing in..." : "Sign In"}
          </span>
        </div>
      </div>

      {/* Success checkmark */}
      {frame >= 220 && (
        <div
          style={{
            position: "absolute",
            right: 200,
            top: "50%",
            transform: `translateY(-50%) scale(${successScale})`,
            opacity: successOpacity,
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: colors.green,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 40px ${colors.green}50`,
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={colors.white} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>
      )}

      {/* Lockout warning callout */}
      {frame >= 280 && (
        <div
          style={{
            position: "absolute",
            left: 100,
            bottom: 200,
            opacity: lockoutOpacity,
            transform: `translateY(${lockoutY}px)`,
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: `${colors.orange}15`,
            border: `1px solid ${colors.orange}40`,
            borderRadius: 12,
            padding: "16px 24px",
            maxWidth: 380,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.orange} strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <p style={{ fontFamily: "'Inter'", fontSize: 14, fontWeight: 600, color: colors.orange, margin: 0 }}>
              Brute Force Protection
            </p>
            <p style={{ fontFamily: "'Inter'", fontSize: 12, color: colors.grayLight, margin: "4px 0 0" }}>
              Account locks after 5 failed attempts for 15 minutes
            </p>
          </div>
        </div>
      )}

      {/* Forgot password dialog overlay */}
      {frame >= 340 && (
        <div
          style={{
            position: "absolute",
            right: 100,
            bottom: 200,
            opacity: forgotOpacity,
            transform: `scale(${forgotScale})`,
            background: `${colors.surface}f5`,
            border: `1px solid ${colors.white}15`,
            borderRadius: 16,
            padding: "28px 32px",
            width: 360,
            boxShadow: `0 20px 50px ${colors.dark}90`,
          }}
        >
          <h4 style={{ fontFamily: "'Space Grotesk'", fontSize: 18, color: colors.white, fontWeight: 700, margin: "0 0 6px" }}>
            Reset your password
          </h4>
          <p style={{ fontFamily: "'Inter'", fontSize: 13, color: colors.gray, margin: "0 0 16px" }}>
            Enter your email for a reset link.
          </p>
          <div style={{ background: `${colors.white}08`, border: `1px solid ${colors.white}20`, borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
            <span style={{ fontFamily: "'Inter'", fontSize: 13, color: colors.gray }}>you@company.com</span>
          </div>
          <div style={{ background: colors.primary, borderRadius: 8, padding: "10px 0", textAlign: "center" }}>
            <span style={{ fontFamily: "'Inter'", fontSize: 13, fontWeight: 600, color: colors.white }}>Send Reset Link</span>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
