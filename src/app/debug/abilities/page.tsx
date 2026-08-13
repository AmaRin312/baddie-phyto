import { BATTLE_ABILITY_DEFINITIONS } from "@/lib/battle/abilities/battleAbilityDefinitions";
import {
  generateBattleAbilityRegistryPostcheckSql,
  generateBattleAbilityRegistrySeedSql
} from "@/lib/battle/abilities/abilityRegistrySql";
import { validateBattleAbilityRegistry } from "@/lib/battle/abilities/abilityRegistryValidation";
import type { CSSProperties } from "react";

const pageStyle = {
  minHeight: "100vh",
  background: "#0f172a",
  color: "#e5e7eb",
  padding: "32px",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
} satisfies CSSProperties;

const cardStyle = {
  border: "1px solid rgba(148, 163, 184, 0.35)",
  borderRadius: "16px",
  background: "rgba(15, 23, 42, 0.72)",
  padding: "20px",
  boxShadow: "0 18px 48px rgba(0, 0, 0, 0.24)"
} satisfies CSSProperties;

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  overflow: "hidden"
} satisfies CSSProperties;

const headerCellStyle = {
  borderBottom: "1px solid rgba(148, 163, 184, 0.35)",
  color: "#93c5fd",
  fontSize: "13px",
  padding: "10px",
  textAlign: "left"
} satisfies CSSProperties;

const cellStyle = {
  borderBottom: "1px solid rgba(148, 163, 184, 0.18)",
  fontSize: "13px",
  padding: "10px",
  verticalAlign: "top"
} satisfies CSSProperties;

const preStyle = {
  background: "rgba(2, 6, 23, 0.86)",
  border: "1px solid rgba(148, 163, 184, 0.28)",
  borderRadius: "12px",
  color: "#bfdbfe",
  fontSize: "12px",
  lineHeight: 1.6,
  overflowX: "auto",
  padding: "14px",
  whiteSpace: "pre-wrap"
} satisfies CSSProperties;

function formatValue(value: string | undefined) {
  return value ?? "—";
}

export default function DebugAbilitiesPage() {
  const issues = validateBattleAbilityRegistry();
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter(
    (issue) => issue.severity === "warning"
  ).length;
  const abilityDefinitions = Object.values(BATTLE_ABILITY_DEFINITIONS);
  const isHealthy = errorCount === 0;
  const seedSql = generateBattleAbilityRegistrySeedSql();
  const postcheckSql = generateBattleAbilityRegistryPostcheckSql();

  return (
    <main style={pageStyle}>
      <div style={{ margin: "0 auto", maxWidth: "1180px" }}>
        <p
          style={{
            color: "#93c5fd",
            fontSize: "13px",
            letterSpacing: "0.08em",
            margin: "0 0 8px",
            textTransform: "uppercase"
          }}
        >
          Baddie Phyto Debug
        </p>
        <h1 style={{ fontSize: "32px", margin: "0 0 10px" }}>
          Ability Registry Check
        </h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.7, margin: "0 0 24px" }}>
          Ability定義とBattleCommand連携用IDの整合性を確認するデバッグページです。
          通常画面・BattleState・Ability実行処理は変更しません。
        </p>

        <section
          style={{
            ...cardStyle,
            borderColor: isHealthy
              ? "rgba(34, 197, 94, 0.6)"
              : "rgba(248, 113, 113, 0.75)",
            marginBottom: "18px"
          }}
        >
          <h2 style={{ fontSize: "20px", margin: "0 0 12px" }}>
            {isHealthy ? "問題なし" : "要確認"}
          </h2>
          <div
            style={{
              display: "grid",
              gap: "12px",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))"
            }}
          >
            <div>
              <div style={{ color: "#94a3b8", fontSize: "12px" }}>Abilities</div>
              <div style={{ fontSize: "26px", fontWeight: 700 }}>
                {abilityDefinitions.length}
              </div>
            </div>
            <div>
              <div style={{ color: "#94a3b8", fontSize: "12px" }}>Errors</div>
              <div
                style={{
                  color: errorCount === 0 ? "#86efac" : "#fca5a5",
                  fontSize: "26px",
                  fontWeight: 700
                }}
              >
                {errorCount}
              </div>
            </div>
            <div>
              <div style={{ color: "#94a3b8", fontSize: "12px" }}>Warnings</div>
              <div
                style={{
                  color: warningCount === 0 ? "#86efac" : "#fde68a",
                  fontSize: "26px",
                  fontWeight: 700
                }}
              >
                {warningCount}
              </div>
            </div>
          </div>
        </section>

        <section style={{ ...cardStyle, marginBottom: "18px" }}>
          <h2 style={{ fontSize: "20px", margin: "0 0 12px" }}>
            Registry Issues
          </h2>
          {issues.length === 0 ? (
            <p style={{ color: "#86efac", margin: 0 }}>
              登録済みAbilityに検出された不整合はありません。
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={headerCellStyle}>Severity</th>
                    <th style={headerCellStyle}>Ability ID</th>
                    <th style={headerCellStyle}>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((issue, index) => (
                    <tr key={`${issue.abilityId}-${issue.message}-${index}`}>
                      <td
                        style={{
                          ...cellStyle,
                          color:
                            issue.severity === "error" ? "#fca5a5" : "#fde68a",
                          fontWeight: 700
                        }}
                      >
                        {issue.severity}
                      </td>
                      <td style={cellStyle}>{issue.abilityId}</td>
                      <td style={cellStyle}>{issue.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={cardStyle}>
          <h2 style={{ fontSize: "20px", margin: "0 0 12px" }}>
            Ability Definitions
          </h2>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={headerCellStyle}>ID</th>
                  <th style={headerCellStyle}>Label</th>
                  <th style={headerCellStyle}>Action</th>
                  <th style={headerCellStyle}>Target</th>
                  <th style={headerCellStyle}>Executor</th>
                  <th style={headerCellStyle}>Menu</th>
                  <th style={headerCellStyle}>Auto</th>
                </tr>
              </thead>
              <tbody>
                {abilityDefinitions.map((definition) => (
                  <tr key={definition.id}>
                    <td style={cellStyle}>{definition.id}</td>
                    <td style={cellStyle}>{definition.label}</td>
                    <td style={cellStyle}>{formatValue(definition.actionId)}</td>
                    <td style={cellStyle}>
                      {formatValue(definition.targetDefinitionId)}
                    </td>
                    <td style={cellStyle}>{formatValue(definition.executorId)}</td>
                    <td style={cellStyle}>
                      {definition.getMenuContribution ? "yes" : "no"}
                    </td>
                    <td style={cellStyle}>
                      {definition.getAutomaticCommands ? "yes" : "no"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ ...cardStyle, marginTop: "18px" }}>
          <h2 style={{ fontSize: "20px", margin: "0 0 12px" }}>
            Generated Supabase SQL
          </h2>
          <p style={{ color: "#cbd5e1", lineHeight: 1.7, margin: "0 0 14px" }}>
            現在のAbility定義から生成した登録SQLです。Ability追加時は、この表示を確認すると
            SQL更新漏れを見つけやすくなります。
          </p>
          <h3 style={{ color: "#93c5fd", fontSize: "15px", margin: "0 0 8px" }}>
            Seed SQL
          </h3>
          <pre style={preStyle}>{seedSql}</pre>
          <h3
            style={{
              color: "#93c5fd",
              fontSize: "15px",
              margin: "16px 0 8px"
            }}
          >
            Postcheck SQL
          </h3>
          <pre style={preStyle}>{postcheckSql}</pre>
        </section>
      </div>
    </main>
  );
}
