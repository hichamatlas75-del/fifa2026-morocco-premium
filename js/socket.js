import { 
  getDeterministicEvents, 
  getDeterministicStats, 
  updateWorldCupGames, 
  parseOpenLigaDBData, 
  parseFootballData,
  calculateLiveMinute 
} from './api.js';
import { TEAMS_SQUADS } from './teams_squads.js';

let lastMatchesState = [];
let pollingIntervalId = null;

export function setupWebSockets(app) {
    console.log("🔌 Initialisation de la connexion temps réel...");

    let wsConnected = false;

    // Tenter une vraie connexion WebSocket vers le serveur configuré
    if (app.socketUrl) {
        try {
            console.log("🔌 [WebSocket] Tentative de connexion à :", app.socketUrl);
            const socket = new WebSocket(app.socketUrl);
            
            socket.onopen = () => {
                console.log("🔌 [WebSocket] Connexion établie avec le serveur.");
                wsConnected = true;
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data && data.matchId) {
                        console.log("🔌 [WebSocket] Événement reçu instantanément :", data);
                        app.updateMatchCard(data);
                        if (data.event === 'GOAL') {
                            app.triggerGoalAnimation(data.matchId);
                        }
                    }
                } catch (err) {
                    console.warn("🔌 [WebSocket] Erreur lors de la lecture du message :", err);
                }
            };

            socket.onerror = (err) => {
                console.warn("🔌 [WebSocket] Erreur de connexion détectée.");
            };

            socket.onclose = () => {
                console.log("🔌 [WebSocket] Connexion fermée.");
                if (wsConnected) {
                    wsConnected = false;
                    fallbackToPolling(app);
                }
            };
        } catch (e) {
            console.warn("🔌 [WebSocket] Impossible d'initialiser WebSocket:", e);
            fallbackToPolling(app);
        }
    } else {
        fallbackToPolling(app);
    }

    // Lancer la première détection des proxys pour le polling et démarrer le simulateur d'actions
    fallbackToPolling(app);
}

function fallbackToPolling(app) {
    // Tenter de faire une première requête pour tester la présence des proxys Cloudflare
    fetch('/api-proxy')
        .then(res => {
            if (!res.ok) throw new Error('Proxy OpenLigaDB non disponible');
            return res.json();
        })
        .then(data => {
            console.log("✅ Proxy d'API OpenLigaDB détecté. Activation du mode Polling réel.");
            startPolling(app);
            startRealTimeActionSimulation(app);
        })
        .catch(err => {
            console.warn("⚠️ Proxy OpenLigaDB inaccessible. Tentative avec Football-Data...", err);
            fetch('/api-footballdata')
                .then(res => {
                    if (!res.ok) throw new Error('Proxy Football-Data non disponible');
                    return res.json();
                })
                .then(data => {
                    console.log("✅ Proxy d'API Football-Data détecté. Activation du mode Polling réel.");
                    startPolling(app);
                    startRealTimeActionSimulation(app);
                })
                .catch(err2 => {
                    console.warn("⚠️ Les deux proxys sont inaccessibles. Polling standard & simulation démarrés.", err2);
                    startPolling(app);
                    startRealTimeActionSimulation(app);
                });
        });
}

