import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { colors } from "../styles";

export const UploadScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleScale = spring({ frame, fps, config: { damping: 15 } });

  // Upload area
  const uploadOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" });
  const uploadY = interpolate(spring({ frame: frame - 20, fps, config: { damping: 18 } }), [0, 1], [40, 0]);

  // File drops in
  const fileDropped = frame >= 80;
  const fileScale = spring({ frame: frame - 80, fps, config: { damping: 10, stiffness: 200 } });

  // Validation progress
  const validating = frame >= 120;
  const validProgress = interpolate(frame, [120, 220], [0, 100], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  // Results table
  const tableOpacity = interpolate(frame, [240, 260], [0, 1], { extrapolateRight: "clamp" });

  // Summary card
  const summaryOpacity = interpolate(frame, [320, 340], [0, 1], { extrapolateRight: "clamp" });
  const summaryScale = spring({ frame: frame - 320, fps, config: { damping: 15 } });

  // Submit button
  const submitGlow = frame >= 400;

  const rows = [
    { name: "Alice Banda", phone: "0977123456", amount: "K500.00", status: "valid" },
    { name: "Bob Mulenga", phone: "0966789012", amount: "K1,200.00", status: "valid" },
    { name: "Carol Tembo", phone: "09551234", amount: "K300.00", status: "error" },
    { name: "David Phiri", phone: "0955678901", amount: "K750.00", status: "valid" },
  ];

  return (
    <AbsoluteFill style={{ padding: "80px 100px" }}>
      {/* Section label */}
      <div style={{ opacity: titleOpacity, transform: `scale(${titleScale})` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 4, height: 32, background: colors.accent, borderRadius: 2 }} />
          <span style={{ fontFamily: "'Space Grotesk'", fontSize: 24, color: colors.grayLight, fontWeight: 600 }}>STEP 2</span>
        </div>
        <h2 style={{ fontFamily: "'Space Grotesk'", fontSize: 48, color: colors.white, fontWeight: 700, marginTop: 8 }}>
          Upload Recipients CSV
        </h2>
      </div>

      <div style={{ display: "flex", gap: 40, marginTop: 40, flex: 1 }}>
        {/* Left: Upload + validation */}
        <div style={{ flex: 1 }}>
          {/* Drop zone */}
          <div
            style={{
              opacity: uploadOpacity,
              transform: `translateY(${uploadY}px)`,
              border: `2px dashed ${fileDropped ? colors.green : colors.primary}60`,
              borderRadius: 16,
              padding: fileDropped ? "20px 30px" : "50px 30px",
              textAlign: "center",
              background: `${fileDropped ? colors.green : colors.primary}08`,
            }}
          >
            {!fileDropped ? (
              <>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="1.5" style={{ margin: "0 auto 16px" }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p style={{ fontFamily: "'Inter'", fontSize: 16, color: colors.grayLight, margin: 0 }}>
                  Drag & drop your CSV file here
                </p>
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 14, transform: `scale(${fileScale})` }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: `${colors.green}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.green} strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div style={{ textAlign: "left" }}>
                  <p style={{ fontFamily: "'Inter'", fontSize: 15, fontWeight: 600, color: colors.white, margin: 0 }}>
                    disbursements_april.csv
                  </p>
                  <p style={{ fontFamily: "'Inter'", fontSize: 12, color: colors.gray, margin: "2px 0 0" }}>
                    1,247 records • 2.4 MB
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Validation progress */}
          {validating && (
            <div style={{ marginTop: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontFamily: "'Inter'", fontSize: 13, color: colors.grayLight }}>Validating records...</span>
                <span style={{ fontFamily: "'Inter'", fontSize: 13, color: colors.primary, fontWeight: 600 }}>{Math.round(validProgress)}%</span>
              </div>
              <div style={{ height: 6, background: `${colors.white}10`, borderRadius: 3 }}>
                <div
                  style={{
                    height: "100%",
                    width: `${validProgress}%`,
                    background: `linear-gradient(90deg, ${colors.primary}, ${colors.primaryLight})`,
                    borderRadius: 3,
                  }}
                />
              </div>
            </div>
          )}

          {/* Results table */}
          {frame >= 240 && (
            <div style={{ marginTop: 24, opacity: tableOpacity }}>
              <div style={{ background: `${colors.white}05`, border: `1px solid ${colors.white}10`, borderRadius: 12, overflow: "hidden" }}>
                {/* Header */}
                <div style={{ display: "flex", padding: "10px 16px", background: `${colors.white}05`, borderBottom: `1px solid ${colors.white}10` }}>
                  {["Recipient", "Phone", "Amount", "Status"].map((h) => (
                    <div key={h} style={{ flex: 1 }}>
                      <span style={{ fontFamily: "'Inter'", fontSize: 11, color: colors.gray, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>{h}</span>
                    </div>
                  ))}
                </div>
                {rows.map((row, i) => {
                  const rowDelay = 250 + i * 8;
                  const rowOpacity = interpolate(frame, [rowDelay, rowDelay + 10], [0, 1], { extrapolateRight: "clamp" });
                  return (
                    <div key={i} style={{ display: "flex", padding: "10px 16px", borderBottom: `1px solid ${colors.white}06`, opacity: rowOpacity }}>
                      <div style={{ flex: 1 }}><span style={{ fontFamily: "'Inter'", fontSize: 13, color: colors.white }}>{row.name}</span></div>
                      <div style={{ flex: 1 }}><span style={{ fontFamily: "'Inter'", fontSize: 13, color: colors.grayLight, fontFamily: "monospace" }}>{row.phone}</span></div>
                      <div style={{ flex: 1 }}><span style={{ fontFamily: "'Inter'", fontSize: 13, color: colors.white, fontWeight: 600 }}>{row.amount}</span></div>
                      <div style={{ flex: 1 }}>
                        <span
                          style={{
                            fontFamily: "'Inter'",
                            fontSize: 11,
                            fontWeight: 600,
                            color: row.status === "valid" ? colors.green : colors.red,
                            background: row.status === "valid" ? `${colors.green}15` : `${colors.red}15`,
                            padding: "3px 10px",
                            borderRadius: 20,
                          }}
                        >
                          {row.status === "valid" ? "✓ Valid" : "✗ Invalid"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Summary card */}
        {frame >= 320 && (
          <div
            style={{
              width: 320,
              opacity: summaryOpacity,
              transform: `scale(${summaryScale})`,
              background: `${colors.surface}ee`,
              border: `1px solid ${colors.white}15`,
              borderRadius: 16,
              padding: 28,
              alignSelf: "flex-start",
              marginTop: 0,
            }}
          >
            <h4 style={{ fontFamily: "'Space Grotesk'", fontSize: 18, color: colors.white, fontWeight: 700, margin: "0 0 20px" }}>
              Batch Summary
            </h4>
            {[
              { label: "Total Records", value: "1,247" },
              { label: "Valid", value: "1,244", color: colors.green },
              { label: "Errors", value: "3", color: colors.red },
              { label: "Total Amount", value: "K2,450,000" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < 3 ? `1px solid ${colors.white}10` : "none" }}>
                <span style={{ fontFamily: "'Inter'", fontSize: 13, color: colors.gray }}>{item.label}</span>
                <span style={{ fontFamily: "'Inter'", fontSize: 14, fontWeight: 600, color: item.color || colors.white }}>{item.value}</span>
              </div>
            ))}

            {/* Submit button */}
            <div
              style={{
                marginTop: 20,
                background: submitGlow ? `linear-gradient(135deg, ${colors.primary}, ${colors.primaryLight})` : colors.primary,
                borderRadius: 8,
                padding: "12px 0",
                textAlign: "center",
                boxShadow: submitGlow ? `0 0 30px ${colors.primary}50` : "none",
              }}
            >
              <span style={{ fontFamily: "'Inter'", fontSize: 14, fontWeight: 600, color: colors.white }}>
                Submit Batch for Approval
              </span>
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
