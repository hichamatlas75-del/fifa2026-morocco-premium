// js/api.js
import realMatches from './real_matches.json';

export function getFlag(tla) {
  if (!tla) return `<img src="https://flagcdn.com/w80/un.png" class="flag-icon" alt="UN">`;
  const codeMap = {
    // Groupe A
    MEX: "mx", RSA: "za", KOR: "kr", CZE: "cz",
    // Groupe B
    CAN: "ca", BIH: "ba", BOS: "ba", QAT: "qa", SUI: "ch", CHE: "ch",
    // Groupe C
    BRA: "br", MAR: "ma", MOR: "ma", HAI: "ht", HTI: "ht", SCO: "gb-sct", SCT: "gb-sct",
    // Groupe D
    USA: "us", PAR: "py", AUS: "au", TUR: "tr",
    // Groupe E
    GER: "de", DEU: "de", CUW: "cw", CIV: "ci", ECU: "ec",
    // Groupe F
    NED: "nl", NLD: "nl", JPN: "jp", SWE: "se", TUN: "tn",
    // Groupe G
    BEL: "be", EGY: "eg", IRN: "ir", NZL: "nz",
    // Groupe H
    ESP: "es", CPV: "cv", KSA: "sa", SAU: "sa", URU: "uy", URY: "uy",
    // Groupe I
    FRA: "fr", SEN: "sn", IRQ: "iq", NOR: "no", ITA: "it", HON: "hn",
    // Groupe J
    PRT: "pt", COD: "cd", UZB: "uz", COL: "co", CMR: "cm", CRC: "cr", UAE: "ae",
    // Groupe K
    ARG: "ar", DZA: "dz", AUT: "at", JOR: "jo", NGA: "ng", JAM: "jm", OMA: "om",
    // Groupe L
    ENG: "gb-eng", CRO: "hr", HRV: "hr", GHA: "gh", PAN: "pa",
    // TBD
    TBD: "un"
  };
  const code = codeMap[tla.toUpperCase()];
  if (!code) {
    return `<img src="https://flagcdn.com/w80/un.png" class="flag-icon" alt="${tla}">`;
  }
  return `<img src="https://flagcdn.com/w80/${code}.png" class="flag-icon" alt="${tla}">`;
}

function getGroupForTeam(tla) {
  for (const [groupName, teams] of Object.entries(groupsData)) {
    if (teams.some(t => t.tla === tla)) return groupName;
  }
  return "";
}

function translateOpenLigaGroup(groupName, homeTla) {
  const name = (groupName || "").toLowerCase();
  if (name.includes("gruppenphase") || name.includes("runde") || name.includes("spieltag")) {
    return getGroupForTeam(homeTla) || "Groupe A";
  }
  if (name.includes("sechzehntel") || name.includes("1/16")) return "Seizièmes de finale";
  if (name.includes("achtel") || name.includes("1/8")) return "Huitièmes de finale";
  if (name.includes("viertel") || name.includes("1/4")) return "Quarts de finale";
  if (name.includes("halb") || name.includes("1/2")) return "Demi-finales";
  if (name.includes("platz 3") || name.includes("dritter")) return "Match 3e place";
  if (name.includes("finale") || name.includes("endspiel")) return "Finale";
  return groupName;
}