function startPolling(app) {
    // Clear any existing polling interval to prevent stacking
    if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
        pollingIntervalId = null;
    }

    // Stocker l'état initial des matchs pour la comparaison des buts
    if (app.data && app.data.matches) {
        lastMatchesState = JSON.parse(JSON.stringify(app.data.matches));
    }

    // Interroger l'API toutes les 30 secondes
    pollingIntervalId = setInterval(async () => {
        try {
            // Mettre à jour les buteurs réels depuis worldcup26.ir
            await updateWorldCupGames();

            let normalizedMatches = [];
            let source = 'openligadb';

            try {
                const res = await fetch('/api-proxy');
                if (!res.ok) throw new Error('Erreur de réponse du proxy OpenLigaDB');
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                const parsed = parseOpenLigaDBData(data);
                normalizedMatches = parsed.matches;
            } catch (err1) {
                console.warn("⚠️ API OpenLigaDB indisponible en polling, tentative avec Football-Data...", err1);
                try {
                    const res = await fetch('/api-footballdata');
                    if (!res.ok) throw new Error('Erreur de réponse du proxy Football-Data');
                    const data = await res.json();
                    if (data.error) throw new Error(data.error);
                    const parsed = parseFootballData(data);
                    normalizedMatches = parsed.matches;
                    source = 'footballdata';
                } catch (err2) {
                    console.warn("⚠️ Les deux API de polling sont indisponibles.", err2);
                    return; // Retenter au prochain intervalle
                }
            }

            if (!normalizedMatches || normalizedMatches.length === 0) return;

            normalizedMatches.forEach(polledMatch => {
                // Trouver l'état précédent par id
                let prevMatch = lastMatchesState.find(x => x.id === polledMatch.id);
                // Si non trouvé par ID, chercher par TLA
                if (!prevMatch && polledMatch.homeTla && polledMatch.awayTla) {
                    prevMatch = lastMatchesState.find(x => x.homeTla === polledMatch.homeTla && x.awayTla === polledMatch.awayTla);
                }

                if (prevMatch) {
                    const homeScore = polledMatch.homeScore;
                    const awayScore = polledMatch.awayScore;
                    const status = polledMatch.status;

                    // Détecter si un but a été marqué
                    const homeGoal = homeScore > prevMatch.homeScore;
                    const awayGoal = awayScore > prevMatch.awayScore;
                    const goalScored = homeGoal || awayGoal;
                    
                    let scoringTeam = '';
                    if (homeGoal) scoringTeam = prevMatch.homeTla;
                    if (awayGoal) scoringTeam = prevMatch.awayTla;

                    // Détecter le coup d'envoi (passage de SCHEDULED à LIVE)
                    const isKickoff = prevMatch.status === 'SCHEDULED' && status === 'LIVE';

                    // Récupérer/calculer les minutes de jeu si LIVE
                    let liveMinute = polledMatch.liveMinute || prevMatch.liveMinute;
                    if (status === 'LIVE' && polledMatch.utcDate) {
                        liveMinute = calculateLiveMinute(polledMatch.utcDate);
                    }

                    // Mettre à jour l'état de référence local
                    prevMatch.homeScore = homeScore;
                    prevMatch.awayScore = awayScore;
                    prevMatch.status = status;
                    prevMatch.events = polledMatch.events;
                    prevMatch.stats = polledMatch.stats;
                    if (liveMinute) {
                        prevMatch.liveMinute = liveMinute;
                    }

                    const updateData = {
                        matchId: prevMatch.id, // Toujours utiliser le stable matchId de prevMatch
                        homeScore: homeScore,
                        awayScore: awayScore,
                        time: status === 'LIVE' ? 'Direct' : prevMatch.time,
                        status: status,
                        event: goalScored ? 'GOAL' : null,
                        team: scoringTeam,
                        score: `${homeScore} - ${awayScore}`,
                        events: polledMatch.events,
                        stats: polledMatch.stats,
                        liveMinute: liveMinute
                    };

                    // Mettre à jour l'UI et l'état de l'application
                    app.updateMatchCard(updateData);

                    // Si le coup d'envoi est donné
                    if (isKickoff) {
                        const homeTeamTranslated = app.t(`teams.${prevMatch.homeTla.toUpperCase()}`, prevMatch.homeTeam);
                        const awayTeamTranslated = app.t(`teams.${prevMatch.awayTla.toUpperCase()}`, prevMatch.awayTeam);
                        const kickoffMsg = app.t('notification.kickoff', "Coup d'envoi ! Le match {home} - {away} a commencé.")
                            .replace('{home}', homeTeamTranslated)
                            .replace('{away}', awayTeamTranslated);
                        app.sendPushNotification(kickoffMsg);
                    }

                    // Si un but est marqué, déclencher les effets premium
                    if (goalScored) {
                        app.triggerGoalAnimation(prevMatch.id);
                        const scoringTeamTranslated = app.t(`teams.${scoringTeam.toUpperCase()}`, scoringTeam);
                        const goalMsg = app.t('notification.goal', "BUT ! {team} vient de marquer ! Score : {score}")
                            .replace('{team}', scoringTeamTranslated)
                            .replace('{score}', `${homeScore} - ${awayScore}`);
                        app.sendPushNotification(goalMsg);
                    }
                }
            });
        } catch (e) {
            console.warn("Erreur lors de la mise à jour des scores réels:", e);
        }
    }, 30000);
}

let simulationIntervalId = null;

