import { BottomSheet } from "./BottomSheet";
import { EpisodePanel } from "./EpisodePanel";
import { Link } from "react-router-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  animeId: number;
  currentEpisode: number;
  totalEpisodes: number;
  nextAirEp: number | null;
}

/**
 * EpisodePickerSheet — episode picker rendered inside a BottomSheet.
 *
 * Wraps the shared EpisodePanel component so the mobile bottom-sheet and
 * the desktop/PC sidebar use the EXACT same pagination logic:
 *   - 50 episodes per page
 *   - Auto-opens to the page containing the current episode
 *   - Prev/next + page-jumper side-scroll buttons
 *   - Search filters to a single matching episode
 *
 * Used on both AnimeDetail (mobile) and Watch (mobile).
 */
export function EpisodePickerSheet({
  open,
  onClose,
  animeId,
  currentEpisode,
  totalEpisodes,
  nextAirEp,
}: Props) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`Episodes${totalEpisodes > 0 ? ` · ${totalEpisodes} total` : ""}`}
      tall
    >
      {totalEpisodes > 0 ? (
        <EpisodePanel
          animeId={animeId}
          currentEpisode={currentEpisode}
          totalEpisodes={totalEpisodes}
          nextAirEp={nextAirEp}
          onPick={onClose}
        />
      ) : (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-4">
            Episode count unknown for this title. Start watching from episode 1 — the player
            will let you navigate to the next episode.
          </p>
          <Link
            to={`/watch/${animeId}?ep=1`}
            onClick={onClose}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-xan-crimson to-xan-violet font-semibold text-white transition-all shadow-lg shadow-xan-crimson/30"
          >
            Watch Episode 1
          </Link>
        </div>
      )}
    </BottomSheet>
  );
}