export async function initApi() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch('/api-proxy', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const rawData = await response.json();
    
    if (rawData.error) {
      throw new Error(rawData.error);
    }

    const rawMatches = Array.isArray(rawData) ? rawData : (rawData.matches || []);

    const tlaMap = {
      CHE: "SUI",
      HTI: "HAI",
      SCT: "SCO",
      DEU: "GER",
      NLD: "NED",
      SAU: "KSA",
      URY: "URU",
      HRV: "CRO"
    };

    const teamNamesFr = {
      MEX: "Mexique", RSA: "Afrique du Sud", KOR: "Corée du Sud", CZE: "République Tchèque",
      CAN: "Canada", BIH: "Bosnie-Herzégovine", QAT: "Qatar", SUI: "Suisse",
      BRA: "Brésil", MAR: "Maroc", HAI: "Haïti", SCO: "Écosse",
      USA: "États-Unis", PAR: "Paraguay", AUS: "Australie", TUR: "Turquie",
      GER: "Allemagne", CUW: "Curaçao", CIV: "Côte d'Ivoire", ECU: "Équateur",
      NED: "Pays-Bas", JPN: "Japon", SWE: "Suède", TUN: "Tunisie",
      BEL: "Belgique", EGY: "Égypte", IRN: "Iran", NZL: "Nouvelle-Zélande",
      ESP: "Espagne", CPV: "Cap-Vert", KSA: "Arabie Saoudite", URU: "Uruguay",
      ITA: "Italie", SEN: "Sénégal", HON: "Honduras", IRQ: "Irak",
      FRA: "France", CMR: "Cameroun", CRC: "Costa Rica", UAE: "Émirats Arabes Unis",
      ARG: "Argentine", NGA: "Nigéria", JAM: "Jamaïque", OMA: "Oman",
      ENG: "Angleterre", CRO: "Croatie", GHA: "Ghana", PAN: "Panama",
      NOR: "Norvège", DZA: "Algérie", AUT: "Autriche", JOR: "Jordanie",
      PRT: "Portugal", COD: "RD Congo", UZB: "Ouzbékistan", COL: "Colombie"
    };

    const matches = rawMatches.map(m => {
      const homeTla = (m.team1.shortName || 'TBD').toUpperCase();
      const awayTla = (m.team2.shortName || 'TBD').toUpperCase();
      
      const normHomeTla = tlaMap[homeTla] || homeTla;
      const normAwayTla = tlaMap[awayTla] || awayTla;

      const homeTeamName = teamNamesFr[normHomeTla] || m.team1.teamName;
      const awayTeamName = teamNamesFr[normAwayTla] || m.team2.teamName;

      const matchDate = new Date(m.matchDateTimeUTC || m.matchDateTime);
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

      let homeScore = 0;
      let awayScore = 0;
      
      if (m.matchResults && m.matchResults.length > 0) {
        const endResult = m.matchResults.find(r => r.resultOrderID === 2 || r.resultName === 'Endergebnis');
        if (endResult) {
          homeScore = endResult.pointsTeam1;
          awayScore = endResult.pointsTeam2;
        } else {
          const sortedResults = [...m.matchResults].sort((a, b) => b.resultOrderID - a.resultOrderID);
          homeScore = sortedResults[0].pointsTeam1;
          awayScore = sortedResults[0].pointsTeam2;
        }
      } else if (m.goals && m.goals.length > 0) {
        const lastGoal = m.goals[m.goals.length - 1];
        homeScore = lastGoal.scoreTeam1;
        awayScore = lastGoal.scoreTeam2;
      }

      const now = new Date();
      const timeDiff = now.getTime() - matchDate.getTime();
      const matchDurationMs = 2 * 60 * 60 * 1000;
      const isFinished = m.matchIsFinished;
      const isLive = !isFinished && timeDiff > 0 && timeDiff < matchDurationMs;

      const groupName = getGroupForTeam(normHomeTla) || translateOpenLigaGroup(m.group.groupName, normHomeTla);

      return {
        id: m.matchID,
        homeTeam: homeTeamName,
        awayTeam: awayTeamName,
        homeTla: normHomeTla,
        awayTla: normAwayTla,
        homeFlag: getFlag(normHomeTla),
        awayFlag: getFlag(normAwayTla),
        homeScore: homeScore,
        awayScore: awayScore,
        status: isLive ? 'LIVE' : isFinished ? 'FINISHED' : 'SCHEDULED',
        time: isLive ? "Direct" : timeStr,
        date: dateStr,
        group: groupName,
        stadium: getStadiumForMatch(
          homeTeamName,
          awayTeamName,
          groupName,
          m.matchID
        ),
        events: []
      };
    });

    const knockoutStages = [
      { name: "Seizièmes de finale", count: 16, startDay: 13, gap: 4 },
      { name: "Huitièmes de finale", count: 8, startDay: 18, gap: 4 },
      { name: "Quarts de finale", count: 4, startDay: 23, gap: 3 },
      { name: "Demi-finales", count: 2, startDay: 28, gap: 2 },
      { name: "Match 3e place", count: 1, startDay: 37, gap: 1 },
      { name: "Finale", count: 1, startDay: 38, gap: 1 }
    ];

    let currentMatchId = 85000;
    knockoutStages.forEach(stage => {
      const stageExists = matches.some(m => m.group === stage.name);
      if (!stageExists) {
        for (let i = 0; i < stage.count; i++) {
          const dayOffset = stage.startDay + Math.floor((i * stage.gap) / stage.count);
          const utcHour = i % 2 === 0 ? 19 : 22; // Correspond à 20:00 ou 23:00 heure marocaine (ou 19:00 / 22:00 UTC)
          
          const matchDateObj = new Date(Date.UTC(2026, 5, 11, utcHour - 1, 0, 0));
          matchDateObj.setUTCDate(matchDateObj.getUTCDate() + dayOffset);
          
          const dateStr = matchDateObj.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'Africa/Casablanca'
          });
          
          const timeStr = matchDateObj.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Africa/Casablanca'
          });
          
          matches.push({
            id: currentMatchId++,
            homeTeam: "À déterminer",
            awayTeam: "À déterminer",
            homeTla: "TBD",
            awayTla: "TBD",
            homeFlag: getFlag("TBD"),
            awayFlag: getFlag("TBD"),
            homeScore: 0,
            awayScore: 0,
            status: "SCHEDULED",
            time: timeStr,
            date: dateStr,
            group: stage.name,
            stadium: getStadiumForMatch("TBD", "TBD", stage.name, currentMatchId),
            events: []
          });
        }
      }
    });

    const groupsList = ["Groupe A", "Groupe B", "Groupe C", "Groupe D", "Groupe E", "Groupe F", "Groupe G", "Groupe H", "Groupe I", "Groupe J", "Groupe K", "Groupe L"];
    const groupsStandings = {};
    groupsList.forEach(g => {
      groupsStandings[g] = computeGroupStandings(matches, g);
    });

    return {
      dataSource: "api",
      matches: matches,
      stadiums: getStaticStadiums(),
      moroccoSquad: getStaticSquad(),
      standings: {
        groups: groupsStandings,
        scorers: getStaticScorers(),
        assists: getStaticAssists()
      },
      news: getStaticNews()
    };
  } catch (error) {
    console.warn("⚠️ Impossible de joindre l'API de production, chargement des données de secours :", error);
    return getFallbackData();
  }
}

