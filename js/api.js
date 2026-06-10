// js/api.js

function getFlag(tla) {
  if (!tla) return `<img src="https://flagcdn.com/w80/un.png" class="flag-icon" alt="UN">`;
  const codeMap = {
    // Groupe A
    MEX: "mx", RSA: "za", KOR: "kr", CZE: "cz",
    // Groupe B
    CAN: "ca", BIH: "ba", BOS: "ba", QAT: "qa", SUI: "ch",
    // Groupe C
    BRA: "br", MAR: "ma", MOR: "ma", HAI: "ht", HTI: "ht", SCO: "gb-sct",
    // Groupe D
    USA: "us", PAR: "py", AUS: "au", TUR: "tr",
    // Groupe E
    GER: "de", CUW: "cw", CIV: "ci", ECU: "ec",
    // Groupe F
    NED: "nl", JPN: "jp", SWE: "se", TUN: "tn",
    // Groupe G
    BEL: "be", EGY: "eg", IRN: "ir", NZL: "nz",
    // Groupe H
    ESP: "es", CPV: "cv", KSA: "sa", SAU: "sa", URU: "uy",
    // Groupe L
    ENG: "gb-eng", CRO: "hr", GHA: "gh", PAN: "pa"
  };
  const code = codeMap[tla.toUpperCase()];
  if (!code) {
    return `<img src="https://flagcdn.com/w80/un.png" class="flag-icon" alt="${tla}">`;
  }
  return `<img src="https://flagcdn.com/w80/${code}.png" class="flag-icon" alt="${tla}">`;
}

function translateGroup(groupStr) {
  if (!groupStr) return "";
  // Ex: "GROUP_A" -> "Groupe A"
  return groupStr.replace("GROUP_", "Groupe ");
}

export async function initApi() {
  try {
    const response = await fetch('/api-proxy');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const rawData = await response.json();
    
    // Si l'API renvoie une erreur JSON
    if (rawData.error) {
      throw new Error(rawData.error);
    }

    // Mapper les matchs de la Coupe du Monde 2026 de l'API
    const matches = rawData.matches.map(m => {
      const isLive = m.status === 'IN_PLAY' || m.status === 'PAUSED';
      const isFinished = m.status === 'FINISHED';
      
      const matchDate = new Date(m.utcDate);
      // Heure locale marocaine (Casablanca = UTC+1)
      const timeStr = matchDate.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit', 
        timeZone: 'Africa/Casablanca' 
      });
      const dateStr = matchDate.toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric',
        timeZone: 'Africa/Casablanca'
      });

      return {
        id: m.id,
        homeTeam: m.homeTeam.shortName || m.homeTeam.name,
        awayTeam: m.awayTeam.shortName || m.awayTeam.name,
        homeFlag: m.homeTeam.crest ? `<img src="${m.homeTeam.crest}" class="flag-icon" alt="${m.homeTeam.tla}">` : getFlag(m.homeTeam.tla),
        awayFlag: m.awayTeam.crest ? `<img src="${m.awayTeam.crest}" class="flag-icon" alt="${m.awayTeam.tla}">` : getFlag(m.awayTeam.tla),
        homeScore: m.score.fullTime.home ?? 0,
        awayScore: m.score.fullTime.away ?? 0,
        status: isLive ? 'LIVE' : isFinished ? 'FINISHED' : 'SCHEDULED',
        time: isLive ? "Direct" : timeStr,
        date: dateStr,
        group: translateGroup(m.group),
        stadium: m.venue || "Stade Officiel",
        events: []
      };
    });

    // Mettre à jour dynamiquement les classements du Groupe C si les données sont là
    const groupCStandings = computeGroupStandings(matches, "Groupe C");

    return {
      matches: matches,
      stadiums: getStaticStadiums(),
      moroccoSquad: getStaticSquad(),
      standings: {
        groups: {
          "Groupe C": groupCStandings,
          "Groupe A": computeGroupStandings(matches, "Groupe A")
        },
        scorers: getStaticScorers(),
        assists: getStaticAssists()
      },
      news: getStaticNews()
    };
  } catch (error) {
    console.warn("⚠️ Impossible de joindre l'API de production, chargement des données mockées locales :", error);
    return getFallbackData();
  }
}

