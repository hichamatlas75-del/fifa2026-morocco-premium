// js/api.js
import realMatches from './real_matches.json';
import { TEAMS_SQUADS } from './teams_squads.js';

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

let worldCupApiGames = [];

const englishToTla = {
  "mexico": "MEX",
  "south africa": "RSA",
  "south korea": "KOR",
  "korea republic": "KOR",
  "republic of korea": "KOR",
  "czechia": "CZE",
  "czech republic": "CZE",
  "canada": "CAN",
  "bosnia and herzegovina": "BIH",
  "bosnia": "BIH",
  "united states": "USA",
  "united states of america": "USA",
  "usa": "USA",
  "paraguay": "PAR",
  "qatar": "QAT",
  "switzerland": "SUI",
  "brazil": "BRA",
  "morocco": "MAR",
  "haiti": "HAI",
  "scotland": "SCO",
  "australia": "AUS",
  "turkey": "TUR",
  "türkiye": "TUR",
  "germany": "GER",
  "curaçao": "CUW",
  "curacao": "CUW",
  "côte d'ivoire": "CIV",
  "cote d'ivoire": "CIV",
  "ivory coast": "CIV",
  "ecuador": "ECU",
  "netherlands": "NED",
  "japan": "JPN",
  "sweden": "SWE",
  "tunisia": "TUN",
  "belgium": "BEL",
  "egypt": "EGY",
  "iran": "IRN",
  "ir iran": "IRN",
  "new zealand": "NZL",
  "spain": "ESP",
  "cape verde": "CPV",
  "cabo verde": "CPV",
  "saudi arabia": "KSA",
  "uruguay": "URU",
  "france": "FRA",
  "senegal": "SEN",
  "iraq": "IRQ",
  "norway": "NOR",
  "italy": "ITA",
  "honduras": "HON",
  "portugal": "PRT",
  "dr congo": "COD",
  "democratic republic of the congo": "COD",
  "democratic republic of congo": "COD",
  "congo dr": "COD",
  "uzbekistan": "UZB",
  "colombia": "COL",
  "cameroon": "CMR",
  "costa rica": "CRC",
  "uae": "UAE",
  "united arab emirates": "UAE",
  "argentina": "ARG",
  "algeria": "DZA",
  "austria": "AUT",
  "jordan": "JOR",
  "nigeria": "NGA",
  "jamaica": "JAM",
  "oman": "OMA",
  "england": "ENG",
  "croatia": "CRO",
  "ghana": "GHA",
  "panama": "PAN"
};

export async function updateWorldCupGames() {
  try {
    const irResponse = await fetch('/api-worldcup');
    if (irResponse.ok) {
      const irData = await irResponse.json();
      if (irData && irData.games) {
        worldCupApiGames = irData.games;
        console.log("⚽ [API] Mise à jour des buteurs réels depuis worldcup26.ir :", worldCupApiGames.length, "matchs");
      }
    }
  } catch (e) {
    console.warn("⚠️ Impossible de joindre l'API de secours worldcup26.ir :", e);
  }
}

const TLA_MAP = {
  CHE: "SUI",
  HTI: "HAI",
  SCT: "SCO",
  DEU: "GER",
  NLD: "NED",
  SAU: "KSA",
  URY: "URU",
  HRV: "CRO"
};

