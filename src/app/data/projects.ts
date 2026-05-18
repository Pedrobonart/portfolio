export type ProjectType = 'architecture' | 'cartography';
export type WorkType = 'academic' | 'thesis' | 'professional';

// ─── i18n helpers ────────────────────────────────────────────────────────
// A localized value is either a plain T (used for both languages) or an
// object with per-language variants. `es` is optional and falls back to `en`.
// Use `pickL(value, lang)` (src/app/utils/project.ts) to resolve at render.
export type Localized<T> = T | { en: T; es?: T };

/** A named secondary site for projects that span multiple locations. */
export interface ProjectLocation {
  /** Short label shown on the globe marker, e.g. "Site A" or "Rotterdam HQ". */
  label?: string;
  coordinates: [number, number];
}

// ─── Project media blocks ────────────────────────────────────────────────
// A project page can mix multiple layouts. Each block is one row of media.
// By default it appears in the `afterHero` slot, but the `slot` field lets
// you place it elsewhere on the page. See <ProjectDetail /> for the slots
// and <MediaBlocks /> for the renderers.
export type MediaSlot =
  | 'afterHero'          // between hero image and the title/text grid
  | 'afterDescription'   // between the description and the details paragraph
  | 'afterDetails'       // below the details paragraph (still inside right column)
  | 'beforeRelated';     // full-width row above the "related projects" section

export interface MediaImage {
  src: string;
  alt?: string;
  caption?: Localized<string>;
}

interface MediaBlockBase {
  /** Where on the page this block renders. Defaults to 'afterHero'. */
  slot?: MediaSlot;
}

/** Single image. `size` controls horizontal extent inside the content area. */
export interface MediaImageBlock extends MediaImage, MediaBlockBase {
  kind: 'image';
  /** full = 100% of content area, wide = ~80%, half = ~50%. Defaults to full. */
  size?: 'full' | 'wide' | 'half';
  /** aspect ratio hint, defaults to 16/9. Use 'auto' to keep natural ratio. */
  aspect?: '16/9' | '4/3' | '1/1' | '3/4' | 'auto';
}

/** Two images side-by-side (stacks on mobile). */
export interface MediaPairBlock extends MediaBlockBase {
  kind: 'pair';
  images: [MediaImage, MediaImage];
  aspect?: '16/9' | '4/3' | '1/1' | '3/4' | 'auto';
}

/** N-column grid (mobile collapses to single column). */
export interface MediaGridBlock extends MediaBlockBase {
  kind: 'grid';
  images: MediaImage[];
  columns?: 2 | 3 | 4;
  aspect?: '16/9' | '4/3' | '1/1' | '3/4' | 'auto';
}

/** Horizontal carousel (swipe / arrows). */
export interface MediaCarouselBlock extends MediaBlockBase {
  kind: 'carousel';
  images: MediaImage[];
  aspect?: '16/9' | '4/3' | '1/1' | '3/4' | 'auto';
}

export type MediaBlock =
  | MediaImageBlock
  | MediaPairBlock
  | MediaGridBlock
  | MediaCarouselBlock;

// ─── Custom page layout (advanced) ───────────────────────────────────────
// Setting `project.layout` REPLACES the default body (title, description,
// details). Each entry renders in order in the right column. Use this for
// projects that need a bespoke flow — text, media, headings, etc.
export interface LayoutHeading { kind: 'heading'; text: string; }
export interface LayoutParagraph {
  kind: 'paragraph';
  text: string;
  /** Visual emphasis — 'lead' = larger first-paragraph style, 'body' = default. */
  emphasis?: 'lead' | 'body' | 'muted';
}
/** Pulls the project's existing `description` or `details` string in-place. */
export interface LayoutBuiltin { kind: 'description' | 'details'; }
/** Spacer for breathing room between blocks (rem). */
export interface LayoutSpacer { kind: 'spacer'; size?: 'sm' | 'md' | 'lg'; }

