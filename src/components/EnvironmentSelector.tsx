import { useGame } from "../game/GameContext";
import { ENVIRONMENT_OPTIONS } from "../mocks/data";
import type { EnvironmentKind } from "../types";

const ROWS: { kind: EnvironmentKind; label: string; icon: string }[] = [
  { kind: "light", label: "Light", icon: "☀" },
  { kind: "water", label: "Water", icon: "💧" },
  { kind: "soil", label: "Soil", icon: "🪴" },
];

/** Light / Water / Soil dials — three clearly-shown options each. These will become real
 *  encrypted breeding inputs in a later stage; here they only set local UI state. */
export function EnvironmentSelector() {
  const { environment, setEnvironment, isCycling } = useGame();

  return (
    <div className="grid gap-2">
      {ROWS.map(({ kind, label, icon }) => {
        const options = ENVIRONMENT_OPTIONS[kind];
        const current = environment[kind];
        return (
          <div key={kind} className="flex items-center gap-2">
            <span className="flex w-16 shrink-0 items-center gap-1 font-pixel text-[11px] uppercase tracking-wide text-garden-parch">
              <span aria-hidden>{icon}</span>
              {label}
            </span>
            <div className="flex flex-1 gap-1" role="group" aria-label={`${label} setting`}>
              {options.map((opt, i) => {
                const active = i === current;
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={isCycling}
                    aria-pressed={active}
                    onClick={() => setEnvironment(kind, i)}
                    className={`flex-1 rounded-md border px-1 py-1.5 font-pixel text-[10px] uppercase tracking-wide transition disabled:opacity-50
                      ${active
                        ? "border-garden-cyan bg-garden-cyan/15 text-garden-cyan"
                        : "border-garden-moss/70 bg-garden-deep/40 text-garden-parch/70 hover:border-garden-mint"}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
