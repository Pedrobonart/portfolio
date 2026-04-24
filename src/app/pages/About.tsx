import { Mail, MapPin, ExternalLink } from 'lucide-react';
import { type ReactNode } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

const profileImage =
  'https://images.unsplash.com/photo-1619799090425-0efe92bd62a7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcmNoaXRlY3QlMjBwb3J0cmFpdCUyMHN0dWRpbyUyMHByb2Zlc3Npb25hbHxlbnwxfHx8fDE3NzY5NDkzODV8MA&ixlib=rb-4.1.0&q=80&w=1080';

const education = [
  {
    degree: 'MSc Architecture',
    institution: 'TU Delft',
    location: 'Delft, Netherlands',
    year: '2013 – 2015',
    note: 'Cum Laude · Thesis: "Cartographic Instruments in Urban Design Practice"',
  },
  {
    degree: 'BSc Architecture & Urban Studies',
    institution: 'ETH Zürich',
    location: 'Zürich, Switzerland',
    year: '2010 – 2013',
    note: 'Exchange semester at ETSAB Barcelona, 2012',
  },
];

const experience = [
  {
    role: 'Principal',
    firm: 'Mercer Studio',
    location: 'Rotterdam, NL',
    period: '2018 – Present',
    description:
      'Independent architectural and cartographic practice working across scales, from territorial survey to building detail. Projects in Europe, South America, and the Arctic.',
  },
  {
    role: 'Associate Architect',
    firm: 'OMA / Office for Metropolitan Architecture',
    location: 'Rotterdam, NL',
    period: '2015 – 2018',
    description:
      'Core team member on cultural and civic projects in the Netherlands, Portugal, and South Korea. Responsible for design development and production coordination.',
  },
  {
    role: 'Cartographic Researcher',
    firm: 'Instituto Geográfico Nacional',
    location: 'Madrid, Spain',
    period: '2013 – 2015',
    description:
      'Topographic survey and map production for the national base cartography program. Specialist in historical map digitization and georeferencing.',
  },
];

const awards = [
  { year: 2024, name: 'AR Future Projects Award', body: 'Architectural Review' },
  { year: 2023, name: 'European Prize for Urban Public Space', body: 'CCCB / EU' },
  { year: 2022, name: 'AZ Awards Honorable Mention', body: 'Azure Magazine' },
  { year: 2021, name: 'Mapbox Community Fellow', body: 'Mapbox, Inc.' },
  { year: 2019, name: 'Nordic Spatial Award', body: 'Nordic Council of Ministers' },
];

const skills = {
  Architecture: [
    'Parametric Design',
    'Urban Planning',
    'Building Information Modelling',
    'Sustainable Design',
    'Heritage Conservation',
    'Construction Documentation',
  ],
  Cartography: [
    'Geographic Information Systems',
    'Remote Sensing',
    'LiDAR Processing',
    'Spatial Analysis',
    'Historical Mapping',
    'Bathymetric Survey',
  ],
  Software: [
    'ArchiCAD',
    'Rhino / Grasshopper',
    'QGIS / ArcGIS Pro',
    'AutoCAD',
    'Adobe Creative Suite',
    'Python / GeoPandas',
  ],
};

const publications = [
  {
    title: 'Cartographic Instruments in Contemporary Architectural Practice',
    journal: 'Architectural Histories',
    year: 2023,
  },
  {
    title:
      'The Forma Urbis Reconsidered: Digital Methods and Historical Cartography',
    journal: 'Imago Mundi: International Journal of the History of Cartography',
    year: 2022,
  },
  {
    title: 'Mapping Glacial Recession: A Methodological Survey',
    journal: 'The Cartographic Journal',
    year: 2020,
  },
];