export type LayoutBlock =
  | LayoutHeading
  | LayoutParagraph
  | LayoutBuiltin
  | LayoutSpacer
  | MediaBlock;

export interface Project {
  id: string;
  /** Text fields below are `Localized` — pass plain string for english-only,
   * or `{ en, es }` for bilingual. Resolve with `pickL` at render time. */
  title: Localized<string>;
  type: ProjectType;
  year: number;
  location: Localized<string>;
  country: Localized<string>;
  /** Primary / first site coordinates [lat, lng]. */
  coordinates: [number, number];
  /**
   * Additional site coordinates for projects that span multiple locations.
   * Each entry gets its own marker on the globe.
   */
  extraLocations?: ProjectLocation[];
  shortDescription: Localized<string>;
  description: Localized<string>;
  details: Localized<string>;
  client: Localized<string>;
  workType: WorkType;
  area?: Localized<string>;
  scale?: Localized<string>;
  /** Hero / thumbnail image — also used in listings, related-project cards. */
  image: string;
  /**
   * Optional media blocks placed at named slots on the detail page.
   * If `slot` is omitted on a block, it defaults to 'afterHero'.
   * Ignored when `layout` is set (then put media inside `layout`).
   */
  media?: MediaBlock[];
  /**
   * Advanced: fully custom body sequence for this project. When set, this
   * REPLACES the default title+description+details rendering in the right
   * column. Media in `media` is still honored for slots OUTSIDE the body
   * (afterHero, beforeRelated).
   */
  layout?: LayoutBlock[];
  /** Filterable tags. Either a plain list (used for both languages) or
   *  `{ en: [...], es: [...] }` to translate each tag. */
  tags: Localized<string[]>;
}

import { csvProjects } from './projects.generated';

