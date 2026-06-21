import { CurrentRequest } from "./CurrentRequest";
import { ParentPot } from "./ParentPot";
import { HybridPot } from "./HybridPot";
import { EnvironmentSelector } from "./EnvironmentSelector";
import { CrossbreedButton } from "./CrossbreedButton";

/**
 * The Greenhouse — the central play area: the current request, the two parent pots
 * flanking the focal Hybrid Pot, the Light/Water/Soil dials, and the crossbreed CTA.
 * Shared by the desktop center column and the mobile "Garden" tab.
 */
export function Greenhouse() {
  return (
    <div className="flex h-full flex-col gap-3">
      <CurrentRequest />

      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="flex items-end justify-center gap-2 md:gap-4 xl:gap-6">
          <ParentPot pot="A" label="Parent A" />
          <HybridPot />
          <ParentPot pot="B" label="Parent B" />
        </div>
      </div>

      <div className="gh-panel px-3 py-3">
        <EnvironmentSelector />
      </div>

      <CrossbreedButton />
    </div>
  );
}
