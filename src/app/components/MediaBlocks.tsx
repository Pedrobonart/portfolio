// Renders the optional `media` gallery on a project detail page.
// Each block in `project.media[]` is one row; see ../data/projects.ts for the
// schema (kinds: image | pair | grid | carousel).
import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type {
  LayoutBlock,
  MediaBlock,
  MediaCarouselBlock,
  MediaGridBlock,
  MediaImage,
  MediaImageBlock,
  MediaPairBlock,
  MediaSlot,
} from '../data/projects';

// ─── Helpers ─────────────────────────────────────────────────────────────
const aspectClass = (a?: 'auto' | '16/9' | '4/3' | '1/1' | '3/4'): string => {
  switch (a) {
    case '4/3':  return 'aspect-[4/3]';
    case '1/1':  return 'aspect-square';
    case '3/4':  return 'aspect-[3/4]';
    case 'auto': return '';
    case '16/9':
    default:     return 'aspect-video';
  }
};

const sizeClass = (s?: 'full' | 'wide' | 'half'): string => {
  switch (s) {
    case 'wide': return 'w-full md:w-4/5 mx-auto';
    case 'half': return 'w-full md:w-1/2 mx-auto';
    case 'full':
    default:     return 'w-full';
  }
};

const columnsClass = (c?: 2 | 3 | 4): string => {
  switch (c) {
    case 3: return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3';
    case 4: return 'grid-cols-2 md:grid-cols-4';
    case 2:
    default: return 'grid-cols-1 sm:grid-cols-2';
  }
};

// Shared <img> wrapper with the surface background + caption.
function Frame({ img, aspect }: { img: MediaImage; aspect?: string }) {
  return (
    <figure>
      <div
        className={`w-full overflow-hidden ${aspect ?? ''}`}
        style={{ background: 'var(--site-surface2)' }}
      >
        <img
          src={img.src}
          alt={img.alt ?? ''}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </div>
      {img.caption && (
        <figcaption
          className="mt-2 tracking-[0.05em]"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '0.72rem',
            color: 'var(--site-muted)',
          }}
        >
          {img.caption}
        </figcaption>
      )}
    </figure>
  );
}

// ─── Individual block renderers ──────────────────────────────────────────
function ImageRow({ block }: { block: MediaImageBlock }) {
  return (
    <div className={sizeClass(block.size)}>
      <Frame
        img={{ src: block.src, alt: block.alt, caption: block.caption }}
        aspect={aspectClass(block.aspect)}
      />
    </div>
  );
}

function PairRow({ block }: { block: MediaPairBlock }) {
  const a = aspectClass(block.aspect);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
      {block.images.map((img, i) => (
        <Frame key={i} img={img} aspect={a} />
      ))}
    </div>
  );
}

function GridRow({ block }: { block: MediaGridBlock }) {
  const a = aspectClass(block.aspect ?? '4/3');
  return (
    <div className={`grid gap-4 md:gap-6 ${columnsClass(block.columns)}`}>
      {block.images.map((img, i) => (
        <Frame key={i} img={img} aspect={a} />
      ))}
    </div>
  );
}