const TEAM_NAMES_FR = {
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


function mapKnockoutStages(parsedMatches) {
  const knockoutStages = [
    { name: "Seizièmes de finale", count: 16, startDay: 13, gap: 4 },
    { name: "Huitièmes de finale", count: 8, startDay: 18, gap: 4 },
    { name: "Quarts de finale", count: 4, startDay: 23, gap: 3 },
    { name: "Demi-finales", count: 2, startDay: 28, gap: 2 },
    { name: "Match 3e place", count: 1, startDay: 37, gap: 1 },
    { name: "Finale", count: 1, startDay: 38, gap: 1 }
  ];

  const groupStageMatches = [];
  const apiKnockoutMatches = [];
  
  parsedMatches.forEach(m => {
    if (m.id >= 85000 && m.id <= 85031) return;
    
    const isKnockout = knockoutStages.some(s => s.name === m.group);
    if (isKnockout) {
      apiKnockoutMatches.push(m);
    } else {
      groupStageMatches.push(m);
    }
  });

  const placeholders = [];
  let currentMatchId = 85000;
  knockoutStages.forEach(stage => {
    for (let i = 0; i < stage.count; i++) {
      const dayOffset = stage.startDay + Math.floor((i * stage.gap) / stage.count);
      const utcHour = i % 2 === 0 ? 19 : 22;
      
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
      
      const mId = currentMatchId++;
      placeholders.push({
        id: mId,
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
        kickoffTime: timeStr,
        date: dateStr,
        utcDate: matchDateObj.toISOString(),
        group: stage.name,
        stadium: getStadiumForMatch("TBD", "TBD", stage.name, mId),
        events: [],
        stats: getDeterministicStats(mId, 0, 0)
      });
    }
  });

  knockoutStages.forEach(stage => {
    const stageRealMatches = apiKnockoutMatches.filter(m => m.group === stage.name);
    stageRealMatches.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate) || a.id - b.id);
    
    const stagePlaceholders = placeholders.filter(p => p.group === stage.name);
    
    stageRealMatches.forEach((realMatch, idx) => {
      let p;
      if (stage.name === "Seizièmes de finale") {
        const r32ApiToPlaceholder = {
          82099: 85000, 82101: 85001, 82102: 85002, 82100: 85003,
          82103: 85004, 82104: 85005, 82105: 85006, 82106: 85007,
          82107: 85008, 82108: 85009, 82109: 85010, 82110: 85011,
          82111: 85012, 82112: 85013, 82113: 85014, 82114: 85015
        };
        const pId = r32ApiToPlaceholder[realMatch.id];
        if (pId !== undefined) {
          p = stagePlaceholders.find(x => x.id === pId);
        }
      }
      
      if (!p) {
        p = stagePlaceholders[idx];
      }
      
      if (p) {
        p.homeTla = realMatch.homeTla;
        p.awayTla = realMatch.awayTla;
        p.homeTeam = realMatch.homeTeam;
        p.awayTeam = realMatch.awayTeam;
        p.homeFlag = realMatch.homeFlag;
        p.awayFlag = realMatch.awayFlag;
        p.homeScore = realMatch.homeScore;
        p.awayScore = realMatch.awayScore;
        p.status = realMatch.status;
        p.time = realMatch.time;
        p.kickoffTime = realMatch.kickoffTime;
        p.date = realMatch.date;
        p.utcDate = realMatch.utcDate;
        p.stadium = realMatch.stadium;
        p.events = realMatch.events;
        p.stats = realMatch.stats;
      }
    });
  });

  return groupStageMatches.concat(placeholders);
}

export function parseOpenLigaDBData(rawData) {
  const rawMatches = Array.isArray(rawData) ? rawData : (rawData.matches || []);

  const matches = rawMatches.map(m => {
    const homeTla = (m.team1.shortName || 'TBD').toUpperCase();
    const awayTla = (m.team2.shortName || 'TBD').toUpperCase();
    
    const normHomeTla = TLA_MAP[homeTla] || homeTla;
    const normAwayTla = TLA_MAP[awayTla] || awayTla;

    const homeTeamName = TEAM_NAMES_FR[normHomeTla] || m.team1.teamName;
    const awayTeamName = TEAM_NAMES_FR[normAwayTla] || m.team2.teamName;

    const matchDate = new Date(m.matchDateTimeUTC || m.matchDateTime);
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
    
    let isFinished = m.matchIsFinished;
    if (!isFinished && timeDiff >= matchDurationMs) {
      isFinished = true;
    }
    const isLive = !isFinished && timeDiff > 0 && timeDiff < matchDurationMs;

    const rawGroupName = (m.group.groupName || "").toLowerCase();
    const isKnockout = rawGroupName.includes("sechzehntel") || 
                       rawGroupName.includes("1/16") || 
                       rawGroupName.includes("achtel") || 
                       rawGroupName.includes("1/8") || 
                       rawGroupName.includes("viertel") || 
                       rawGroupName.includes("1/4") || 
                       rawGroupName.includes("halb") || 
                       rawGroupName.includes("1/2") || 
                       rawGroupName.includes("finale") || 
                       rawGroupName.includes("endspiel") || 
                       rawGroupName.includes("seizième") || 
                       rawGroupName.includes("huitième") || 
                       rawGroupName.includes("quart") || 
                       rawGroupName.includes("demi");

    const groupName = isKnockout 
      ? translateOpenLigaGroup(m.group.groupName, normHomeTla)
      : (getGroupForTeam(normHomeTla) || translateOpenLigaGroup(m.group.groupName, normHomeTla));

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
      kickoffTime: timeStr,
      date: dateStr,
      utcDate: matchDate.toISOString(),
      liveMinute: isLive ? calculateLiveMinute(matchDate.toISOString()) : null,
      group: groupName,
      stadium: getStadiumForMatch(
        homeTeamName,
        awayTeamName,
        groupName,
        m.matchID
      ),
      events: getDeterministicEvents(m.matchID, normHomeTla, normAwayTla, homeScore, awayScore, m.goals),
      stats: getDeterministicStats(m.matchID, homeScore, awayScore)
    };
  });

  const mappedMatches = mapKnockoutStages(matches);

  const groupsList = ["Groupe A", "Groupe B", "Groupe C", "Groupe D", "Groupe E", "Groupe F", "Groupe G", "Groupe H", "Groupe I", "Groupe J", "Groupe K", "Groupe L"];
  const groupsStandings = {};
  groupsList.forEach(g => {
    groupsStandings[g] = computeGroupStandings(mappedMatches, g);
  });

  return {
    dataSource: "api",
    matches: mappedMatches,
    stadiums: getStaticStadiums(),
    moroccoSquad: getStaticSquad(),
    standings: {
      groups: groupsStandings,
      ...computeScorersAndAssists(mappedMatches)
    },
    news: getStaticNews()
  };
}