function startRealTimeActionSimulation(app) {
    if (simulationIntervalId) {
        clearInterval(simulationIntervalId);
        simulationIntervalId = null;
    }

    console.log("🎮 [Simulation] Démarrage du simulateur d'actions en temps réel...");

    simulationIntervalId = setInterval(() => {
        if (!app.data || !app.data.matches) return;

        // Trouver tous les matchs en direct
        const liveMatches = app.data.matches.filter(m => m.status === 'LIVE');
        if (liveMatches.length === 0) return;

        // Choisir un match en direct aléatoire
        const match = liveMatches[Math.floor(Math.random() * liveMatches.length)];
        
        // Choisir une action à simuler
        const rand = Math.random();
        
        let goalScored = false;
        let isHome = Math.random() > 0.5;
        let notificationMsg = '';

        // Obtenir la minute actuelle de jeu
        const currentMin = match.liveMinute || 45;

        // Récupérer les effectifs pour choisir un joueur réaliste
        const homeSquad = TEAMS_SQUADS[match.homeTla.toUpperCase()] || [{ name: "Joueur A" }];
        const awaySquad = TEAMS_SQUADS[match.awayTla.toUpperCase()] || [{ name: "Joueur B" }];
        const chosenPlayer = isHome 
            ? homeSquad[Math.floor(Math.random() * homeSquad.length)].name 
            : awaySquad[Math.floor(Math.random() * awaySquad.length)].name;

        // Initialiser events et stats s'ils n'existent pas
        if (!match.events) match.events = [];
        if (!match.stats) {
            match.stats = {
                possession: [50, 50],
                xg: ["0.00", "0.00"],
                target: [0, 0],
                shots: [0, 0],
                passes: [150, 150],
                passAcc: [80, 80],
                corners: [0, 0],
                fouls: [0, 0],
                saves: [0, 0]
            };
        }

        if (rand < 0.08) {
            // 1. BUT !
            goalScored = true;

            const goalRand = Math.random();
            let goalDetail = 'normal';
            if (goalRand < 0.12) {
                goalDetail = 'penalty';
            } else if (goalRand < 0.20) {
                goalDetail = 'own_goal';
            }

            if (goalDetail === 'own_goal') {
                if (isHome) {
                    match.awayScore++;
                } else {
                    match.homeScore++;
                }
            } else {
                if (isHome) {
                    match.homeScore++;
                } else {
                    match.awayScore++;
                }
            }

            match.events.push({
                type: 'goal',
                detail: goalDetail,
                minute: currentMin,
                team: isHome ? 'home' : 'away',
                player: chosenPlayer
            });

            // Ajuster les stats
            if (goalDetail === 'own_goal') {
                if (isHome) {
                    match.stats.target[1]++;
                    match.stats.shots[1]++;
                    match.stats.xg[1] = (parseFloat(match.stats.xg[1]) + 0.5).toFixed(2);
                } else {
                    match.stats.target[0]++;
                    match.stats.shots[0]++;
                    match.stats.xg[0] = (parseFloat(match.stats.xg[0]) + 0.5).toFixed(2);
                }
            } else {
                const xgVal = goalDetail === 'penalty' ? 0.76 : (0.4 + Math.random() * 0.4);
                if (isHome) {
                    match.stats.target[0]++;
                    match.stats.shots[0]++;
                    match.stats.xg[0] = (parseFloat(match.stats.xg[0]) + xgVal).toFixed(2);
                } else {
                    match.stats.target[1]++;
                    match.stats.shots[1]++;
                    match.stats.xg[1] = (parseFloat(match.stats.xg[1]) + xgVal).toFixed(2);
                }
            }

            const scoreStr = `${match.homeScore} - ${match.awayScore}`;
            let notificationMsgKey = 'notification.goal';
            let defaultNotifMsg = "BUT ! {team} vient de marquer ! Score : {score}";

            if (goalDetail === 'penalty') {
                notificationMsgKey = 'notification.goal_penalty';
                defaultNotifMsg = "BUT sur penalty ! {team} marque ! Score : {score}";
            } else if (goalDetail === 'own_goal') {
                notificationMsgKey = 'notification.goal_own_goal';
                defaultNotifMsg = "BUT contre son camp ! Score : {score}";
            }

            const scoringTeamIsHome = goalDetail === 'own_goal' ? !isHome : isHome;
            const teamName = scoringTeamIsHome ? match.homeTeam : match.awayTeam;
            const teamTla = scoringTeamIsHome ? match.homeTla : match.awayTla;
            const teamNameTrans = app.t(`teams.${teamTla.toUpperCase()}`, teamName);

            if (goalDetail === 'own_goal') {
                const ownGoalPlayerTeamTla = isHome ? match.homeTla : match.awayTla;
                const ownGoalPlayerTeamName = isHome ? match.homeTeam : match.awayTeam;
                const playerTeamTrans = app.t(`teams.${ownGoalPlayerTeamTla.toUpperCase()}`, ownGoalPlayerTeamName);
                notificationMsg = app.t(notificationMsgKey, "BUT contre son camp de {player} ({playerTeam}) ! Score : {score}")
                    .replace('{player}', chosenPlayer)
                    .replace('{playerTeam}', playerTeamTrans)
                    .replace('{score}', scoreStr);
            } else {
                notificationMsg = app.t(notificationMsgKey, defaultNotifMsg)
                    .replace('{team}', teamNameTrans)
                    .replace('{score}', scoreStr)
                    .replace('{player}', chosenPlayer);
            }

        } else if (rand < 0.12) {
            // 1b. PENALTY MANQUÉ
            match.events.push({
                type: 'penalty_miss',
                detail: 'penalty_miss',
                minute: currentMin,
                team: isHome ? 'home' : 'away',
                player: chosenPlayer
            });

            if (isHome) {
                match.stats.shots[0]++;
                match.stats.xg[0] = (parseFloat(match.stats.xg[0]) + 0.76).toFixed(2);
            } else {
                match.stats.shots[1]++;
                match.stats.xg[1] = (parseFloat(match.stats.xg[1]) + 0.76).toFixed(2);
            }

        } else if (rand < 0.26) {
            // 2. CARTONS (jaune ou rouge)
            const cardRand = Math.random();
            const cardDetail = cardRand < 0.85 ? 'yellow' : 'red';

            match.events.push({
                type: 'card',
                detail: cardDetail,
                minute: currentMin,
                team: isHome ? 'home' : 'away',
                player: chosenPlayer
            });
            
            if (isHome) {
                match.stats.fouls[0]++;
            } else {
                match.stats.fouls[1]++;
            }

        } else {
            // 3. ACTION DE JEU (Tir non cadré, tir arrêté, corner)
            const actionRand = Math.random();
            if (actionRand < 0.35) {
                // Tir arrêté (Saves/Target/Shots)
                if (isHome) {
                    match.stats.shots[0]++;
                    match.stats.target[0]++;
                    match.stats.saves[1]++; // Gardien adverse arrête
                    match.stats.xg[0] = (parseFloat(match.stats.xg[0]) + 0.12).toFixed(2);
                } else {
                    match.stats.shots[1]++;
                    match.stats.target[1]++;
                    match.stats.saves[0]++; // Gardien arrête
                    match.stats.xg[1] = (parseFloat(match.stats.xg[1]) + 0.12).toFixed(2);
                }
            } else if (actionRand < 0.70) {
                // Tir non cadré
                if (isHome) {
                    match.stats.shots[0]++;
                    match.stats.xg[0] = (parseFloat(match.stats.xg[0]) + 0.06).toFixed(2);
                } else {
                    match.stats.shots[1]++;
                    match.stats.xg[1] = (parseFloat(match.stats.xg[1]) + 0.06).toFixed(2);
                }
            } else {
                // Corner
                if (isHome) {
                    match.stats.corners[0]++;
                } else {
                    match.stats.corners[1]++;
                }
            }
            // Mettre à jour les passes légèrement
            match.stats.passes[0] += Math.floor(Math.random() * 5) + 1;
            match.stats.passes[1] += Math.floor(Math.random() * 5) + 1;
        }

        // Toujours trier les évènements par minute
        match.events.sort((a, b) => {
            if (a.minute === 'MT') return -1;
            if (b.minute === 'MT') return 1;
            return a.minute - b.minute;
        });

        // Préparer l'objet de mise à jour
        const updateData = {
            matchId: match.id,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            time: 'Direct',
            status: 'LIVE',
            event: goalScored ? 'GOAL' : 'ACTION',
            team: isHome ? match.homeTla : match.awayTla,
            score: `${match.homeScore} - ${match.awayScore}`,
            events: match.events,
            stats: match.stats,
            liveMinute: match.liveMinute
        };

        // Propager la mise à jour à l'UI
        app.updateMatchCard(updateData);

        if (goalScored) {
            app.triggerGoalAnimation(match.id);
            if (notificationMsg) {
                app.sendPushNotification(notificationMsg);
            }
        }
    }, 12000); // Toutes les 12 secondes
}