function CarouselRow({ block }: { block: MediaCarouselBlock }) {
  const [emblaRef, embla] = useEmblaCarousel({ loop: true, align: 'start' });
  const [selected, setSelected] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const onSelect = useCallback(() => {
    if (!embla) return;
    setSelected(embla.selectedScrollSnap());
    setCanPrev(embla.canScrollPrev());
    setCanNext(embla.canScrollNext());
  }, [embla]);

  useEffect(() => {
    if (!embla) return;
    onSelect();
    embla.on('select', onSelect);
    embla.on('reInit', onSelect);
  }, [embla, onSelect]);

  const a = aspectClass(block.aspect);

  return (
    <div className="relative">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {block.images.map((img, i) => (
            <div key={i} className="flex-[0_0_100%] min-w-0">
              <Frame img={img} aspect={a} />
            </div>
          ))}
        </div>
      </div>

      {/* Prev / Next */}
      <button
        onClick={() => embla?.scrollPrev()}
        aria-label="Previous image"
        disabled={!canPrev && !embla?.internalEngine().options.loop}
        className="hidden md:flex absolute top-1/2 -translate-y-1/2 left-3 items-center justify-center"
        style={{
          width: 36, height: 36,
          background: 'var(--menu-bg-strong)',
          backdropFilter: 'blur(6px)',
          border: '1px solid var(--site-border)',
          color: 'var(--site-text)',
          cursor: 'pointer',
        }}
      >
        <ChevronLeft size={18} strokeWidth={1.5} />
      </button>
      <button
        onClick={() => embla?.scrollNext()}
        aria-label="Next image"
        disabled={!canNext && !embla?.internalEngine().options.loop}
        className="hidden md:flex absolute top-1/2 -translate-y-1/2 right-3 items-center justify-center"
        style={{
          width: 36, height: 36,
          background: 'var(--menu-bg-strong)',
          backdropFilter: 'blur(6px)',
          border: '1px solid var(--site-border)',
          color: 'var(--site-text)',
          cursor: 'pointer',
        }}
      >
        <ChevronRight size={18} strokeWidth={1.5} />
      </button>

      {/* Dots */}
      <div className="flex justify-center gap-2 mt-3">
        {block.images.map((_, i) => (
          <button
            key={i}
            onClick={() => embla?.scrollTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: i === selected ? 'var(--site-text)' : 'var(--site-border)',
              border: 'none', cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Render a single media block (used by both MediaBlocks and LayoutBlocks).
function renderMediaBlock(b: MediaBlock, key: string | number) {
  switch (b.kind) {
    case 'image':    return <ImageRow    key={key} block={b} />;
    case 'pair':     return <PairRow     key={key} block={b} />;
    case 'grid':     return <GridRow     key={key} block={b} />;
    case 'carousel': return <CarouselRow key={key} block={b} />;
  }
}

// ─── Public entry: media blocks filtered by slot ─────────────────────────
// Pass `slot` to render only blocks for that named slot. Blocks with no
// `slot` field default to 'afterHero'.
export function MediaBlocks({
  blocks,
  slot,
}: {
  blocks?: MediaBlock[];
  slot?: MediaSlot;
}) {
  if (!blocks || blocks.length === 0) return null;
  const filtered = slot
    ? blocks.filter((b) => (b.slot ?? 'afterHero') === slot)
    : blocks;
  if (filtered.length === 0) return null;
  return (
    <div className="flex flex-col gap-10 md:gap-14">
      {filtered.map((b, i) => renderMediaBlock(b, i))}
    </div>
  );
}

// ─── Public entry: free-form custom layout ───────────────────────────────
// Used when `project.layout` is set. Renders any sequence of text + media
// blocks in order.
export function LayoutBlocks({
  blocks,
  description,
  details,
}: {
  blocks: LayoutBlock[];
  /** Project's `description` string, pulled in by `{ kind: 'description' }`. */
  description: string;
  /** Project's `details` string, pulled in by `{ kind: 'details' }`. */
  details: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'heading':
            return (
              <h2
                key={i}
                className="tracking-[0.05em]"
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 'clamp(1.25rem, 2vw, 1.6rem)',
                  fontWeight: 400,
                  color: 'var(--site-text)',
                  marginTop: '1rem',
                }}
              >
                {b.text}
              </h2>
            );
          case 'paragraph': {
            const e = b.emphasis ?? 'body';
            const style =
              e === 'lead'
                ? { fontSize: '0.95rem', lineHeight: 1.8, color: 'var(--site-text2)' }
                : e === 'muted'
                ? { fontSize: '0.88rem', lineHeight: 1.85, color: 'var(--site-muted)' }
                : { fontSize: '0.9rem', lineHeight: 1.8, color: 'var(--site-text2)' };
            return (
              <p key={i} style={{ fontFamily: 'var(--font-sans)', ...style }}>
                {b.text}
              </p>
            );
          }
          case 'description':
            return (
              <p
                key={i}
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.95rem',
                  lineHeight: 1.8,
                  color: 'var(--site-text2)',
                }}
              >
                {description}
              </p>
            );
          case 'details':
            return (
              <p
                key={i}
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.88rem',
                  lineHeight: 1.85,
                  color: 'var(--site-muted)',
                }}
              >
                {details}
              </p>
            );
          case 'spacer': {
            const px = b.size === 'lg' ? 48 : b.size === 'sm' ? 12 : 24;
            return <div key={i} style={{ height: px }} />;
          }
          default:
            return renderMediaBlock(b, i);
        }
      })}
    </div>
  );
}