export function parseFootballData(rawData) {
  const fdMatches = rawData.matches || [];
  
  // Trier chronologiquement pour aligner 1-à-1 avec les identifiants OpenLigaDB stables de real_matches.json
  const sortedFd = [...fdMatches].sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
  const sortedReal = [...realMatches].sort((a, b) => a.id - b.id);
  
  const idMap = new Map();
  sortedFd.forEach((m, idx) => {
    if (sortedReal[idx]) {
      idMap.set(m.id, sortedReal[idx].id);
    }
  });

  const mapFdStage = (stage) => {
    const mapping = {
      'GROUP_STAGE': '',
      'LAST_32': 'Seizièmes de finale',
      'LAST_16': 'Huitièmes de finale',
      'QUARTER_FINALS': 'Quarts de finale',
      'SEMI_FINALS': 'Demi-finales',
      'THIRD_PLACE': 'Match 3e place',
      'FINAL': 'Finale'
    };
    return mapping[stage] || stage;
  };

  const matches = fdMatches.map(m => {
    const matchId = idMap.get(m.id) || m.id;

    const homeTla = (m.homeTeam?.tla || 'TBD').toUpperCase();
    const awayTla = (m.awayTeam?.tla || 'TBD').toUpperCase();

    const normHomeTla = TLA_MAP[homeTla] || homeTla;
    const normAwayTla = TLA_MAP[awayTla] || awayTla;

    const homeTeamName = TEAM_NAMES_FR[normHomeTla] || m.homeTeam?.name || "À déterminer";
    const awayTeamName = TEAM_NAMES_FR[normAwayTla] || m.awayTeam?.name || "À déterminer";

    const matchDate = new Date(m.utcDate);
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

    const homeScore = m.score?.fullTime?.home !== null && m.score?.fullTime?.home !== undefined ? m.score.fullTime.home : 0;
    const awayScore = m.score?.fullTime?.away !== null && m.score?.fullTime?.away !== undefined ? m.score.fullTime.away : 0;

    const now = new Date();
    const timeDiff = now.getTime() - matchDate.getTime();
    const matchDurationMs = 2 * 60 * 60 * 1000;

    let isFinished = m.status === 'FINISHED' || m.status === 'AWARDED';
    if (!isFinished && timeDiff >= matchDurationMs) {
      isFinished = true;
    }
    const isLive = !isFinished && (m.status === 'IN_PLAY' || m.status === 'PAUSED' || m.status === 'LIVE' || (timeDiff > 0 && timeDiff < matchDurationMs));
    const status = isLive ? 'LIVE' : isFinished ? 'FINISHED' : 'SCHEDULED';

    const groupName = m.stage === 'GROUP_STAGE' 
      ? (m.group ? m.group.replace('GROUP_', 'Groupe ').replace('Group ', 'Groupe ') : 'Groupe A') 
      : mapFdStage(m.stage);

    return {
      id: matchId,
      homeTeam: homeTeamName,
      awayTeam: awayTeamName,
      homeTla: normHomeTla,
      awayTla: normAwayTla,
      homeFlag: getFlag(normHomeTla),
      awayFlag: getFlag(normAwayTla),
      homeScore: homeScore,
      awayScore: awayScore,
      status: status,
      time: isLive ? "Direct" : timeStr,
      kickoffTime: timeStr,
      date: dateStr,
      utcDate: matchDate.toISOString(),
      liveMinute: isLive ? calculateLiveMinute(matchDate.toISOString()) : null,
      group: groupName,
      stadium: getStadiumForMatch(
        homeTeamName,
        awayTeamName,
        groupName,
        matchId
      ),
      events: getDeterministicEvents(matchId, normHomeTla, normAwayTla, homeScore, awayScore, null),
      stats: getDeterministicStats(matchId, homeScore, awayScore)
    };
  });

  const mappedMatches = mapKnockoutStages(matches);

  const groupsList = ["Groupe A", "Groupe B", "Groupe C", "Groupe D", "Groupe E", "Groupe F", "Groupe G", "Groupe H", "Groupe I", "Groupe J", "Groupe K", "Groupe L"];
  const groupsStandings = {};
  groupsList.forEach(g => {
    groupsStandings[g] = computeGroupStandings(mappedMatches, g);
  });

  return {
    dataSource: "api",
    matches: mappedMatches,
    stadiums: getStaticStadiums(),
    moroccoSquad: getStaticSquad(),
    standings: {
      groups: groupsStandings,
      ...computeScorersAndAssists(mappedMatches)
    },
    news: getStaticNews()
  };
}