export function About() {
  const { isDark } = useTheme();
  const { t } = useLanguage();

  return (
    <div
      className="min-h-screen pt-16"
      style={{ background: 'var(--site-bg)' }}
    >
      {/* Hero */}
      <div
        className="px-8 md:px-16 pt-16 pb-16"
        style={{ borderBottom: '1px solid var(--site-border)' }}
      >
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-12 md:gap-16 items-start">
          {/* Photo */}
          <div
            className="md:col-span-2"
            style={{ opacity: 0, animation: 'pageFadeIn 0.5s ease forwards' }}
          >
            <div
              className="overflow-hidden"
              style={{
                aspectRatio: '3/4',
                maxHeight: 480,
                background: 'var(--site-surface2)',
              }}
            >
              <img
                src={profileImage}
                alt="Alex Mercer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Intro */}
          <div
            className="md:col-span-3 flex flex-col justify-center"
            style={{
              opacity: 0,
              animation: 'pageFadeIn 0.5s ease 0.1s forwards',
            }}
          >
            <p
              className="tracking-[0.2em] uppercase mb-4"
              style={{
                fontSize: '0.65rem',
                fontFamily: 'var(--font-sans)',
                color: 'var(--site-muted)',
              }}
            >
              {t.about.label}
            </p>
            <h1
              className="mb-2"
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(2.2rem, 4vw, 3.2rem)',
                fontWeight: 400,
                lineHeight: 1.1,
                color: 'var(--site-text)',
              }}
            >
              {t.nav.name}
            </h1>
            <p
              className="mb-8 tracking-[0.12em] uppercase"
              style={{
                fontSize: '0.72rem',
                fontFamily: 'var(--font-sans)',
                color: 'var(--site-muted)',
              }}
            >
              {t.about.subtitle}
            </p>

            <div
              className="w-10 h-px mb-8"
              style={{ background: 'var(--site-text)' }}
            />

            <div className="space-y-5">
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.92rem',
                  lineHeight: 1.8,
                  color: 'var(--site-text2)',
                }}
              >
                {t.about.bio1}
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.88rem',
                  lineHeight: 1.85,
                  color: 'var(--site-muted)',
                }}
              >
                {t.about.bio2}
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.88rem',
                  lineHeight: 1.85,
                  color: 'var(--site-muted)',
                }}
              >
                {t.about.bio3}
              </p>
            </div>

            {/* Contact */}
            <div className="mt-10 flex flex-col gap-3">
              <a
                href="mailto:hello@alexmercer.com"
                className="flex items-center gap-2 w-fit transition-colors duration-200"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.82rem',
                  color: 'var(--site-text)',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.color =
                    'var(--site-arch)')
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.color =
                    'var(--site-text)')
                }
              >
                <Mail size={13} strokeWidth={1.5} />
                hello@alexmercer.com
              </a>
              <div
                className="flex items-center gap-2"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.82rem',
                  color: 'var(--site-muted)',
                }}
              >
                <MapPin size={13} strokeWidth={1.5} />
                Rotterdam, Netherlands
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main CV Content */}
      <div className="px-8 md:px-16 py-16 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-20">
          {/* Left column */}
          <div className="md:col-span-2 space-y-16">
            {/* Experience */}
            <Section title={t.about.experience}>
              <div className="space-y-10">
                {experience.map((exp, i) => (
                  <div
                    key={i}
                    style={{
                      opacity: 0,
                      animation: `pageFadeIn 0.35s ease ${i * 70}ms forwards`,
                    }}
                  >
                    <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-1 mb-2">
                      <div>
                        <span
                          style={{
                            fontFamily: 'var(--font-sans)',
                            fontSize: '0.9rem',
                            fontWeight: 500,
                            color: 'var(--site-text)',
                          }}
                        >
                          {exp.role}
                        </span>
                        <span
                          style={{
                            fontFamily: 'var(--font-sans)',
                            fontSize: '0.9rem',
                            color: 'var(--site-muted)',
                            margin: '0 6px',
                          }}
                        >
                          —
                        </span>
                        <span
                          style={{
                            fontFamily: 'var(--font-sans)',
                            fontSize: '0.9rem',
                            color: 'var(--site-text2)',
                          }}
                        >
                          {exp.firm}
                        </span>
                      </div>
                      <span
                        className="tracking-[0.05em] whitespace-nowrap"
                        style={{
                          fontSize: '0.72rem',
                          fontFamily: 'var(--font-sans)',
                          color: 'var(--site-muted)',
                        }}
                      >
                        {exp.period}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: '0.7rem',
                        fontFamily: 'var(--font-sans)',
                        marginBottom: 4,
                        color: 'var(--site-muted)',
                      }}
                    >
                      {exp.location}
                    </p>
                    <p
                      style={{
                        fontSize: '0.82rem',
                        fontFamily: 'var(--font-sans)',
                        lineHeight: 1.75,
                        color: 'var(--site-muted)',
                      }}
                    >
                      {exp.description}
                    </p>
                  </div>
                ))}
              </div>
            </Section>

            {/* Education */}
            <Section title={t.about.education}>
              <div className="space-y-8">
                {education.map((edu, i) => (
                  <div key={i}>
                    <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-1 mb-1">
                      <span
                        style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: '0.9rem',
                          fontWeight: 500,
                          color: 'var(--site-text)',
                        }}
                      >
                        {edu.degree}
                      </span>
                      <span
                        className="tracking-[0.05em]"
                        style={{
                          fontSize: '0.72rem',
                          fontFamily: 'var(--font-sans)',
                          color: 'var(--site-muted)',
                        }}
                      >
                        {edu.year}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: '0.82rem',
                        fontFamily: 'var(--font-sans)',
                        color: 'var(--site-text2)',
                      }}
                    >
                      {edu.institution} · {edu.location}
                    </p>
                    <p
                      className="mt-1"
                      style={{
                        fontSize: '0.78rem',
                        fontFamily: 'var(--font-sans)',
                        lineHeight: 1.65,
                        color: 'var(--site-muted)',
                      }}
                    >
                      {edu.note}
                    </p>
                  </div>
                ))}
              </div>
            </Section>

            {/* Publications */}
            <Section title={t.about.publications}>
              <div className="space-y-6">
                {publications.map((pub, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <span
                      className="shrink-0 mt-px tabular-nums"
                      style={{
                        fontSize: '0.72rem',
                        fontFamily: 'var(--font-sans)',
                        color: 'var(--site-muted)',
                      }}
                    >
                      {pub.year}
                    </span>
                    <div>
                      <p
                        style={{
                          fontFamily: 'var(--font-serif)',
                          fontSize: '0.95rem',
                          lineHeight: 1.45,
                          color: 'var(--site-text)',
                        }}
                      >
                        "{pub.title}"
                      </p>
                      <p
                        className="mt-0.5"
                        style={{
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-sans)',
                          color: 'var(--site-muted)',
                        }}
                      >
                        {pub.journal}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          {/* Right column */}
          <div className="md:col-span-1 space-y-14">
            {/* Skills */}
            <Section title={t.about.expertise}>
              <div className="space-y-8">
                {Object.entries(skills).map(([category, items]) => (
                  <div key={category}>
                    <p
                      className="mb-3"
                      style={{
                        fontSize: '0.78rem',
                        fontFamily: 'var(--font-sans)',
                        fontWeight: 500,
                        color: 'var(--site-text)',
                      }}
                    >
                      {category}
                    </p>
                    <ul className="space-y-2">
                      {items.map((skill) => (
                        <li
                          key={skill}
                          className="flex items-start gap-2"
                          style={{
                            fontSize: '0.78rem',
                            fontFamily: 'var(--font-sans)',
                            lineHeight: 1.5,
                            color: 'var(--site-muted)',
                          }}
                        >
                          <span style={{ color: 'var(--site-arch)', marginTop: 6 }}>
                            —
                          </span>
                          {skill}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>

            {/* Awards */}
            <Section title={t.about.awards}>
              <div className="space-y-5">
                {awards.map((award, i) => (
                  <div key={i}>
                    <p
                      style={{
                        fontSize: '0.82rem',
                        fontFamily: 'var(--font-sans)',
                        lineHeight: 1.45,
                        color: 'var(--site-text)',
                      }}
                    >
                      {award.name}
                    </p>
                    <p
                      style={{
                        fontSize: '0.7rem',
                        fontFamily: 'var(--font-sans)',
                        color: 'var(--site-muted)',
                      }}
                    >
                      {award.year} · {award.body}
                    </p>
                  </div>
                ))}
              </div>
            </Section>

            {/* Languages */}
            <Section title={t.about.languages}>
              <div className="space-y-2">
                {[
                  { lang: 'English', level: 'Native' },
                  { lang: 'Dutch', level: 'Fluent' },
                  { lang: 'Spanish', level: 'Fluent' },
                  { lang: 'Portuguese', level: 'Intermediate' },
                  { lang: 'German', level: 'Basic' },
                ].map(({ lang, level }) => (
                  <div key={lang} className="flex items-baseline justify-between">
                    <span
                      style={{
                        fontSize: '0.82rem',
                        fontFamily: 'var(--font-sans)',
                        color: 'var(--site-text)',
                      }}
                    >
                      {lang}
                    </span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontFamily: 'var(--font-sans)',
                        color: 'var(--site-muted)',
                      }}
                    >
                      {level}
                    </span>
                  </div>
                ))}
              </div>
            </Section>

            {/* CV Download */}
            <div
              className="p-5"
              style={{ border: `1px solid var(--site-text)` }}
            >
              <p
                className="mb-3"
                style={{
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--site-text)',
                }}
              >
                {t.about.cvNote}
              </p>
              <a
                href="mailto:hello@alexmercer.com?subject=CV Request"
                className="flex items-center gap-2 transition-colors duration-200"
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--site-text)',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = 'var(--site-arch)')
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = 'var(--site-text)')
                }
              >
                <ExternalLink size={11} strokeWidth={1.5} />
                {t.about.cvRequest}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-5 mb-8">
        <p
          className="tracking-[0.2em] uppercase whitespace-nowrap"
          style={{
            fontSize: '0.6rem',
            fontFamily: 'var(--font-sans)',
            color: 'var(--site-muted)',
          }}
        >
          {title}
        </p>
        <div className="flex-1 h-px" style={{ background: 'var(--site-border)' }} />
      </div>
      {children}
    </section>
  );
}