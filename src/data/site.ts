// Single source of truth for profile content. Mirrors the CV in ~/Downloads/JOB.

export const site = {
  name: 'Amirassyl Sagyndyk',
  shortName: 'Amirassyl',
  title: 'Amirassyl',
  description:
    'Computational Sciences student at Minerva University. I build interactive web experiences and numerical models. Open to software internships for summer 2027.',
  url: 'https://amirassyl.dev',
  email: 'amirassyl@uni.minerva.edu',
  location: 'Tokyo this year · San Francisco for summer 2027',
  links: {
    github: 'https://github.com/amirassyl',
    linkedin: 'https://www.linkedin.com/in/amirassyl',
    telegram: 'https://t.me/amirassyl',
  },
  status: 'Open to software engineering internships, summer 2027',
};

export interface Role {
  org: string;
  role: string;
  period: string;
  points: string[];
}

export const experience: Role[] = [
  {
    org: 'Exploratorium',
    role: 'Software Engineer, Civic Project Partnership (via Minerva University)',
    period: 'Sep 2025 – May 2026',
    points: [
      'Built the interactive front end for a museum exhibit prototype in a team of five, coordinating real-time input from camera, microphone, and dynamic UI.',
      'Integrated ElevenLabs voice synthesis and MediaPipe pose tracking into one front-end event loop that turns visitor gestures and speech into UI animation.',
      'Delivered a working prototype to the Exploratorium for internal review, working with research fellows to wireframe and implement visitor journeys.',
    ],
  },
  {
    org: 'Minerva University',
    role: 'Mathematics Research Assistant',
    period: 'Sep 2025 – May 2026',
    points: [
      'Developed and ran Python numerical solvers for Navier–Stokes boundary-value problems, modeling non-wetting droplet rebound across viscosity and impact-velocity conditions.',
    ],
  },
  {
    org: 'Yale University',
    role: 'Yale Young Global Scholars Program Fellow',
    period: 'Jun 2026 – Aug 2026',
    points: [
      'Mentored 750+ international high-school students across three academic sessions and coordinated campus-wide programming, including a competitive speaker series.',
    ],
  },
  {
    org: 'xCellence Robotics',
    role: 'Programmer, FIRST Robotics Team',
    period: 'Sep 2023 – Jun 2024',
    points: [
      'Wrote C/C++ control logic and hardware–software interfaces for Arduino-based robots; the team earned the FIRST Championship Design Award (Central Asia) and a Samsung Solve for Tomorrow semifinalist placement.',
      'Produced technical explainer videos on robot logic and design that won the Social Media Challenge (190K+ views).',
    ],
  },
];

export const education = [
  {
    org: 'Minerva University',
    detail: 'B.S. Computational Sciences',
    period: 'Expected May 2029',
    points: [
      'Coursework: Probability and Statistics, Discrete Math, Computational Modeling, Game Theory, Data Structures and Algorithms, Single and Multivariable Calculus, Linear Algebra.',
    ],
  },
  {
    org: 'Nazarbayev Intellectual School of Physics and Mathematics',
    detail: 'Further Math, Physics, Computer Science · GPA 4.98 / 5.00',
    period: 'May 2025',
    points: [
      "'Orken' Presidential full-ride merit scholarship.",
      'ISHR (Germany) merit exchange, top 15 of 400 students.',
      'Johns Hopkins Center for Talented Youth: Mathematical Modeling (Game of Life).',
    ],
  },
];

export const skills = [
  { group: 'Languages', items: ['Python', 'C/C++', 'SQL', 'JavaScript', 'HTML/CSS'] },
  {
    group: 'Frameworks & tools',
    items: ['React', 'Three.js', 'React Three Fiber', 'WebGL', 'Node.js', 'Git', 'NumPy', 'Pandas', 'SciPy', 'Matplotlib'],
  },
  { group: 'Human languages', items: ['English (fluent)', 'Kazakh (native)', 'Russian (native)', 'German (beginner)'] },
];