// Hand-coded projects authored directly in this file. CSV-driven projects
// from templates/Projects/PROJECTS.csv are merged in at the end of the list
// via `csvProjects` (see scripts/build-projects.mjs).
const handProjects: Project[] = [
  // NOTE: waterfront-cultural-center has been migrated to PROJECTS.csv +
  // templates/Projects/media/waterfront-cultural-center.media.json.
  {
    id: 'alpine-terrain-analysis',
    title: 'Alpine Terrain Analysis',
    type: 'cartography',
    year: 2023,
    location: 'Swiss Alps',
    country: 'Switzerland',
    coordinates: [46.5283, 8.0367],
    extraLocations: [
      { label: 'Rhône Glacier', coordinates: [46.6156, 8.3929] },
      { label: 'Gorner Glacier', coordinates: [45.9763, 7.7927] },
    ],
    shortDescription:
      'Multi-scale topographic survey documenting glacial recession and landform evolution across 400 km².',
    description:
      'This large-scale cartographic study was commissioned by the Swiss Federal Office for the Environment to establish a benchmark dataset for monitoring glacial recession in the Central Alps. Combining LiDAR aerial surveys, satellite multispectral imagery, and field GPS measurements, the project produced a comprehensive series of maps at scales ranging from 1:5,000 to 1:100,000.',
    details:
      'The analysis focused on three principal glacier systems — Aletsch, Rhône, and Gorner — documenting surface elevation changes between 2010 and 2023. Derived products include glacier mass balance estimates, supraglacial drainage pattern reconstructions, and proglacial lake hazard assessments. All outputs were delivered in both print-ready cartographic formats and interoperable GIS data packages conforming to ISO 19115 metadata standards. The project introduced a new hypsometric color ramp specifically calibrated for alpine terrain readability in greyscale reproduction.',
    client: 'Swiss Federal Office for the Environment (BAFU)',
    workType: 'professional',
    scale: '1:5,000 – 1:100,000',
    image:
      'https://images.unsplash.com/photo-1578925729780-dc347e0ddc8c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbHBpbmUlMjB0b3BvZ3JhcGhpYyUyMHN1cnZleSUyMG1vdW50YWluJTIwbWFwfGVufDF8fHx8MTc3Njk0OTM3NHww&ixlib=rb-4.1.0&q=80&w=1080',
    tags: ['Glaciology', 'LiDAR', 'Environmental', 'Remote Sensing'],
  },
  {
    id: 'mouraria-regeneration',
    title: 'Mouraria Urban Regeneration',
    type: 'architecture',
    year: 2023,
    location: 'Lisbon',
    country: 'Portugal',
    coordinates: [38.7169, -9.1399],
    shortDescription:
      'Sensitive renovation of a historic neighborhood balancing heritage preservation with contemporary housing needs.',
    description:
      'The Mouraria district, one of Lisbon\'s oldest and most culturally layered neighborhoods, has faced decades of depopulation and neglect. This regeneration proposal addresses a cluster of fourteen buildings across three interconnected courtyards, providing 62 new social housing units while preserving and restoring significant azulejo tile facades and Moorish-period structural elements.',
    details:
      'The intervention is organized around three scales of action: the individual unit (flexible internal layouts adaptable to different household configurations), the building (selective demolition of later additions that had compromised structural integrity and light access), and the courtyard (creation of shared semi-public spaces with planting, seating, and water features). New volumes are expressed in white lime-render and dark steel, deliberately distinguishable from the historic fabric without recourse to pastiche. A community workshop program was conducted over eighteen months prior to design finalization, resulting in significant programmatic adjustments including the inclusion of a shared kitchen and a fado rehearsal space.',
    client: 'Câmara Municipal de Lisboa / HabitatLisboa',
    workType: 'professional',
    area: '7,200 m²',
    image:
      'https://images.unsplash.com/photo-1752608911056-ccec7f5c0a8e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx1cmJhbiUyMHJlbmV3YWwlMjBhcmNoaXRlY3R1cmUlMjBsaXNib24lMjBzdHJlZXR8ZW58MXx8fHwxNzc2OTQ5Mzc0fDA&ixlib=rb-4.1.0&q=80&w=1080',
    tags: ['Heritage', 'Housing', 'Urban Renewal', 'Community'],
  },
  {
    id: 'coastal-morphology-study',
    title: 'Coastal Morphology Study',
    type: 'cartography',
    year: 2022,
    location: 'Cornwall',
    country: 'United Kingdom',
    coordinates: [50.266, -5.0527],
    shortDescription:
      'Detailed mapping of coastal erosion dynamics along 80 km of cliff face using LiDAR and drone photogrammetry.',
    description:
      'Commissioned by the Environment Agency and Natural England, this project produced the most detailed coastal change dataset ever assembled for the Penwith and Lizard peninsulas. Using a combination of airborne LiDAR, UAV-mounted photogrammetric rigs, and historical chart digitization, the survey tracked volumetric cliff retreat over the period 2010–2022.',
    details:
      'Point cloud data captured at a density of 40 points/m² was processed into 1 cm resolution digital surface models, enabling identification of micro-scale failure mechanisms such as joint-controlled block toppling and wave-cut notch development. The final cartographic outputs include a series of change-rate maps employing a custom temporal animation methodology, hazard probability indices for 47 at-risk coastal properties, and a public-facing interactive web atlas. Fieldwork was conducted over four survey campaigns covering all tidal and seasonal conditions.',
    client: 'Environment Agency / Natural England',
    workType: 'professional',
    scale: '1:500 – 1:25,000',
    image:
      'https://images.unsplash.com/photo-1762854283673-e1e5926fa1fd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2FzdGFsJTIwZXJvc2lvbiUyMGNsaWZmcyUyMHNlYSUyMGFlcmlhbHxlbnwxfHx8fDE3NzY5NDkzNzR8MA&ixlib=rb-4.1.0&q=80&w=1080',
    tags: ['Coastal', 'LiDAR', 'Hazard Mapping', 'Change Detection'],
  },
  {
    id: 'atacama-field-station',
    title: 'Atacama Desert Field Station',
    type: 'architecture',
    year: 2022,
    location: 'Atacama Desert',
    country: 'Chile',
    coordinates: [-23.8634, -69.2856],
    shortDescription:
      'Austere research outpost designed to withstand extreme temperature differentials and high-altitude solar radiation.',
    description:
      'At 3,800 m above sea level in the Atacama, this field station serves as a base for astronomical observation teams and atmospheric researchers. The design confronts one of the most inhospitable environments on Earth: daily temperature swings of 40°C, 300 days of clear sky annually, zero precipitation, and sustained winds exceeding 80 km/h.',
    details:
      'The building is organized as a linear spine — a compressed service core flanked by sleeping, working, and instrument spaces — aligned along the prevailing wind axis to minimize lateral loads and sand accumulation. The primary structure is galvanized steel, delivered in standard shipping units and assembled on site by a crew of eight in three weeks. Wall construction uses a composite of local ignimbrite stone (the same material the Atacameño people used for millennia) backed by high-performance aerogel insulation. A passive ventilation strategy using thermal mass and wind scoops eliminates the need for mechanical cooling. All water is condensed from morning fog and stored in an underground cistern.',
    client: 'Universidad de Antofagasta / ESO',
    workType: 'professional',
    area: '620 m²',
    image:
      'https://images.unsplash.com/photo-1758353366083-40466f6a935e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwYXJjaGl0ZWN0dXJlJTIwY29uY3JldGUlMjBkZXNlcnQlMjBhcmlkJTIwbGFuZHNjYXBlfGVufDF8fHx8MTc3Njk0OTM4NHww&ixlib=rb-4.1.0&q=80&w=1080',
    tags: ['Research', 'Extreme Environments', 'Sustainability', 'Remote'],
  },
  {
    id: 'forma-urbis-reconstruction',
    title: 'Forma Urbis Reconstruction',
    type: 'cartography',
    year: 2021,
    location: 'Rome',
    country: 'Italy',
    coordinates: [41.9028, 12.4964],
    shortDescription:
      'Digital reconstruction and georeferencing of the Severan marble plan of ancient Rome.',
    description:
      'The Forma Urbis Romae — the colossal marble plan of Rome carved under Septimius Severus circa 203 AD — survives in over a thousand fragments representing less than 15% of its original extent. This project combined photogrammetric survey of all known fragments, historical scholarship, and computational form-finding to produce a new probabilistic reconstruction of the complete plan.',
    details:
      'Working in collaboration with the Soprintendenza Speciale di Roma and the Stanford Digital Forma Urbis Romae Project, the survey employed structured light scanning to capture fragment geometry at sub-millimeter resolution. Fragments were then georeferenced against archaeological excavation data and building footprints derived from GPR surveys of unexcavated areas. A Bayesian spatial inference model was developed to estimate the most probable configuration of lost sections. The final outputs include a printed atlas at 1:250 scale, a high-resolution digital reconstruction dataset, and an academic monograph co-authored with the project historians.',
    client: 'Soprintendenza Speciale Archeologia Roma / Stanford University',
    workType: 'academic',
    scale: '1:250 (original)',
    image:
      'https://images.unsplash.com/photo-1722694125653-18e4e8f5ef88?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoaXN0b3JpYyUyMGNpdHklMjBhbmNpZW50JTIwcm9tZSUyMGFlcmlhbCUyMGNhcnRvZ3JhcGh5fGVufDF8fHx8MTc3Njk0OTM3NXww&ixlib=rb-4.1.0&q=80&w=1080',
    tags: ['Historical', 'Archaeology', 'Digital Humanities', '3D Scanning'],
  },
  {
    id: 'tesis-cerro-penon',
    title: 'Bachelors thesis',
    type: 'architecture',
    year: 2020,
    location: 'Cerro del Peñón, Mexico City',
    country: 'Mexico',
    coordinates: [19.37772, -99.02801],
    shortDescription:
      'Community-driven residential development integrating public space, mobility networks, and bioclimatic design in Medellín\'s hillside comunas.',
    description:
      'This project arose from a ten-year community development process in the northeastern comunas of Medellín, facilitated by the local NGO Casa Creativa and the city\'s Empresa de Desarrollo Urbano. The brief called for 140 housing units on a steep 12% slope site previously occupied by informal settlements, together with a community center, urban agriculture terraces, and improved pedestrian connectivity to the existing Metrocable network.',
    details:
      'The building configuration follows the natural topography through a series of staggered terraces that provide each unit with a private outdoor space and eliminate mutual overlooking. A network of covered exterior corridors at every third level creates shared spaces that encourage spontaneous social interaction while protecting residents from the intense Andean sun. Structural walls are constructed from interlocking compressed earth blocks produced on site from excavated material, reducing transport costs and providing high thermal mass for passive cooling. The project was designed using an open-source parametric model that residents could manipulate during community design workshops to visualize options for unit configuration.',
    client: 'Empresa de Desarrollo Urbano / Casa Creativa',
    workType: 'thesis',
    area: '24,600 m²',
    image:
      'https://images.unsplash.com/photo-1697082390846-863dd47937ef?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb21tdW5pdHklMjBzb2NpYWwlMjBob3VzaW5nJTIwYXJjaGl0ZWN0dXJlJTIwbWVkZWxsaW58ZW58MXx8fHwxNzc2OTQ5Mzc2fDA&ixlib=rb-4.1.0&q=80&w=1080',
    tags: ['Housing', 'Community', 'Bioclimatic', 'Participatory Design'],
  },
  {
    id: 'svalbard-arctic-survey',
    title: 'High Arctic Fjord Survey',
    type: 'cartography',
    year: 2019,
    location: 'Svalbard',
    country: 'Norway',
    coordinates: [78.2232, 15.6267],
    shortDescription:
      'First comprehensive cartographic survey of the northern Svalbard fjord systems, documenting accelerated sea-ice loss and bathymetric change.',
    description:
      'This expedition survey, conducted aboard the research vessel RV Helmer Hanssen, produced the first detailed modern cartographic record of the coastlines, submarine bathymetry, and ice extent of northern Svalbard\'s fjord systems. Previous mapping of the region dated to Norwegian Polar Institute surveys from 1936–1938, with only fragmentary updates since.',
    details:
      'Bathymetric data was collected using multibeam echosounders operating at 300 kHz, producing seafloor models at 1 m resolution in water depths up to 800 m. Coastal geometry was captured through a combination of helicopter-mounted LiDAR and terrestrial laser scanning at key reference locations. A key finding was the documentation of previously unmapped submarine moraine ridges indicating the maximum extent of glacier advance during the Little Ice Age. Ice extent was mapped daily using Sentinel-2 satellite imagery, revealing that Wahlenbergfjorden had lost 34% of its year-round sea-ice cover relative to 1938 baseline. The resulting atlas was published by the Norwegian Hydrographic Service and adopted as the official navigation chart set for the region.',
    client: 'Norwegian Polar Institute / Norsk Hydrografisk Tjeneste',
    workType: 'professional',
    scale: '1:10,000 – 1:250,000',
    image:
      'https://images.unsplash.com/photo-1731541261644-0e3c2e30aea9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcmN0aWMlMjBsYW5kc2NhcGUlMjBzdmFsYmFyZCUyMHN1cnZleSUyMHNub3d8ZW58MXx8fHwxNzc2OTQ5Mzc2fDA&ixlib=rb-4.1.0&q=80&w=1080',
    tags: ['Arctic', 'Bathymetry', 'Sea Ice', 'Expedition'],
  },
];

// Final exported list: hand-coded projects first, then CSV-driven ones.
export const projects: Project[] = [...handProjects, ...csvProjects];