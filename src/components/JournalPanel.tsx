import { useGame } from "../game/GameContext";
import { Badge } from "./Badge";
import { DailyWinners } from "./DailyWinners";
import {
  experimentStatusLabel,
  rarity as rarityStyle,
  speciesOf,
} from "../mocks/presentation";
import { ExperimentStatus, type JournalEntry } from "../types";

function shortName(species: number): string {
  return species === 255 ? "Hybrid" : speciesOf(species).name.split(" ").pop() ?? "Flower";
}

function JournalRow({ e }: { e: JournalEntry }) {
  const ok = e.status === ExperimentStatus.Completed && e.result;
  const r = e.result ? rarityStyle(e.result.rarity) : null;
  return (
    <li className="flex items-center gap-2 rounded-md border border-garden-moss/60 bg-garden-deep/40 px-2 py-1.5">
      <span className="font-pixel text-[10px] text-garden-parch/80">
        {shortName(e.parentASpecies)} <span className="text-garden-cyan">×</span> {shortName(e.parentBSpecies)}
      </span>
      <span className="flex-1" />
      {ok && e.result ? (
        <>
          <Badge className="border-garden-moss text-garden-parch" title="Generation">
            G{e.result.generation}
          </Badge>
          {r && <Badge className={`${r.text} ${r.ring}`}>{r.label}</Badge>}
        </>
      ) : (
        <Badge className="border-garden-rose text-garden-rose">{experimentStatusLabel(e.status)}</Badge>
      )}
    </li>
  );
}

/**
 * Right panel: a scrollable Hybrid Journal of past crossbreeds, with the Daily Winners /
 * challenge status pinned at the bottom. Used by the desktop right column and the mobile
 * "Journal" tab.
 */
export function JournalPanel() {
  const { journal } = useGame();

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="gh-panel flex min-h-0 flex-1 flex-col px-3 py-2.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="gh-title text-[11px] text-garden-mint">Hybrid Journal</span>
          <Badge className="border-garden-moss text-garden-parch/70">{journal.length} blooms</Badge>
        </div>
        <ul className="gh-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
          {journal.map((e) => (
            <JournalRow key={e.id} e={e} />
          ))}
        </ul>
      </div>
      <DailyWinners />
    </div>
  );
}
