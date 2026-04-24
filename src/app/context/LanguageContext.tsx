import { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'en' | 'es';

export interface Translations {
  nav: {
    name: string;
    globe: string;
    projects: string;
    about: string;
  };
  landing: {
    subtitle: string;
    title1: string;
    title2: string;
    arch: string;
    carto: string;
    legendSuffix: string;
  };
  projects: {
    selectedWork: string;
    title: string;
    all: string;
    architecture: string;
    cartography: string;
    noProjects: string;
  };
  detail: {
    back: string;
    year: string;
    location: string;
    client: string;
    workType: string;
    area: string;
    scale: string;
    tags: string;
    coordinates: string;
    relatedProjects: string;
    projectNotFound: string;
    backToProjects: string;
    workTypeProfessional: string;
    workTypeAcademic: string;
    workTypeThesis: string;
  };
  about: {
    label: string;
    subtitle: string;
    bio1: string;
    bio2: string;
    bio3: string;
    experience: string;
    education: string;
    publications: string;
    expertise: string;
    awards: string;
    languages: string;
    cvNote: string;
    cvRequest: string;
  };
  notFound: {
    message: string;
    returnHome: string;
  };
}

const en: Translations = {
  nav: {
    name: 'Pedro Bonilla Artigas',
    globe: 'Globe',
    projects: 'Projects',
    about: 'About',
  },
  landing: {
    subtitle: 'Architecture & Cartography',
    title1: 'A Practice in Space',
    title2: 'and Territory',
    arch: 'Design Projects',
    carto: 'Cartographic Projects',
    legendSuffix: 'projects · hover to preview · click to open',
  },
  projects: {
    selectedWork: 'Selected Work',
    title: 'Projects',
    all: 'All Work',
    architecture: 'Architecture',
    cartography: 'Cartography',
    noProjects: 'No projects found.',
  },
  detail: {
    back: 'Back',
    year: 'Year',
    location: 'Location',
    client: 'Client',
    workType: 'Type',
    area: 'Area',
    scale: 'Scale',
    tags: 'Tags',
    coordinates: 'Coordinates',
    relatedProjects: 'Related Projects',
    projectNotFound: 'Project not found.',
    backToProjects: 'Back to projects',
    workTypeProfessional: 'Professional',
    workTypeAcademic: 'Academic',
    workTypeThesis: 'Thesis',
  },
  about: {
    label: 'About',
    subtitle: 'Architect & Cartographer',
    bio1: 'I work at the intersection of architecture and cartography — two disciplines that share a foundational concern with the representation of space, yet differ radically in scale, method, and audience. My practice spans building design, urban analysis, and territorial survey, often combining these modes within single projects.',
    bio2: 'Based in Rotterdam, I work independently through Mercer Studio and collaborate with public institutions, research universities, and environmental agencies across Europe, the Americas, and the Arctic. My work has been published in academic journals, exhibited at international venues, and implemented in built form from Medellín to Svalbard.',
    bio3: 'My approach is shaped by a conviction that careful spatial documentation — whether through building or map — is a form of attention that has ethical as well as aesthetic dimensions. The act of measuring and representing a place is always also an argument about what matters within it.',
    experience: 'Experience',
    education: 'Education',
    publications: 'Selected Publications',
    expertise: 'Expertise',
    awards: 'Awards & Recognition',
    languages: 'Languages',
    cvNote: 'Full curriculum vitae available upon request.',
    cvRequest: 'Request CV',
  },
  notFound: {
    message: 'Page not found.',
    returnHome: 'Return home',
  },
};

const es: Translations = {
  nav: {
    name: 'Pedro Bonilla Artigas',
    globe: 'Globo',
    projects: 'Proyectos',
    about: 'Acerca',
  },
  landing: {
    subtitle: 'Arquitectura & Cartografía',
    title1: 'Una Práctica en Espacio',
    title2: 'y Territorio',
    arch: 'Proyectos de diseño',
    carto: 'Proyectos cartográficos',
    legendSuffix: 'proyectos · pasar cursor para previsualizar · clic para abrir',
  },
  projects: {
    selectedWork: 'Obra Seleccionada',
    title: 'Proyectos',
    all: 'Todo',
    architecture: 'Arquitectura',
    cartography: 'Cartografía',
    noProjects: 'No se encontraron proyectos.',
  },
  detail: {
    back: 'Volver',
    year: 'Año',
    location: 'Ubicación',
    client: 'Cliente',
    workType: 'Tipo',
    area: 'Área',
    scale: 'Escala',
    tags: 'Etiquetas',
    coordinates: 'Coordenadas',
    relatedProjects: 'Proyectos Relacionados',
    projectNotFound: 'Proyecto no encontrado.',
    backToProjects: 'Volver a proyectos',
    workTypeProfessional: 'Profesional',
    workTypeAcademic: 'Académico',
    workTypeThesis: 'Tesis',
  },
  about: {
    label: 'Acerca',
    subtitle: 'Arquitecto & Cartógrafo',
    bio1: 'Trabajo en la intersección entre arquitectura y cartografía — dos disciplinas que comparten una preocupación fundamental por la representación del espacio, pero difieren radicalmente en escala, método y audiencia. Mi práctica abarca diseño de edificios, análisis urbano y levantamiento territorial, a menudo combinando estos modos en proyectos únicos.',
    bio2: 'Con base en Róterdam, trabajo de forma independiente a través de Mercer Studio y colaboro con instituciones públicas, universidades de investigación y agencias ambientales en Europa, las Américas y el Ártico. Mi trabajo ha sido publicado en revistas académicas, exhibido en espacios internacionales e implementado en forma construida de Medellín a Svalbard.',
    bio3: 'Mi enfoque está moldeado por la convicción de que la documentación espacial cuidadosa — ya sea a través del edificio o del mapa — es una forma de atención con dimensiones éticas además de estéticas. El acto de medir y representar un lugar es siempre también un argumento sobre lo que importa dentro de él.',
    experience: 'Experiencia',
    education: 'Educación',
    publications: 'Publicaciones Seleccionadas',
    expertise: 'Especialización',
    awards: 'Premios y Reconocimientos',
    languages: 'Idiomas',
    cvNote: 'Currículum vitae completo disponible bajo solicitud.',
    cvRequest: 'Solicitar CV',
  },
  notFound: {
    message: 'Página no encontrada.',
    returnHome: 'Volver al inicio',
  },
};

const translations = { en, es };

interface LanguageContextType {
  language: Language;
  t: Translations;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  t: en,
  toggleLanguage: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('portfolio-lang') as Language;
      if (saved === 'en' || saved === 'es') return saved;
    } catch {}
    return 'en';
  });

  const toggleLanguage = () => {
    setLanguage((l) => {
      const next = l === 'en' ? 'es' : 'en';
      try {
        localStorage.setItem('portfolio-lang', next);
      } catch {}
      return next;
    });
  };

  return (
    <LanguageContext.Provider value={{ language, t: translations[language], toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);