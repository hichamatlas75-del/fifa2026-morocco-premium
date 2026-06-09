export async function initApi() {
  return {
    matches: [
      {
        id: 1,
        homeTeam: "Mexique",
        awayTeam: "Afrique du Sud",
        homeFlag: "🇲🇽",
        awayFlag: "🇿🇦",
        homeScore: 0,
        awayScore: 0,
        status: "LIVE",
        time: "5'",
        date: "11 Juin 2026",
        group: "Groupe A",
        stadium: "Estadio Azteca, Mexico City",
        events: []
      },
      {
        id: 2,
        homeTeam: "Corée du Sud",
        awayTeam: "République Tchèque",
        homeFlag: "🇰🇷",
        awayFlag: "🇨🇿",
        homeScore: 0,
        awayScore: 0,
        status: "SCHEDULED",
        time: "03:00",
        date: "12 Juin 2026",
        group: "Groupe A",
        stadium: "Estadio Akron, Guadalajara",
        events: []
      },
      {
        id: 3,
        homeTeam: "Canada",
        awayTeam: "Bosnie-Herzégovine",
        homeFlag: "🇨🇦",
        awayFlag: "🇧🇦",
        homeScore: 0,
        awayScore: 0,
        status: "SCHEDULED",
        time: "20:00",
        date: "12 Juin 2026",
        group: "Groupe B",
        stadium: "BMO Field, Toronto",
        events: []
      },
      {
        id: 4,
        homeTeam: "États-Unis",
        awayTeam: "Paraguay",
        homeFlag: "🇺🇸",
        awayFlag: "🇵🇾",
        homeScore: 0,
        awayScore: 0,
        status: "SCHEDULED",
        time: "02:00",
        date: "13 Juin 2026",
        group: "Groupe D",
        stadium: "SoFi Stadium, Los Angeles",
        events: []
      },
      {
        id: 5,
        homeTeam: "Brésil",
        awayTeam: "Maroc",
        homeFlag: "🇧🇷",
        awayFlag: "🇲🇦",
        homeScore: 0,
        awayScore: 0,
        status: "SCHEDULED",
        time: "23:00",
        date: "13 Juin 2026",
        group: "Groupe C",
        stadium: "MetLife Stadium, New York / New Jersey",
        events: []
      },
      {
        id: 6,
        homeTeam: "Haïti",
        awayTeam: "Écosse",
        homeFlag: "🇭🇹",
        awayFlag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
        homeScore: 0,
        awayScore: 0,
        status: "SCHEDULED",
        time: "02:00",
        date: "14 Juin 2026",
        group: "Groupe C",
        stadium: "Gillette Stadium, Boston",
        events: []
      },
      {
        id: 7,
        homeTeam: "Australie",
        awayTeam: "Turquie",
        homeFlag: "🇦🇺",
        awayFlag: "🇹🇷",
        homeScore: 0,
        awayScore: 0,
        status: "SCHEDULED",
        time: "05:00",
        date: "14 Juin 2026",
        group: "Groupe D",
        stadium: "BC Place, Vancouver",
        events: []
      },
      {
        id: 8,
        homeTeam: "Écosse",
        awayTeam: "Maroc",
        homeFlag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
        awayFlag: "🇲🇦",
        homeScore: 0,
        awayScore: 0,
        status: "SCHEDULED",
        time: "23:00",
        date: "19 Juin 2026",
        group: "Groupe C",
        stadium: "Gillette Stadium, Boston",
        events: []
      },
      {
        id: 9,
        homeTeam: "Maroc",
        awayTeam: "Haïti",
        homeFlag: "🇲🇦",
        awayFlag: "🇭🇹",
        homeScore: 0,
        awayScore: 0,
        status: "SCHEDULED",
        time: "23:00",
        date: "24 Juin 2026",
        group: "Groupe C",
        stadium: "Mercedes-Benz Stadium, Atlanta",
        events: []
      }
    ],
    stadiums: [
      { name: "Estadio Azteca", city: "Mexico City", capacity: "87 523", coords: [19.3029, -99.1505], matchesCount: 10 },
      { name: "MetLife Stadium", city: "New York / New Jersey", capacity: "82 500", coords: [40.8135, -74.0743], matchesCount: 8 },
      { name: "SoFi Stadium", city: "Los Angeles", capacity: "70 240", coords: [33.9534, -118.3390], matchesCount: 8 },
      { name: "BMO Field", city: "Toronto", capacity: "45 000", coords: [43.6328, -79.4186], matchesCount: 6 },
      { name: "BC Place", city: "Vancouver", capacity: "54 500", coords: [49.2767, -123.1120], matchesCount: 7 },
      { name: "Estadio Akron", city: "Guadalajara", capacity: "48 071", coords: [20.6817, -103.4627], matchesCount: 4 },
      { name: "Gillette Stadium", city: "Boston", capacity: "65 878", coords: [42.0909, -71.2643], matchesCount: 6 },
      { name: "Mercedes-Benz Stadium", city: "Atlanta", capacity: "71 000", coords: [33.7573, -84.4010], matchesCount: 8 },
      { name: "Hard Rock Stadium", city: "Miami", capacity: "65 326", coords: [25.9580, -80.2389], matchesCount: 7 }
    ],
    moroccoSquad: [
      { name: "Yassine Bounou", pos: "Gardiens", num: 1, club: "Al-Hilal" },
      { name: "Achraf Hakimi", pos: "Défenseurs", num: 2, club: "PSG" },
      { name: "Nayef Aguerd", pos: "Défenseurs", num: 5, club: "Real Sociedad" },
      { name: "Chadi Riad", pos: "Défenseurs", num: 6, club: "Crystal Palace" },
      { name: "Noussair Mazraoui", pos: "Défenseurs", num: 3, club: "Manchester United" },
      { name: "Sofyan Amrabat", pos: "Milieux", num: 4, club: "Fenerbahçe" },
      { name: "Azzedine Ounahi", pos: "Milieux", num: 8, club: "Panathinaikos" },
      { name: "Brahim Díaz", pos: "Attaquants", num: 10, club: "Real Madrid" },
      { name: "Hakim Ziyech", pos: "Attaquants", num: 7, club: "Galatasaray" },
      { name: "Eliesse Ben Seghir", pos: "Milieux", num: 11, club: "Monaco" },
      { name: "Soufiane Rahimi", pos: "Attaquants", num: 9, club: "Al-Ain" }
    ],
    standings: {
      groups: {
        "Groupe C": [
          { rank: 1, team: "Brésil", flag: "🇧🇷", p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 },
          { rank: 2, team: "Maroc", flag: "🇲🇦", p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 },
          { rank: 3, team: "Haïti", flag: "🇭🇹", p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 },
          { rank: 4, team: "Écosse", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }
        ],
        "Groupe A": [
          { rank: 1, team: "Mexique", flag: "🇲🇽", p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 },
          { rank: 2, team: "Afrique du Sud", flag: "🇿🇦", p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 },
          { rank: 3, team: "Corée du Sud", flag: "🇰🇷", p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 },
          { rank: 4, team: "République Tchèque", flag: "🇨🇿", p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }
        ]
      },
      scorers: [
        { rank: 1, player: "Vinícius Júnior", team: "Brésil", flag: "🇧🇷", goals: 0 },
        { rank: 2, player: "Brahim Díaz", team: "Maroc", flag: "🇲🇦", goals: 0 },
        { rank: 3, player: "Santiago Giménez", team: "Mexique", flag: "🇲🇽", goals: 0 },
        { rank: 4, player: "Christian Pulisic", team: "États-Unis", flag: "🇺🇸", goals: 0 }
      ],
      assists: [
        { rank: 1, player: "Rodrygo", team: "Brésil", flag: "🇧🇷", assists: 0 },
        { rank: 2, player: "Achraf Hakimi", team: "Maroc", flag: "🇲🇦", assists: 0 },
        { rank: 3, player: "Hirving Lozano", team: "Mexique", flag: "🇲🇽", assists: 0 },
        { rank: 4, player: "Weston McKennie", team: "États-Unis", flag: "🇺🇸", assists: 0 }
      ]
    },
    news: [
      {
        id: 1,
        title: "Le match d'ouverture Mexique vs Afrique du Sud demain à 20:00 (heure marocaine)",
        summary: "Le coup d'envoi de la Coupe du Monde 2026 sera donné dans le temple historique du football mexicain, l'Azteca.",
        image: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=600&auto=format&fit=crop",
        date: "10 Juin 2026"
      },
      {
        id: 2,
        title: "Le Maroc face au géant brésilien au MetLife Stadium le 13 juin",
        summary: "Prévu à 23:00 heure du Maroc, Walid Regragui prépare un plan tactique ultra-compact pour faire face à la Seleção.",
        image: "https://images.unsplash.com/photo-1518063319789-7217e6706b04?q=80&w=600&auto=format&fit=crop",
        date: "10 Juin 2026"
      },
      {
        id: 3,
        title: "Les Lions de l'Atlas s'entraînent à New York devant des milliers de fans",
        summary: "Une ambiance surchauffée et un soutien indéfectible de la communauté marocaine d'Amérique.",
        image: "https://images.unsplash.com/photo-1459865264687-595d652de67e?q=80&w=600&auto=format&fit=crop",
        date: "09 Juin 2026"
      }
    ]
  };
}