export async function initApi() {
  await updateWorldCupGames();

  // 1. Tenter d'interroger OpenLigaDB via /api-proxy
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch('/api-proxy', { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const rawData = await response.json();
    if (rawData.error) {
      throw new Error(rawData.error);
    }
    
    return parseOpenLigaDBData(rawData);
  } catch (error) {
    console.warn("⚠️ Impossible de joindre l'API OpenLigaDB via proxy, tentative avec football-data.org...", error);
    
    // 2. Tenter d'interroger football-data.org via /api-footballdata
    try {
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 3000);
      const response = await fetch('/api-footballdata', { signal: controller2.signal });
      clearTimeout(timeoutId2);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const rawData = await response.json();
      if (rawData.error) {
        throw new Error(rawData.error);
      }
      
      return parseFootballData(rawData);
    } catch (error2) {
      console.warn("⚠️ Impossible de joindre football-data.org via proxy, chargement des données de secours locales :", error2);
      return getFallbackData();
    }
  }
}

// Fonction de calcul des classements en fonction des scores réels (basée sur les TLA uniques et robustes)
export function computeGroupStandings(matches, groupName) {
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

export function parseMatchDateTimeToUTC(dateStr, timeStr) {
  const monthsFr = {
    'janvier': 0, 'février': 1, 'mars': 2, 'avril': 3, 'mai': 4, 'juin': 5,
    'juillet': 6, 'août': 7, 'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11
  };
  const clean = (dateStr || '').toLowerCase().trim();
  const parts = clean.split(' ');
  const day = parseInt(parts[0], 10) || 11;
  const monthStr = parts[1] || 'juin';
  const year = parseInt(parts[2], 10) || 2026;
  const month = monthsFr[monthStr] !== undefined ? monthsFr[monthStr] : 5;

  const timeParts = (timeStr || '20:00').split(':');
  const hours = parseInt(timeParts[0], 10) || 20;
  const minutes = parseInt(timeParts[1], 10) || 0;

  // Casablanca time is UTC+1 in June 2026
  const utcDate = new Date(Date.UTC(year, month, day, hours - 1, minutes, 0));
  return utcDate.toISOString();
}

export function calculateLiveMinute(utcDateStr) {
  if (!utcDateStr) return null;
  const matchDate = new Date(utcDateStr);
  const now = new Date();
  const timeDiff = now.getTime() - matchDate.getTime();
  const elapsed = Math.floor(timeDiff / 60000);

  if (elapsed < 0) return 1;
  if (elapsed <= 45) {
    return elapsed;
  } else if (elapsed > 45 && elapsed <= 60) {
    return 'MT'; // Half-time
  } else {
    const playTime = elapsed - 15;
    return Math.min(90, playTime);
  }
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
    { name: "Issa Diop", pos: "Défenseurs", num: 15, club: "Fulham" },
    { name: "Anass Salah-Eddine", pos: "Défenseurs", num: 20, club: "PSV Eindhoven" },
    { name: "Youssef Belammari", pos: "Défenseurs", num: 13, club: "Al Ahly" },
    { name: "Redouane Halhal", pos: "Défenseurs", num: 24, club: "KV Mechelen" },
    { name: "Zakaria El Ouahdi", pos: "Défenseurs", num: 27, club: "KRC Genk" },

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
    { rank: 1, player: "Vinícius Júnior", team: "Brésil", tla: "BRA", flag: getFlag("BRA"), goals: 0 },
    { rank: 2, player: "Brahim Díaz", team: "Maroc", tla: "MAR", flag: getFlag("MAR"), goals: 0 },
    { rank: 3, player: "Santiago Giménez", team: "Mexique", tla: "MEX", flag: getFlag("MEX"), goals: 0 },
    { rank: 4, player: "Christian Pulisic", team: "États-Unis", tla: "USA", flag: getFlag("USA"), goals: 0 }
  ];
}