// Fonction de calcul des classements en fonction des scores réels
function computeGroupStandings(matches, groupName) {
  const groupMatches = matches.filter(m => m.group === groupName);
  const teamsMap = new Map();

  // Initialiser les équipes du groupe
  if (groupName === "Groupe C") {
    ["Brésil", "Maroc", "Haïti", "Écosse"].forEach(t => teamsMap.set(t, { name: t, flag: getFlag(t === "Brésil" ? "BRA" : t === "Maroc" ? "MAR" : t === "Haïti" ? "HAI" : "SCO"), p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
  } else {
    ["Mexique", "Afrique du Sud", "Corée du Sud", "République Tchèque"].forEach(t => teamsMap.set(t, { name: t, flag: getFlag(t === "Mexique" ? "MEX" : t === "Afrique du Sud" ? "RSA" : t === "Corée du Sud" ? "KOR" : "CZE"), p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
  }

  // Calculer à partir des matchs terminés ou en cours
  groupMatches.forEach(m => {
    if (m.status === 'FINISHED' || m.status === 'LIVE') {
      const home = teamsMap.get(m.homeTeam);
      const away = teamsMap.get(m.awayTeam);
      if (home && away) {
        home.p++;
        away.p++;
        home.gf += m.homeScore;
        home.ga += m.awayScore;
        away.gf += m.awayScore;
        away.ga += m.homeScore;

        if (m.homeScore > m.awayScore) {
          home.w++;
          home.pts += 3;
          away.l++;
        } else if (m.homeScore < m.awayScore) {
          away.w++;
          away.pts += 3;
          home.l++;
        } else {
          home.d++;
          away.d++;
          home.pts += 1;
          away.pts += 1;
        }
      }
    }
  });

  return Array.from(teamsMap.values())
    .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.name.localeCompare(b.name))
    .map((t, idx) => ({
      rank: idx + 1,
      team: t.name,
      flag: t.flag,
      p: t.p,
      w: t.w,
      d: t.d,
      l: t.l,
      gf: t.gf,
      ga: t.ga,
      pts: t.pts
    }));
}

function getStaticStadiums() {
  return [
    { name: "Estadio Azteca", city: "Mexico City", capacity: "87 523", coords: [19.3029, -99.1505], matchesCount: 10 },
    { name: "MetLife Stadium", city: "New York / New Jersey", capacity: "82 500", coords: [40.8135, -74.0743], matchesCount: 8 },
    { name: "SoFi Stadium", city: "Los Angeles", capacity: "70 240", coords: [33.9534, -118.3390], matchesCount: 8 },
    { name: "BMO Field", city: "Toronto", capacity: "45 000", coords: [43.6328, -79.4186], matchesCount: 6 },
    { name: "BC Place", city: "Vancouver", capacity: "54 500", coords: [49.2767, -123.1120], matchesCount: 7 },
    { name: "Estadio Akron", city: "Guadalajara", capacity: "48 071", coords: [20.6817, -103.4627], matchesCount: 4 },
    { name: "Gillette Stadium", city: "Boston", capacity: "65 878", coords: [42.0909, -71.2643], matchesCount: 6 },
    { name: "Mercedes-Benz Stadium", city: "Atlanta", capacity: "71 000", coords: [33.7573, -84.4010], matchesCount: 8 },
    { name: "Hard Rock Stadium", city: "Miami", capacity: "65 326", coords: [25.9580, -80.2389], matchesCount: 7 }
  ];
}

function getStaticSquad() {
  return [
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
  ];
}

function getStaticScorers() {
  return [
    { rank: 1, player: "Vinícius Júnior", team: "Brésil", flag: getFlag("BRA"), goals: 0 },
    { rank: 2, player: "Brahim Díaz", team: "Maroc", flag: getFlag("MAR"), goals: 0 },
    { rank: 3, player: "Santiago Giménez", team: "Mexique", flag: getFlag("MEX"), goals: 0 },
    { rank: 4, player: "Christian Pulisic", team: "États-Unis", flag: getFlag("USA"), goals: 0 }
  ];
}

function getStaticAssists() {
  return [
    { rank: 1, player: "Rodrygo", team: "Brésil", flag: getFlag("BRA"), assists: 0 },
    { rank: 2, player: "Achraf Hakimi", team: "Maroc", flag: getFlag("MAR"), assists: 0 },
    { rank: 3, player: "Hirving Lozano", team: "Mexique", flag: getFlag("MEX"), assists: 0 },
    { rank: 4, player: "Weston McKennie", team: "États-Unis", flag: getFlag("USA"), assists: 0 }
  ];
}

function getStaticNews() {
  return [
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
  ];
}

function getFallbackData() {
  return {
    matches: [
      {
        id: 1,
        homeTeam: "Mexique",
        awayTeam: "Afrique du Sud",
        homeFlag: getFlag("MEX"),
        awayFlag: getFlag("RSA"),
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
        homeFlag: getFlag("KOR"),
        awayFlag: getFlag("CZE"),
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
        homeFlag: getFlag("CAN"),
        awayFlag: getFlag("BIH"),
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
        homeFlag: getFlag("USA"),
        awayFlag: getFlag("PAR"),
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
        homeFlag: getFlag("BRA"),
        awayFlag: getFlag("MAR"),
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
        homeFlag: getFlag("HAI"),
        awayFlag: getFlag("SCO"),
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
        homeFlag: getFlag("AUS"),
        awayFlag: getFlag("TUR"),
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
        homeFlag: getFlag("SCO"),
        awayFlag: getFlag("MAR"),
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
        homeFlag: getFlag("MAR"),
        awayFlag: getFlag("HAI"),
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
    stadiums: getStaticStadiums(),
    moroccoSquad: getStaticSquad(),
    standings: {
      groups: {
        "Groupe C": computeGroupStandings(getStaticMatches(), "Groupe C"),
        "Groupe A": computeGroupStandings(getStaticMatches(), "Groupe A")
      },
      scorers: getStaticScorers(),
      assists: getStaticAssists()
    },
    news: getStaticNews()
  };
}

function getStaticMatches() {
  return getFallbackData().matches;
}

export function getH2HData(home, away) {
  const key = [home, away].sort().join(" vs ");
  const h2hDatabase = {
    "Brésil vs Maroc": [
      { date: "25 Mars 2023", comp: "Match Amical", score: "Maroc 2 - 1 Brésil", details: "Victoire historique des Lions de l'Atlas à Tanger (Boufal 29', Sabiri 79' / Casemiro 67')" },
      { date: "16 Juin 1998", comp: "Coupe du Monde 1998", score: "Brésil 3 - 0 Maroc", details: "Phase de groupes à Nantes (Ronaldo 9', Rivaldo 45', Bebeto 50')" }
    ],
    "Afrique du Sud vs Mexique": [
      { date: "11 Juin 2010", comp: "Coupe du Monde 2010", score: "Afrique du Sud 1 - 1 Mexique", details: "Match d'ouverture historique à Johannesburg (Tshabalala 55' / Márquez 79')" },
      { date: "08 Juillet 2005", comp: "Gold Cup 2005", score: "Mexique 1 - 2 Afrique du Sud", details: "Phase de groupes (Rodriguez 40' / Evans 28', Sibaya 41' pen)" }
    ],
    "Écosse vs Maroc": [
      { date: "23 Juin 1998", comp: "Coupe du Monde 1998", score: "Écosse 0 - 3 Maroc", details: "Phase de groupes à Saint-Étienne. Doublé légendaire de Salaheddine Bassir (22', 85') et but d'Abdeljalil Hadda (46')" },
      { date: "18 Décembre 1996", comp: "Match Amical", score: "Maroc 1 - 1 Écosse", details: "Match de préparation à Casablanca" }
    ],
    "Paraguay vs États-Unis": [
      { date: "11 Juin 2016", comp: "Copa América Centenario", score: "États-Unis 1 - 0 Paraguay", details: "But décisif de Clint Dempsey à Philadelphie" },
      { date: "29 Mars 2011", comp: "Match Amical", score: "États-Unis 0 - 1 Paraguay", details: "Match amical disputé à Nashville" }
    ],
    "Corée du Sud vs République Tchèque": [
      { date: "05 Juin 2016", comp: "Match Amical", score: "République Tchèque 1 - 2 Corée du Sud", details: "Victoire coréenne à Prague" },
      { date: "15 Août 2001", comp: "Match Amical", score: "République Tchèque 5 - 0 Corée du Sud", details: "Match amical à Drnovice" }
    ],
    "Haïti vs Maroc": [
      { date: "17 Avril 2002", comp: "Match Amical", score: "Maroc 0 - 0 Haïti", details: "Rencontre amicale disputée à Rabat" }
    ]
  };

  return h2hDatabase[key] || [
    { date: "Rencontre Inédite", comp: "Coupe du Monde 2026", score: `${home} vs ${away}`, details: "Ces deux équipes ne se sont jamais affrontées dans l'histoire officielle du football." }
  ];
}
