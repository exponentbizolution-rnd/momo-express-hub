import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { colors } from "../styles";

export const ApprovalScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleScale = spring({ frame, fps, config: { damping: 15 } });

  // Batch card
  const cardOpacity = interpolate(frame, [30, 50], [0, 1], { extrapolateRight: "clamp" });
  const cardY = interpolate(spring({ frame: frame - 30, fps, config: { damping: 18 } }), [0, 1], [50, 0]);

  // Dual auth badge
  const badgeOpacity = interpolate(frame, [80, 100], [0, 1], { extrapolateRight: "clamp" });

  // Approve button highlight
  const approveFrame = 220;
  const btnPressed = frame >= approveFrame && frame <= approveFrame + 10;
  const btnScale = btnPressed ? 0.95 : 1;

  // Processing animation
  const processing = frame >= 250;
  const processProgress = interpolate(frame, [250, 360], [0, 100], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  // Done
  const doneOpacity = interpolate(frame, [370, 390], [0, 1], { extrapolateRight: "clamp" });
  const doneScale = spring({ frame: frame - 370, fps, config: { damping: 8 } });

  return (
    <AbsoluteFill style={{ padding: "80px 100px" }}>
      {/* Section label */}
      <div style={{ opacity: titleOpacity, transform: `scale(${titleScale})` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 4, height: 32, background: colors.primary, borderRadius: 2 }} />
          <span style={{ fontFamily: "'Space Grotesk'", fontSize: 24, color: colors.grayLight, fontWeight: 600 }}>STEP 3</span>
        </div>
        <h2 style={{ fontFamily: "'Space Grotesk'", fontSize: 48, color: colors.white, fontWeight: 700, marginTop: 8 }}>
          Dual Authorization & Approval
        </h2>
      </div>

      <div style={{ display: "flex", gap: 50, marginTop: 40, alignItems: "flex-start" }}>
        {/* Left: Batch detail card */}
        <div
          style={{
            flex: 1,
            opacity: cardOpacity,
            transform: `translateY(${cardY}px)`,
            background: `${colors.surface}ee`,
            border: `1px solid ${colors.white}15`,
            borderRadius: 16,
            padding: 32,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <h3 style={{ fontFamily: "'Space Grotesk'", fontSize: 22, color: colors.white, fontWeight: 700, margin: 0 }}>
                Batch #EPX-2026-0412
              </h3>
              <p style={{ fontFamily: "'Inter'", fontSize: 13, color: colors.gray, margin: "4px 0 0" }}>
                Submitted by John Mwale • 2 minutes ago
              </p>
            </div>
            <span
              style={{
                fontFamily: "'Inter'",
                fontSize: 12,
                fontWeight: 600,
                color: frame < 250 ? colors.orange : frame >= 370 ? colors.green : colors.primary,
                background: frame < 250 ? `${colors.orange}15` : frame >= 370 ? `${colors.green}15` : `${colors.primary}15`,
                padding: "6px 14px",
                borderRadius: 20,
              }}
            >
              {frame < 250 ? "Pending Approval" : frame >= 370 ? "✓ Completed" : "Processing..."}
            </span>
          </div>

          {/* Details grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
            {[
              { label: "Recipients", value: "1,244" },
              { label: "Total Amount", value: "K2,450,000" },
              { label: "Error Records", value: "3" },
            ].map((item, i) => (
              <div key={i} style={{ background: `${colors.white}05`, borderRadius: 10, padding: 16 }}>
                <p style={{ fontFamily: "'Inter'", fontSize: 12, color: colors.gray, margin: 0 }}>{item.label}</p>
                <p style={{ fontFamily: "'Space Grotesk'", fontSize: 22, fontWeight: 700, color: colors.white, margin: "6px 0 0" }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          {!processing && (
            <div style={{ display: "flex", gap: 12 }}>
              <div
                style={{
                  flex: 1,
                  background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryLight})`,
                  borderRadius: 8,
                  padding: "14px 0",
                  textAlign: "center",
                  transform: `scale(${btnScale})`,
                  boxShadow: frame >= approveFrame ? `0 0 30px ${colors.primary}50` : "none",
                }}
              >
                <span style={{ fontFamily: "'Inter'", fontSize: 14, fontWeight: 600, color: colors.white }}>
                  ✓ Approve & Process
                </span>
              </div>
              <div
                style={{
                  width: 140,
                  background: `${colors.red}15`,
                  border: `1px solid ${colors.red}30`,
                  borderRadius: 8,
                  padding: "14px 0",
                  textAlign: "center",
                }}
              >
                <span style={{ fontFamily: "'Inter'", fontSize: 14, fontWeight: 600, color: colors.red }}>Reject</span>
              </div>
            </div>
          )}

          {/* Processing progress */}
          {processing && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontFamily: "'Inter'", fontSize: 14, color: colors.grayLight }}>
                  Processing disbursements via MTN MoMo...
                </span>
                <span style={{ fontFamily: "'Inter'", fontSize: 14, color: colors.primary, fontWeight: 600 }}>
                  {Math.round(processProgress)}%
                </span>
              </div>
              <div style={{ height: 8, background: `${colors.white}10`, borderRadius: 4 }}>
                <div
                  style={{
                    height: "100%",
                    width: `${processProgress}%`,
                    background: `linear-gradient(90deg, ${colors.primary}, ${colors.accent})`,
                    borderRadius: 4,
                  }}
                />
              </div>
              <p style={{ fontFamily: "'Inter'", fontSize: 12, color: colors.gray, marginTop: 8 }}>
                {Math.round(processProgress * 12.44)} of 1,244 transactions sent
              </p>
            </div>
          )}
        </div>

        {/* Right: Dual auth explanation */}
        <div style={{ width: 340, opacity: badgeOpacity }}>
          <div
            style={{
              background: `${colors.primary}10`,
              border: `1px solid ${colors.primary}30`,
              borderRadius: 16,
              padding: 28,
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span style={{ fontFamily: "'Space Grotesk'", fontSize: 16, fontWeight: 700, color: colors.primary }}>
                Dual Authorization
              </span>
            </div>
            <p style={{ fontFamily: "'Inter'", fontSize: 13, color: colors.grayLight, lineHeight: 1.6, margin: 0 }}>
              A different user must approve batches. The initiator cannot approve their own submission.
            </p>
          </div>

          {/* User avatars */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { name: "John Mwale", role: "Initiator", color: colors.accent },
              { name: "Grace Lungu", role: "Approver", color: colors.primary },
            ].map((user, i) => {
              const userDelay = 120 + i * 20;
              const userOpacity = interpolate(frame, [userDelay, userDelay + 15], [0, 1], { extrapolateRight: "clamp" });
              const userX = interpolate(spring({ frame: frame - userDelay, fps, config: { damping: 18 } }), [0, 1], [30, 0]);
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: `${colors.white}05`,
                    borderRadius: 10,
                    padding: "12px 16px",
                    opacity: userOpacity,
                    transform: `translateX(${userX}px)`,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: `${user.color}30`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span style={{ fontFamily: "'Inter'", fontSize: 14, fontWeight: 700, color: user.color }}>
                      {user.name[0]}
                    </span>
                  </div>
                  <div>
                    <p style={{ fontFamily: "'Inter'", fontSize: 14, fontWeight: 600, color: colors.white, margin: 0 }}>{user.name}</p>
                    <p style={{ fontFamily: "'Inter'", fontSize: 11, color: colors.gray, margin: 0 }}>{user.role}</p>
                  </div>
                  {i === 1 && frame >= approveFrame && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.green} strokeWidth="3" style={{ marginLeft: "auto" }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Big success overlay */}
      {frame >= 370 && (
        <div
          style={{
            position: "absolute",
            right: 100,
            bottom: 100,
            opacity: doneOpacity,
            transform: `scale(${doneScale})`,
            display: "flex",
            alignItems: "center",
            gap: 16,
            background: `${colors.green}15`,
            border: `1px solid ${colors.green}30`,
            borderRadius: 16,
            padding: "20px 30px",
          }}
        >
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: colors.green, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.white} strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p style={{ fontFamily: "'Space Grotesk'", fontSize: 18, fontWeight: 700, color: colors.green, margin: 0 }}>
              All Disbursements Sent!
            </p>
            <p style={{ fontFamily: "'Inter'", fontSize: 13, color: colors.grayLight, margin: "2px 0 0" }}>
              1,244 transactions processed successfully
            </p>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