function getStaticAssists() {
  return [
    { rank: 1, player: "Rodrygo", team: "Brésil", tla: "BRA", flag: getFlag("BRA"), assists: 0 },
    { rank: 2, player: "Achraf Hakimi", team: "Maroc", tla: "MAR", flag: getFlag("MAR"), assists: 0 },
    { rank: 3, player: "Hirving Lozano", team: "Mexique", tla: "MEX", flag: getFlag("MEX"), assists: 0 },
    { rank: 4, player: "Weston McKennie", team: "États-Unis", tla: "USA", flag: getFlag("USA"), assists: 0 }
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
    { tla: "NOR", name: "Norvège" },
    { tla: "ITA", name: "Italie" },
    { tla: "HON", name: "Honduras" }
  ],
  "Groupe J": [
    { tla: "PRT", name: "Portugal" },
    { tla: "COD", name: "RD Congo" },
    { tla: "UZB", name: "Ouzbékistan" },
    { tla: "COL", name: "Colombie" },
    { tla: "CMR", name: "Cameroun" },
    { tla: "CRC", name: "Costa Rica" },
    { tla: "UAE", name: "Émirats Arabes Unis" }
  ],
  "Groupe K": [
    { tla: "ARG", name: "Argentine" },
    { tla: "DZA", name: "Algérie" },
    { tla: "AUT", name: "Autriche" },
    { tla: "JOR", name: "Jordanie" },
    { tla: "NGA", name: "Nigéria" },
    { tla: "JAM", name: "Jamaïque" },
    { tla: "OMA", name: "Oman" }
  ],
  "Groupe L": [
    { tla: "ENG", name: "Angleterre" },
    { tla: "CRO", name: "Croatie" },
    { tla: "GHA", name: "Ghana" },
    { tla: "PAN", name: "Panama" }
  ]
};

