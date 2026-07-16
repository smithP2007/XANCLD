// ─── Character Detail Page (/character/:id) ────────────────────
// Shows character info (name, native name, alternative names, image,
// description, age, gender, DOB, blood type) and a grid of up to 25
// anime appearances with role + score badges.
//
// Premium affordances:
//  - Ambient backdrop — character image blurred + scaled behind card
//    at 20% opacity for cinematic effect
//  - Glass info card (rounded-3xl, backdrop-blur-xl)
//  - Large portrait (40×56 mobile, 48×64 desktop) with white border
//  - Quick info pills with icons (age, gender, DOB, blood type)
//  - Anime appearances grid (poster-style, hover glow + image zoom,
//    role badge top-left, score badge top-right, season+format bottom)

import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, Cake, Users, Droplet, Venus, Mars, AlertCircle, Star, Film, Calendar,
} from "lucide-react";
import { fetchCharacter, getTitle } from "../lib/anilist";
import type { CharacterDetail } from "../types/anime";
import { formatFuzzyDate } from "../types/anime";
import { BackButton } from "../components/layout/BackButton";

export function Character() {
  const { id } = useParams<{ id: string }>();
  const [character, setCharacter] = useState<CharacterDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const c = await fetchCharacter(parseInt(id, 10));
      setCharacter(c);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-40">
        <div className="animate-spin h-10 w-10 border-2 border-xan-crimson border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!character) {
    return (
      <div className="text-center py-40 space-y-3">
        <AlertCircle className="h-10 w-10 text-xan-crimson mx-auto" />
        <p className="text-muted-foreground">Character not found.</p>
        <Link to="/home" className="text-xan-crimson inline-block">Go home</Link>
      </div>
    );
  }

  const name = character.name.full ?? "Unknown";
  const nativeName = character.name.native;
  const alts = character.name.alternative.filter(Boolean).slice(0, 6);
  const description = character.description
    ? character.description.replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "")
    : "";

  return (
    <div className="pb-16">
      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-8">
        <BackButton fallback="/home" className="mb-6" />

        {/* ─── Info card ─── */}
        <div className="relative rounded-3xl glass border border-xan-border p-6 md:p-8 overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
          {/* Subtle accent corner glow — matches the Synopsis card on the anime detail page */}
          {character.image.large && (
            <div
              className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-10 blur-3xl pointer-events-none"
              style={{ backgroundImage: `url(${character.image.large})`, backgroundSize: "cover", backgroundPosition: "center" }}
              aria-hidden
            />
          )}
          <div className="relative flex flex-col md:flex-row gap-6 md:gap-8">
            {/* Portrait */}
            <div className="flex-shrink-0 mx-auto md:mx-0">
              <img
                src={character.image.large ?? character.image.medium ?? "/placeholder.svg"}
                alt={name}
                className="w-40 h-56 md:w-48 md:h-64 rounded-2xl object-cover border-2 border-white/20 shadow-[0_25px_70px_rgba(0,0,0,0.6)]"
                onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
              />
            </div>

            {/* Name + meta */}
            <div className="flex-1 space-y-4 text-center md:text-left">
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold font-display text-foreground leading-tight">
                  {name}
                </h1>
                {nativeName && nativeName !== name && (
                  <p className="text-sm md:text-base text-muted-foreground italic mt-1">
                    {nativeName}
                  </p>
                )}
              </div>

              {/* Alternative names — pill row */}
              {alts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center md:justify-start">
                  {alts.map((alt, i) => (
                    <span
                      key={`${alt}-${i}`}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium glass text-muted-foreground"
                    >
                      {alt}
                    </span>
                  ))}
                </div>
              )}

              {/* Quick info pills */}
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                {character.age && (
                  <InfoPill icon={Users} label="Age" value={character.age} />
                )}
                {character.gender && (
                  <InfoPill
                    icon={character.gender.toLowerCase().startsWith("f") ? Venus : character.gender.toLowerCase().startsWith("m") ? Mars : Users}
                    label="Gender"
                    value={character.gender}
                  />
                )}
                {character.dateOfBirth && character.dateOfBirth.year && (
                  <InfoPill icon={Cake} label="Born" value={formatFuzzyDate(character.dateOfBirth)} />
                )}
                {character.bloodType && (
                  <InfoPill icon={Droplet} label="Blood" value={character.bloodType} />
                )}
              </div>

              {/* Description — sanitized, clamped on mobile */}
              {description && (
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-6 md:line-clamp-none">
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ─── Anime appearances ─── */}
        {character.media.length > 0 && (
          <section className="mt-10 animate-fade-in-up">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-1 h-6 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
              <h2 className="text-xl font-bold font-display text-foreground">Anime Appearances</h2>
              <span className="text-xs text-muted-foreground ml-1 tabular-nums">
                · {character.media.length}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {character.media.map((edge) => {
                const a = edge.media;
                const title = getTitle(a.title);
                return (
                  <Link key={a.id} to={`/anime/${a.id}`} className="group hover-lift">
                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-xan-border group-hover:border-xan-crimson/50 transition-all shadow-lg">
                      <img
                        src={a.coverImage?.large ?? "/placeholder.svg"}
                        alt={title}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
                      />
                      {/* Hover glow overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-xan-crimson/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      {/* Always-on bottom gradient for title legibility */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                      {/* Role badge top-left */}
                      {edge.characterRole && (
                        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider bg-xan-crimson/90 text-white">
                          {edge.characterRole.replace(/_/g, " ")}
                        </div>
                      )}
                      {/* Score badge top-right */}
                      {a.averageScore != null && (
                        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/80 backdrop-blur-sm border border-white/15 text-[9px] font-bold text-white">
                          <Star className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400" />
                          {Math.round(a.averageScore)}%
                        </div>
                      )}
                      {/* Title + season/format at bottom */}
                      <div className="absolute bottom-1.5 left-1.5 right-1.5">
                        <p className="text-[10px] font-medium text-white line-clamp-2 leading-tight group-hover:text-xan-crimson transition-colors">
                          {title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 text-[9px] text-white/60 uppercase tracking-wider">
                          {a.format && <span className="flex items-center gap-0.5"><Film className="h-2 w-2" />{a.format}</span>}
                          {a.seasonYear && <span className="flex items-center gap-0.5"><Calendar className="h-2 w-2" />{a.seasonYear}</span>}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ─── Quick info pill ─────────────────────────────────────────
function InfoPill({
  icon: Icon, label, value,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-xs">
      <Icon className="h-3 w-3 text-xan-crimson" />
      <span className="text-muted-foreground uppercase tracking-wider text-[9px] font-medium">{label}</span>
      <span className="text-foreground font-semibold">{value}</span>
    </span>
  );
}