// Fonction de calcul des classements en fonction des scores réels (basée sur les TLA uniques et robustes)
function computeGroupStandings(matches, groupName) {
  // Traduire le nom du groupe en français pour la comparaison si nécessaire
  const groupMatches = matches.filter(m => m.group === groupName || m.group === groupName.replace("Groupe", "Group"));
  const teamsMap = new Map();

  // Détecter dynamiquement les équipes du groupe à partir de la liste des matchs
  groupMatches.forEach(m => {
    if (m.homeTla && m.homeTla !== 'TBD') {
      if (!teamsMap.has(m.homeTla)) {
        teamsMap.set(m.homeTla, { tla: m.homeTla, name: m.homeTeam, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
      }
    }
    if (m.awayTla && m.awayTla !== 'TBD') {
      if (!teamsMap.has(m.awayTla)) {
        teamsMap.set(m.awayTla, { tla: m.awayTla, name: m.awayTeam, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
      }
    }
  });

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
    // Gardiens
    { name: "Yassine Bounou", pos: "Gardiens", num: 1, club: "Al-Hilal" },
    { name: "Munir El Kajoui", pos: "Gardiens", num: 12, club: "RS Berkane" },
    { name: "Ahmed Tagnaouti", pos: "Gardiens", num: 22, club: "AS FAR" },

    // Défenseurs
    { name: "Achraf Hakimi", pos: "Défenseurs", num: 2, club: "PSG" },
    { name: "Noussair Mazraoui", pos: "Défenseurs", num: 3, club: "Manchester United" },
    { name: "Nayef Aguerd", pos: "Défenseurs", num: 5, club: "Olympique de Marseille" },
    { name: "Chadi Riad", pos: "Défenseurs", num: 6, club: "Crystal Palace" },
    { name: "Issa Diop", pos: "Défenseurs", num: 4, club: "Fulham" },
    { name: "Anass Salah-Eddine", pos: "Défenseurs", num: 20, club: "PSV Eindhoven" },
    { name: "Youssef Belammari", pos: "Défenseurs", num: 13, club: "Al Ahly" },
    { name: "Redouane Halhal", pos: "Défenseurs", num: 24, club: "KV Mechelen" },
    { name: "Zakaria El Ouahdi", pos: "Défenseurs", num: 15, club: "KRC Genk" },

    // Milieux
    { name: "Sofyan Amrabat", pos: "Milieux", num: 4, club: "Real Betis" },
    { name: "Azzedine Ounahi", pos: "Milieux", num: 8, club: "Girona" },
    { name: "Bilal El Khannouss", pos: "Milieux", num: 14, club: "VfB Stuttgart" },
    { name: "Ismael Saibari", pos: "Milieux", num: 11, club: "PSV Eindhoven" },
    { name: "Ayyoub Bouaddi", pos: "Milieux", num: 18, club: "Lille OSC" },
    { name: "Neil El Aynaoui", pos: "Milieux", num: 23, club: "AS Roma" },
    { name: "Samir El Mourabet", pos: "Milieux", num: 16, club: "RC Strasbourg" },
    { name: "Yassine Gessime", pos: "Milieux", num: 21, club: "RC Strasbourg" },

    // Attaquants
    { name: "Brahim Díaz", pos: "Attaquants", num: 10, club: "Real Madrid" },
    { name: "Ayoub El Kaabi", pos: "Attaquants", num: 19, club: "Olympiacos" },
    { name: "Soufiane Rahimi", pos: "Attaquants", num: 9, club: "Al Ain FC" },
    { name: "Abde Ezzalzouli", pos: "Attaquants", num: 17, club: "Real Betis" },
    { name: "Chemsdine Talbi", pos: "Attaquants", num: 25, club: "Sunderland" },
    { name: "Ayoub Amaimouni", pos: "Attaquants", num: 26, club: "Eintracht Frankfurt" }
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
      image: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=600&auto=format&fit=crop",
      date: "12 Juin 2026"
    },
    {
      id: 2,
      image: "https://images.unsplash.com/photo-1551958219-acbc608c6377?q=80&w=600&auto=format&fit=crop",
      date: "11 Juin 2026"
    },
    {
      id: 3,
      image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop",
      date: "12 Juin 2026"
    },
    {
      id: 4,
      image: "https://images.unsplash.com/photo-1459865264687-595d652de67e?q=80&w=600&auto=format&fit=crop",
      date: "10 Juin 2026"
    },
    {
      id: 5,
      image: "https://images.unsplash.com/photo-1559511260-66a654ae982a?q=80&w=600&auto=format&fit=crop",
      date: "11 Juin 2026"
    },
    {
      id: 6,
      image: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?q=80&w=600&auto=format&fit=crop",
      date: "12 Juin 2026"
    }
  ];
}

const groupsData = {
  "Groupe A": [
    { tla: "MEX", name: "Mexique" },
    { tla: "RSA", name: "Afrique du Sud" },
    { tla: "KOR", name: "Corée du Sud" },
    { tla: "CZE", name: "République Tchèque" }
  ],
  "Groupe B": [
    { tla: "CAN", name: "Canada" },
    { tla: "BIH", name: "Bosnie-Herzégovine" },
    { tla: "QAT", name: "Qatar" },
    { tla: "SUI", name: "Suisse" }
  ],
  "Groupe C": [
    { tla: "BRA", name: "Brésil" },
    { tla: "MAR", name: "Maroc" },
    { tla: "HAI", name: "Haïti" },
    { tla: "SCO", name: "Écosse" }
  ],
  "Groupe D": [
    { tla: "USA", name: "États-Unis" },
    { tla: "PAR", name: "Paraguay" },
    { tla: "AUS", name: "Australie" },
    { tla: "TUR", name: "Turquie" }
  ],
  "Groupe E": [
    { tla: "GER", name: "Allemagne" },
    { tla: "CUW", name: "Curaçao" },
    { tla: "CIV", name: "Côte d'Ivoire" },
    { tla: "ECU", name: "Équateur" }
  ],
  "Groupe F": [
    { tla: "NED", name: "Pays-Bas" },
    { tla: "JPN", name: "Japon" },
    { tla: "SWE", name: "Suède" },
    { tla: "TUN", name: "Tunisie" }
  ],
  "Groupe G": [
    { tla: "BEL", name: "Belgique" },
    { tla: "EGY", name: "Égypte" },
    { tla: "IRN", name: "Iran" },
    { tla: "NZL", name: "Nouvelle-Zélande" }
  ],
  "Groupe H": [
    { tla: "ESP", name: "Espagne" },
    { tla: "CPV", name: "Cap-Vert" },
    { tla: "KSA", name: "Arabie Saoudite" },
    { tla: "URU", name: "Uruguay" }
  ],
  "Groupe I": [
    { tla: "FRA", name: "France" },
    { tla: "SEN", name: "Sénégal" },
    { tla: "IRQ", name: "Irak" },
    { tla: "NOR", name: "Norvège" }
  ],
  "Groupe J": [
    { tla: "PRT", name: "Portugal" },
    { tla: "COD", name: "RD Congo" },
    { tla: "UZB", name: "Ouzbékistan" },
    { tla: "COL", name: "Colombie" }
  ],
  "Groupe K": [
    { tla: "ARG", name: "Argentine" },
    { tla: "DZA", name: "Algérie" },
    { tla: "AUT", name: "Autriche" },
    { tla: "JOR", name: "Jordanie" }
  ],
  "Groupe L": [
    { tla: "ENG", name: "Angleterre" },
    { tla: "CRO", name: "Croatie" },
    { tla: "GHA", name: "Ghana" },
    { tla: "PAN", name: "Panama" }
  ]
};

function getFallbackData() {
  const matches = realMatches.map(m => ({
    ...m,
    homeFlag: getFlag(m.homeTla),
    awayFlag: getFlag(m.awayTla),
    stadium: getStadiumForMatch(m.homeTeam, m.awayTeam, m.group, m.id),
    events: []
  }));

  const knockoutStages = [
    { name: "Seizièmes de finale", count: 16, startDay: 13, gap: 4 },
    { name: "Huitièmes de finale", count: 8, startDay: 18, gap: 4 },
    { name: "Quarts de finale", count: 4, startDay: 23, gap: 3 },
    { name: "Demi-finales", count: 2, startDay: 28, gap: 2 },
    { name: "Match 3e place", count: 1, startDay: 37, gap: 1 },
    { name: "Finale", count: 1, startDay: 38, gap: 1 }
  ];
  
  let matchId = 85000;
  knockoutStages.forEach(stage => {
    for (let i = 0; i < stage.count; i++) {
      const dayOffset = stage.startDay + Math.floor((i * stage.gap) / stage.count);
      const utcHour = i % 2 === 0 ? 19 : 22; // Correspond à 20:00 ou 23:00 heure marocaine (ou 19:00 / 22:00 UTC)
      
      const matchDateObj = new Date(Date.UTC(2026, 5, 11, utcHour - 1, 0, 0));
      matchDateObj.setUTCDate(matchDateObj.getUTCDate() + dayOffset);
      
      const dateStr = matchDateObj.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Africa/Casablanca'
      });
      
      const timeStr = matchDateObj.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Casablanca'
      });
      
      matches.push({
        id: matchId++,
        homeTeam: "À déterminer",
        awayTeam: "À déterminer",
        homeTla: "TBD",
        awayTla: "TBD",
        homeFlag: getFlag("TBD"),
        awayFlag: getFlag("TBD"),
        homeScore: 0,
        awayScore: 0,
        status: "SCHEDULED",
        time: timeStr,
        date: dateStr,
        group: stage.name,
        stadium: getStadiumForMatch("TBD", "TBD", stage.name, matchId),
        events: []
      });
    }
  });

  const groupsList = ["Groupe A", "Groupe B", "Groupe C", "Groupe D", "Groupe E", "Groupe F", "Groupe G", "Groupe H", "Groupe I", "Groupe J", "Groupe K", "Groupe L"];
  const groupsStandings = {};
  groupsList.forEach(g => {
    groupsStandings[g] = computeGroupStandings(matches, g);
  });

  return {
    dataSource: "fallback",
    matches: matches,
    stadiums: getStaticStadiums(),
    moroccoSquad: getStaticSquad(),
    standings: {
      groups: groupsStandings,
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
