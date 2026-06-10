// js/api.js

export function getFlag(tla) {
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
        homeTla: m.homeTeam.tla || "UN",
        awayTla: m.awayTeam.tla || "UN",
        homeFlag: m.homeTeam.crest ? `<img src="${m.homeTeam.crest}" class="flag-icon" alt="${m.homeTeam.tla}">` : getFlag(m.homeTeam.tla),
        awayFlag: m.awayTeam.crest ? `<img src="${m.awayTeam.crest}" class="flag-icon" alt="${m.awayTeam.tla}">` : getFlag(m.awayTeam.tla),
        homeScore: m.score.fullTime.home ?? 0,
        awayScore: m.score.fullTime.away ?? 0,
        status: isLive ? 'LIVE' : isFinished ? 'FINISHED' : 'SCHEDULED',
        time: isLive ? "Direct" : timeStr,
        date: dateStr,
        group: translateGroup(m.group),
        stadium: getStadiumForMatch(
          m.homeTeam.name || m.homeTeam.shortName,
          m.awayTeam.name || m.awayTeam.shortName,
          m.group,
          m.id
        ),
        events: []
      };
    });

    // Mettre à jour dynamiquement les classements du Groupe C si les données sont là
    const groupCStandings = computeGroupStandings(matches, "Groupe C");
    const groupAStandings = computeGroupStandings(matches, "Groupe A");

    return {
      matches: matches,
      stadiums: getStaticStadiums(),
      moroccoSquad: getStaticSquad(),
      standings: {
        groups: {
          "Groupe C": groupCStandings,
          "Groupe A": groupAStandings
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

// Fonction de calcul des classements en fonction des scores réels (basée sur les TLA uniques et robustes)
function computeGroupStandings(matches, groupName) {
  // Traduire le nom du groupe en français pour la comparaison si nécessaire
  const groupMatches = matches.filter(m => m.group === groupName || m.group === groupName.replace("Groupe", "Group"));
  const teamsMap = new Map();

  // Initialiser les équipes du groupe à l'aide de leur TLA unique
  if (groupName.includes("C")) {
    ["BRA", "MAR", "HAI", "SCO"].forEach(tla => {
      teamsMap.set(tla, { tla: tla, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
    });
  } else {
    ["MEX", "RSA", "KOR", "CZE"].forEach(tla => {
      teamsMap.set(tla, { tla: tla, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
    });
  }

  // Calculer à partir des matchs terminés ou en cours
  groupMatches.forEach(m => {
    if (m.status === 'FINISHED' || m.status === 'LIVE') {
      const home = teamsMap.get(m.homeTla);
      const away = teamsMap.get(m.awayTla);
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
    .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.tla.localeCompare(b.tla))
    .map((t, idx) => ({
      rank: idx + 1,
      tla: t.tla,
      p: t.p,
      w: t.w,
      d: t.d,
      l: t.l,
      gf: t.gf,
      ga: t.ga,
      pts: t.pts
    }));
}

// Les 16 stades officiels du tournoi FIFA 2026 (sans sponsor commercial, avec coordonnées exactes)
export function getStaticStadiums() {
  return [
    // Canada (2)
    { name: "BC Place", city: "Vancouver", capacity: "54 500", coords: [49.2767, -123.1120], matchesCount: 7 },
    { name: "Toronto Stadium", city: "Toronto", capacity: "45 000", coords: [43.6328, -79.4186], matchesCount: 6 },
    
    // Mexique (3)
    { name: "Mexico City Stadium", city: "Mexico City", capacity: "87 523", coords: [19.3029, -99.1505], matchesCount: 10 },
    { name: "Guadalajara Stadium", city: "Guadalajara", capacity: "48 071", coords: [20.6817, -103.4627], matchesCount: 4 },
    { name: "Monterrey Stadium", city: "Monterrey", capacity: "53 500", coords: [25.6701, -100.2447], matchesCount: 4 },
    
    // États-Unis (11)
    { name: "Atlanta Stadium", city: "Atlanta", capacity: "71 000", coords: [33.7573, -84.4010], matchesCount: 8 },
    { name: "Boston Stadium", city: "Boston", capacity: "65 878", coords: [42.0909, -71.2643], matchesCount: 6 },
    { name: "Dallas Stadium", city: "Dallas", capacity: "94 000", coords: [32.7473, -97.0945], matchesCount: 9 },
    { name: "Houston Stadium", city: "Houston", capacity: "72 220", coords: [29.6847, -95.4081], matchesCount: 7 },
    { name: "Kansas City Stadium", city: "Kansas City", capacity: "76 416", coords: [39.0489, -94.4839], matchesCount: 6 },
    { name: "Los Angeles Stadium", city: "Los Angeles", capacity: "70 240", coords: [33.9534, -118.3390], matchesCount: 8 },
    { name: "Miami Stadium", city: "Miami", capacity: "64 767", coords: [25.9580, -80.2389], matchesCount: 7 },
    { name: "New York New Jersey Stadium", city: "New York / New Jersey", capacity: "82 500", coords: [40.8135, -74.0743], matchesCount: 8 },
    { name: "Philadelphia Stadium", city: "Philadelphia", capacity: "69 796", coords: [39.9012, -75.1675], matchesCount: 6 },
    { name: "San Francisco Bay Area Stadium", city: "San Francisco", capacity: "68 500", coords: [37.4032, -121.9698], matchesCount: 6 },
    { name: "Seattle Stadium", city: "Seattle", capacity: "69 000", coords: [47.5952, -122.3316], matchesCount: 6 }
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
  const matches = [
    {
      id: 1,
      homeTeam: "Mexique",
      awayTeam: "Afrique du Sud",
      homeTla: "MEX",
      awayTla: "RSA",
      homeFlag: getFlag("MEX"),
      awayFlag: getFlag("RSA"),
      homeScore: 0,
      awayScore: 0,
      status: "LIVE",
      time: "5'",
      date: "11 Juin 2026",
      group: "Groupe A",
      stadium: "Mexico City Stadium",
      events: []
    },
    {
      id: 2,
      homeTeam: "Corée du Sud",
      awayTeam: "République Tchèque",
      homeTla: "KOR",
      awayTla: "CZE",
      homeFlag: getFlag("KOR"),
      awayFlag: getFlag("CZE"),
      homeScore: 0,
      awayScore: 0,
      status: "SCHEDULED",
      time: "03:00",
      date: "12 Juin 2026",
      group: "Groupe A",
      stadium: "Guadalajara Stadium",
      events: []
    },
    {
      id: 3,
      homeTeam: "Canada",
      awayTeam: "Bosnie-Herzégovine",
      homeTla: "CAN",
      awayTla: "BIH",
      homeFlag: getFlag("CAN"),
      awayFlag: getFlag("BIH"),
      homeScore: 0,
      awayScore: 0,
      status: "SCHEDULED",
      time: "20:00",
      date: "12 Juin 2026",
      group: "Groupe B",
      stadium: "Toronto Stadium",
      events: []
    },
    {
      id: 4,
      homeTeam: "États-Unis",
      awayTeam: "Paraguay",
      homeTla: "USA",
      awayTla: "PAR",
      homeFlag: getFlag("USA"),
      awayFlag: getFlag("PAR"),
      homeScore: 0,
      awayScore: 0,
      status: "SCHEDULED",
      time: "02:00",
      date: "13 Juin 2026",
      group: "Groupe D",
      stadium: "Los Angeles Stadium",
      events: []
    },
    {
      id: 5,
      homeTeam: "Brésil",
      awayTeam: "Maroc",
      homeTla: "BRA",
      awayTla: "MAR",
      homeFlag: getFlag("BRA"),
      awayFlag: getFlag("MAR"),
      homeScore: 0,
      awayScore: 0,
      status: "SCHEDULED",
      time: "23:00",
      date: "13 Juin 2026",
      group: "Groupe C",
      stadium: "New York New Jersey Stadium",
      events: []
    },
    {
      id: 6,
      homeTeam: "Haïti",
      awayTeam: "Écosse",
      homeTla: "HAI",
      awayTla: "SCO",
      homeFlag: getFlag("HAI"),
      awayFlag: getFlag("SCO"),
      homeScore: 0,
      awayScore: 0,
      status: "SCHEDULED",
      time: "02:00",
      date: "14 Juin 2026",
      group: "Groupe C",
      stadium: "Boston Stadium",
      events: []
    },
    {
      id: 7,
      homeTeam: "Australie",
      awayTeam: "Turquie",
      homeTla: "AUS",
      awayTla: "TUR",
      homeFlag: getFlag("AUS"),
      awayFlag: getFlag("TUR"),
      homeScore: 0,
      awayScore: 0,
      status: "SCHEDULED",
      time: "05:00",
      date: "14 Juin 2026",
      group: "Groupe D",
      stadium: "BC Place",
      events: []
    },
    {
      id: 8,
      homeTeam: "Écosse",
      awayTeam: "Maroc",
      homeTla: "SCO",
      awayTla: "MAR",
      homeFlag: getFlag("SCO"),
      awayFlag: getFlag("MAR"),
      homeScore: 0,
      awayScore: 0,
      status: "SCHEDULED",
      time: "23:00",
      date: "19 Juin 2026",
      group: "Groupe C",
      stadium: "Boston Stadium",
      events: []
    },
    {
      id: 9,
      homeTeam: "Maroc",
      awayTeam: "Haïti",
      homeTla: "MAR",
      awayTla: "HAI",
      homeFlag: getFlag("MAR"),
      awayFlag: getFlag("HAI"),
      homeScore: 0,
      awayScore: 0,
      status: "SCHEDULED",
      time: "23:00",
      date: "24 Juin 2026",
      group: "Groupe C",
      stadium: "Atlanta Stadium",
      events: []
    }
  ];

  return {
    matches: matches,
    stadiums: getStaticStadiums(),
    moroccoSquad: getStaticSquad(),
    standings: {
      groups: {
        "Groupe C": computeGroupStandings(matches, "Groupe C"),
        "Groupe A": computeGroupStandings(matches, "Groupe A")
      },
      scorers: getStaticScorers(),
      assists: getStaticAssists()
    },
    news: getStaticNews()
  };
}

export function getH2HData(home, away) {
  const normalize = (name) => {
    const n = (name || '').toLowerCase().trim();
    if (n.includes("brés") || n.includes("brazil") || n.includes("bra")) return "brazil";
    if (n.includes("maroc") || n.includes("moroc") || n.includes("mar") || n.includes("mor")) return "morocco";
    if (n.includes("mexic") || n.includes("mex")) return "mexico";
    if (n.includes("afrique du sud") || n.includes("south africa") || n.includes("rsa")) return "southafrica";
    if (n.includes("écosse") || n.includes("scotland") || n.includes("sco")) return "scotland";
    if (n.includes("états-unis") || n.includes("usa") || n.includes("united states") || n.includes("us")) return "usa";
    if (n.includes("paraguay") || n.includes("par")) return "paraguay";
    if (n.includes("corée") || n.includes("korea") || n.includes("kor")) return "korea";
    if (n.includes("tchèque") || n.includes("czech") || n.includes("cze")) return "czech";
    if (n.includes("haït") || n.includes("haiti") || n.includes("hai") || n.includes("hti")) return "haiti";
    return n.replace(/\s+/g, "");
  };

  const normHome = normalize(home);
  const normAway = normalize(away);
  const key = [normHome, normAway].sort().join(" vs ");

  const h2hDatabase = {
    "brazil vs morocco": [
      { date: "25 Mars 2023", comp: "Match Amical", score: "Maroc 2 - 1 Brésil", details: "Victoire historique des Lions de l'Atlas à Tanger (Boufal 29', Sabiri 79' / Casemiro 67')" },
      { date: "16 Juin 1998", comp: "Coupe du Monde 1998", score: "Brésil 3 - 0 Maroc", details: "Phase de groupes à Nantes (Ronaldo 9', Rivaldo 45', Bebeto 50')" }
    ],
    "mexico vs southafrica": [
      { date: "11 Juin 2010", comp: "Coupe du Monde 2010", score: "Afrique du Sud 1 - 1 Mexique", details: "Match d'ouverture historique à Johannesburg (Tshabalala 55' / Márquez 79')" },
      { date: "08 Juillet 2005", comp: "Gold Cup 2005", score: "Mexique 1 - 2 Afrique du Sud", details: "Phase de groupes (Rodriguez 40' / Evans 28', Sibaya 41' pen)" }
    ],
    "morocco vs scotland": [
      { date: "23 Juin 1998", comp: "Coupe du Monde 1998", score: "Écosse 0 - 3 Maroc", details: "Phase de groupes à Saint-Étienne. Doublé légendaire de Salaheddine Bassir (22', 85') et but d'Abdeljalil Hadda (46')" },
      { date: "18 Décembre 1996", comp: "Match Amical", score: "Maroc 1 - 1 Écosse", details: "Match de préparation à Casablanca" }
    ],
    "paraguay vs usa": [
      { date: "11 Juin 2016", comp: "Copa América Centenario", score: "États-Unis 1 - 0 Paraguay", details: "But décisif de Clint Dempsey à Philadelphie" },
      { date: "29 Mars 2011", comp: "Match Amical", score: "États-Unis 0 - 1 Paraguay", details: "Match amical disputé à Nashville" }
    ],
    "czech vs korea": [
      { date: "05 Juin 2016", comp: "Match Amical", score: "République Tchèque 1 - 2 Corée du Sud", details: "Victoire coréenne à Prague" },
      { date: "15 Août 2001", comp: "Match Amical", score: "République Tchèque 5 - 0 Corée du Sud", details: "Match amical à Drnovice" }
    ],
    "haiti vs morocco": [
      { date: "17 Avril 2002", comp: "Match Amical", score: "Maroc 0 - 0 Haïti", details: "Rencontre amicale disputée à Rabat" }
    ]
  };

  return h2hDatabase[key] || [
    { date: "Rencontre Inédite", comp: "Coupe du Monde 2026", score: `${home} vs ${away}`, details: "Ces deux équipes ne se sont jamais affrontées dans l'histoire officielle du football." }
  ];
}

function getStadiumForMatch(homeTeam, awayTeam, groupName, matchId) {
  const home = (homeTeam || "").toLowerCase();
  const away = (awayTeam || "").toLowerCase();
  const group = (groupName || "").toLowerCase();

  // 1. Groupe A : Matches au Mexique
  if (group.includes("groupe a") || group.includes("group a")) {
    if (home.includes("mexic") || away.includes("mexic") || home.includes("mexico") || away.includes("mexico")) {
      return "Mexico City Stadium";
    }
    return matchId % 2 === 0 ? "Guadalajara Stadium" : "Monterrey Stadium";
  }

  // 2. Groupe B : Matches au Canada and Boston
  if (group.includes("groupe b") || group.includes("group b")) {
    if (home.includes("canad") || away.includes("canad")) {
      return "BC Place";
    }
    return matchId % 2 === 0 ? "Toronto Stadium" : "Boston Stadium";
  }

  // 3. Groupe C : Matches du Maroc, du Brésil, etc.
  if (group.includes("groupe c") || group.includes("group c")) {
    if (home.includes("brés") || home.includes("brazil") || away.includes("brés") || away.includes("brazil")) {
      return "New York New Jersey Stadium";
    }
    if (home.includes("maroc") || home.includes("moroc") || away.includes("maroc") || away.includes("moroc")) {
      return "Boston Stadium";
    }
    return "Atlanta Stadium";
  }

  // 4. Groupe D : Matches aux USA
  if (group.includes("groupe d") || group.includes("group d")) {
    if (home.includes("usa") || home.includes("états") || home.includes("united states") || away.includes("usa") || away.includes("états")) {
      return "Los Angeles Stadium";
    }
    return matchId % 2 === 0 ? "Seattle Stadium" : "San Francisco Bay Area Stadium";
  }

  // Stades restants aux USA pour les autres groupes
  const otherStadiums = [
    "Dallas Stadium",
    "Houston Stadium",
    "Kansas City Stadium",
    "Miami Stadium",
    "Philadelphia Stadium",
    "San Francisco Bay Area Stadium"
  ];
  return otherStadiums[matchId % otherStadiums.length];
}