function getFallbackData() {
  const matches = realMatches.map(m => {
    const utcDate = m.utcDate || parseMatchDateTimeToUTC(m.date, m.time);
    const matchDate = new Date(utcDate);
    const now = new Date();
    const timeDiff = now.getTime() - matchDate.getTime();
    const matchDurationMs = 2 * 60 * 60 * 1000;

    let status = m.status;
    if (m.status !== 'FINISHED') {
      if (timeDiff > 0 && timeDiff < matchDurationMs) {
        status = 'LIVE';
      } else if (timeDiff >= matchDurationMs) {
        status = 'FINISHED';
      }
    }

    const isLive = status === 'LIVE';
    const liveMinute = isLive ? calculateLiveMinute(utcDate) : null;

    return {
      ...m,
      status: status,
      time: isLive ? "Direct" : m.time,
      kickoffTime: m.time,
      utcDate: utcDate,
      liveMinute: liveMinute,
      homeFlag: getFlag(m.homeTla),
      awayFlag: getFlag(m.awayTla),
      stadium: getStadiumForMatch(m.homeTeam, m.awayTeam, m.group, m.id),
      events: getDeterministicEvents(m.id, m.homeTla, m.awayTla, m.homeScore, m.awayScore, null),
      stats: getDeterministicStats(m.id, m.homeScore, m.awayScore)
    };
  });

  const mappedMatches = mapKnockoutStages(matches);

  const groupsList = ["Groupe A", "Groupe B", "Groupe C", "Groupe D", "Groupe E", "Groupe F", "Groupe G", "Groupe H", "Groupe I", "Groupe J", "Groupe K", "Groupe L"];
  const groupsStandings = {};
  groupsList.forEach(g => {
    groupsStandings[g] = computeGroupStandings(mappedMatches, g);
  });

  return {
    dataSource: "fallback",
    matches: mappedMatches,
    stadiums: getStaticStadiums(),
    moroccoSquad: getStaticSquad(),
    standings: {
      groups: groupsStandings,
      ...computeScorersAndAssists(mappedMatches)
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

export function getStadiumForMatch(homeTeam, awayTeam, groupName, matchId) {
  const home = (homeTeam || "").toLowerCase();
  const away = (awayTeam || "").toLowerCase();
  const group = (groupName || "").toLowerCase();

  // 0. Phase éliminatoire (Knockout)
  const isKnockout = group.includes("finale") || group.includes("quarter") || group.includes("semi") || group.includes("round") || group.includes("seizième") || group.includes("huitième");
  if (isKnockout) {
    if (home.includes("maroc") || home.includes("moroc") || away.includes("maroc") || away.includes("moroc")) {
      return "Monterrey Stadium";
    }
  }

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

// Détecteur pseudo-aléatoire déterministe pour conserver la cohérence
export function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

function parseScorersString(str) {
  if (!str || str === 'null' || str === 'NULL') return [];
  try {
    const cleaned = str
      .replace(/[“”]/g, '"')
      .replace(/’/g, "'")
      .replace(/[{]/g, '[')
      .replace(/[}]/g, ']');
    const arr = JSON.parse(cleaned);
    if (!Array.isArray(arr)) return [];
    
    return arr.map(item => {
      const match = item.match(/(.+?)\s+(\d+)'/);
      if (match) {
        return {
          player: match[1].trim(),
          minute: parseInt(match[2], 10)
        };
      }
      return {
        player: item.trim(),
        minute: 0
      };
    });
  } catch (e) {
    console.warn('Erreur lors du parsing des buteurs:', str, e);
    return [];
  }
}

export function getDeterministicEvents(matchId, homeTla, awayTla, homeScore, awayScore, apiGoals) {
  const events = [];

  // 1. Tenter de trouver le match correspondant dans l'API worldcup26.ir
  if (worldCupApiGames && worldCupApiGames.length > 0) {
    const irGame = worldCupApiGames.find(g => {
      const irHomeTla = englishToTla[g.home_team_name_en?.toLowerCase()];
      const irAwayTla = englishToTla[g.away_team_name_en?.toLowerCase()];
      return (irHomeTla === homeTla && irAwayTla === awayTla) || 
             (irHomeTla === awayTla && irAwayTla === homeTla);
    });

    if (irGame) {
      const isSwapped = englishToTla[irGame.home_team_name_en?.toLowerCase()] === awayTla;
      const homeScorers = parseScorersString(irGame.home_scorers);
      const awayScorers = parseScorersString(irGame.away_scorers);

      // Load squad players for both teams
      const homePlayers = TEAMS_SQUADS[homeTla.toUpperCase()] || [{ name: "Joueur A" }];
      const awayPlayers = TEAMS_SQUADS[awayTla.toUpperCase()] || [{ name: "Joueur B" }];

      homeScorers.forEach((s, idx) => {
        let detail = 'normal';
        let name = s.player || '';
        if (name.toLowerCase().includes('(pen)') || name.toLowerCase().includes('(p)')) {
          detail = 'penalty';
          name = name.replace(/\(pen\)/i, '').replace(/\(p\)/i, '').trim();
        } else if (name.toLowerCase().includes('(og)') || name.toLowerCase().includes('(csc)')) {
          detail = 'own_goal';
          name = name.replace(/\(og\)/i, '').replace(/\(csc\)/i, '').trim();
        }
        
        let assistPlayerName = null;
        if (detail === 'normal') {
          const prngAssist = mulberry32(matchId + s.minute + idx + 100);
          if (prngAssist() < 0.7) {
            const list = isSwapped ? awayPlayers : homePlayers;
            const teammates = list.filter(p => p.name !== name);
            if (teammates.length > 0) {
              assistPlayerName = teammates[Math.floor(prngAssist() * teammates.length)].name;
            }
          }
        }

        events.push({
          type: 'goal',
          detail: detail,
          minute: s.minute,
          team: isSwapped ? 'away' : 'home',
          player: name,
          assist: assistPlayerName
        });
      });

      awayScorers.forEach((s, idx) => {
        let detail = 'normal';
        let name = s.player || '';
        if (name.toLowerCase().includes('(pen)') || name.toLowerCase().includes('(p)')) {
          detail = 'penalty';
          name = name.replace(/\(pen\)/i, '').replace(/\(p\)/i, '').trim();
        } else if (name.toLowerCase().includes('(og)') || name.toLowerCase().includes('(csc)')) {
          detail = 'own_goal';
          name = name.replace(/\(og\)/i, '').replace(/\(csc\)/i, '').trim();
        }

        let assistPlayerName = null;
        if (detail === 'normal') {
          const prngAssist = mulberry32(matchId + s.minute + idx + 200);
          if (prngAssist() < 0.7) {
            const list = isSwapped ? homePlayers : awayPlayers;
            const teammates = list.filter(p => p.name !== name);
            if (teammates.length > 0) {
              assistPlayerName = teammates[Math.floor(prngAssist() * teammates.length)].name;
            }
          }
        }

        events.push({
          type: 'goal',
          detail: detail,
          minute: s.minute,
          team: isSwapped ? 'home' : 'away',
          player: name,
          assist: assistPlayerName
        });
      });

      events.sort((a, b) => a.minute - b.minute);
      if (events.length > 0) {
        return events;
      }
    }
  }

  // 2. Repli sur l'API OpenLigaDB
  if (!apiGoals || apiGoals.length === 0) {
    return events; // Pas de données réelles -> pas d'événements
  }

  const homePlayers = TEAMS_SQUADS[homeTla.toUpperCase()] || [{ name: "Joueur A" }];
  const awayPlayers = TEAMS_SQUADS[awayTla.toUpperCase()] || [{ name: "Joueur B" }];

  // Trier les buts reçus par l'API
  const sortedGoals = [...apiGoals].sort((a, b) => a.matchMinute - b.matchMinute || a.goalID - b.goalID);
  
  for (let i = 0; i < sortedGoals.length; i++) {
    const goal = sortedGoals[i];
    let scoringTeam = 'home';
    
    if (i === 0) {
      if (goal.scoreTeam2 > 0) scoringTeam = 'away';
    } else {
      const prevGoal = sortedGoals[i - 1];
      if (goal.scoreTeam2 > prevGoal.scoreTeam2) scoringTeam = 'away';
    }

    let player = goal.goalGetterName;
    if (!player || player.trim() === "") {
      const prng = mulberry32(matchId + i + 100);
      const list = scoringTeam === 'home' ? homePlayers : awayPlayers;
      player = list[Math.floor(prng() * list.length)].name;
    }

    let detail = 'normal';
    if (goal.isPenalty) detail = 'penalty';
    if (goal.isOwnGoal) detail = 'own_goal';

    let assistPlayerName = null;
    if (detail === 'normal') {
      const prngAssist = mulberry32(matchId + i + 400);
      if (prngAssist() < 0.7) {
        const list = scoringTeam === 'home' ? homePlayers : awayPlayers;
        const teammates = list.filter(p => p.name !== player);
        if (teammates.length > 0) {
          assistPlayerName = teammates[Math.floor(prngAssist() * teammates.length)].name;
        }
      }
    }

    events.push({
      type: 'goal',
      detail: detail,
      minute: goal.matchMinute,
      team: scoringTeam,
      player: player,
      assist: assistPlayerName
    });
  }

  // Trier tous les événements par minute
  events.sort((a, b) => a.minute - b.minute);
  return events;
}

export function getDeterministicStats(matchId, homeScore, awayScore) {
  const prng = mulberry32(matchId + 500);
  
  // Possession must sum to 100
  let homePossession = Math.round(45 + prng() * 10);
  if (homeScore > awayScore) {
    homePossession = Math.round(homePossession + 2 + prng() * 6);
  } else if (awayScore > homeScore) {
    homePossession = Math.round(homePossession - 6 + prng() * 4);
  }
  homePossession = Math.min(75, Math.max(25, homePossession)); // Keep between 25% and 75%
  const awayPossession = 100 - homePossession;

  // xG based on scores
  const homeXg = (homeScore * 0.8 + prng() * 0.9).toFixed(2);
  const awayXg = (awayScore * 0.8 + prng() * 0.9).toFixed(2);

  // Shots on target and total shots
  const homeShotsOnTarget = homeScore + Math.floor(prng() * 4);
  const homeShotsTotal = homeShotsOnTarget + Math.floor(prng() * 6) + 1;

  const awayShotsOnTarget = awayScore + Math.floor(prng() * 4);
  const awayShotsTotal = awayShotsOnTarget + Math.floor(prng() * 6) + 1;

  // Passes and pass accuracy
  const homePasses = Math.floor(300 + prng() * 250);
  const homePassAcc = Math.floor(72 + prng() * 16);
  
  const awayPasses = Math.floor(300 + prng() * 250);
  const awayPassAcc = Math.floor(72 + prng() * 16);

  // Corners
  const homeCorners = Math.floor(1 + prng() * 7);
  const awayCorners = Math.floor(1 + prng() * 7);

  // Fouls
  const homeFouls = Math.floor(7 + prng() * 11);
  const awayFouls = Math.floor(7 + prng() * 11);

  // Saves (based on opponent's shots on target)
  const homeSaves = Math.max(0, awayShotsOnTarget - awayScore + Math.floor(prng() * 2));
  const awaySaves = Math.max(0, homeShotsOnTarget - homeScore + Math.floor(prng() * 2));

  return {
    possession: [homePossession, awayPossession],
    xg: [homeXg, awayXg],
    target: [homeShotsOnTarget, awayShotsOnTarget],
    shots: [homeShotsTotal, awayShotsTotal],
    passes: [homePasses, awayPasses],
    passAcc: [homePassAcc, awayPassAcc],
    corners: [homeCorners, awayCorners],
    fouls: [homeFouls, awayFouls],
    saves: [homeSaves, awaySaves]
  };
}

export function computeScorersAndAssists(matches) {
  const scorersMap = new Map();
  const assistsMap = new Map();

  matches.forEach(m => {
    // On ne compte que les buts des matchs commencés ou terminés
    if ((m.status === 'LIVE' || m.status === 'FINISHED') && m.events) {
      m.events.forEach(e => {
        if (e.type === 'goal' && e.detail !== 'own_goal') {
          let scoringTeamTla = '';
          if (e.team === 'home') {
            scoringTeamTla = m.homeTla;
          } else if (e.team === 'away') {
            scoringTeamTla = m.awayTla;
          } else {
            scoringTeamTla = m.homeTla;
          }

          if (e.player) {
            const playerKey = `${e.player}_${scoringTeamTla}`;
            if (!scorersMap.has(playerKey)) {
              scorersMap.set(playerKey, {
                player: e.player,
                tla: scoringTeamTla,
                team: e.team === 'home' ? m.homeTeam : m.awayTeam,
                goals: 0
              });
            }
            scorersMap.get(playerKey).goals++;
          }

          if (e.assist) {
            const assistPlayer = e.assist;
            const assistKey = `${assistPlayer}_${scoringTeamTla}`;
            if (!assistsMap.has(assistKey)) {
              assistsMap.set(assistKey, {
                player: assistPlayer,
                tla: scoringTeamTla,
                team: e.team === 'home' ? m.homeTeam : m.awayTeam,
                assists: 0
              });
            }
            assistsMap.get(assistKey).assists++;
          }
        }
      });
    }
  });

  // Trier et formater les buteurs
  const sortedScorers = Array.from(scorersMap.values())
    .sort((a, b) => b.goals - a.goals || a.player.localeCompare(b.player))
    .map((s, idx) => ({
      rank: idx + 1,
      player: s.player,
      team: s.team,
      tla: s.tla,
      flag: getFlag(s.tla),
      goals: s.goals
    }));

  // Trier et formater les passeurs
  const sortedAssists = Array.from(assistsMap.values())
    .sort((a, b) => b.assists - a.assists || a.player.localeCompare(b.player))
    .map((s, idx) => ({
      rank: idx + 1,
      player: s.player,
      team: s.team,
      tla: s.tla,
      flag: getFlag(s.tla),
      assists: s.assists
    }));

  // Charger les buteurs et passeurs statiques par défaut pour remplir si vide
  const staticScorers = getStaticScorers();
  const staticAssists = getStaticAssists();

  // Si on a moins de 4 buteurs réels, on complète avec les statiques par défaut
  staticScorers.forEach(st => {
    if (sortedScorers.length < 10 && !sortedScorers.some(s => s.player === st.player)) {
      sortedScorers.push({
        ...st,
        rank: sortedScorers.length + 1
      });
    }
  });

  // Si on a moins de 4 passeurs réels, on complète avec les statiques par défaut
  staticAssists.forEach(sa => {
    if (sortedAssists.length < 10 && !sortedAssists.some(s => s.player === sa.player)) {
      sortedAssists.push({
        ...sa,
        rank: sortedAssists.length + 1
      });
    }
  });

  return {
    scorers: sortedScorers.slice(0, 10),
    assists: sortedAssists.slice(0, 10)
  };
}
