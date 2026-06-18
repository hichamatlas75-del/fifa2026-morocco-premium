// js/socket.js
import { 
  getDeterministicEvents, 
  getDeterministicStats, 
  updateWorldCupGames, 
  parseOpenLigaDBData, 
  parseFootballData 
} from './api.js';

let lastMatchesState = [];
let pollingIntervalId = null;

export function setupWebSockets(app) {
    console.log("🔌 Initialisation de la connexion temps réel...");

    // Tenter de faire une première requête pour tester la présence des proxys Cloudflare
    fetch('/api-proxy')
        .then(res => {
            if (!res.ok) throw new Error('Proxy OpenLigaDB non disponible');
            return res.json();
        })
        .then(data => {
            console.log("✅ Proxy d'API OpenLigaDB détecté. Activation du mode Polling réel.");
            startPolling(app);
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
                })
                .catch(err2 => {
                    console.warn("⚠️ Les deux proxys sont inaccessibles. Les scores resteront en attente.", err2);
                    startPolling(app);
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
                        const matchDate = new Date(polledMatch.utcDate);
                        const now = new Date();
                        const timeDiff = now.getTime() - matchDate.getTime();
                        const elapsed = Math.floor(timeDiff / 60000);
                        liveMinute = Math.min(90, Math.max(1, elapsed));
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

