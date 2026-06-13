// js/socket.js
import { getDeterministicEvents, getDeterministicStats } from './api.js';

let lastMatchesState = [];

export function setupWebSockets(app) {
    console.log("🔌 Initialisation de la connexion temps réel...");

    // Tenter de faire une première requête pour tester la présence du proxy Cloudflare
    fetch('/api-proxy')
        .then(res => {
            if (!res.ok) throw new Error('Proxy non disponible');
            return res.json();
        })
        .then(data => {
            console.log("✅ Proxy d'API Cloudflare détecté. Activation du mode Polling réel.");
            startPolling(app);
        })
        .catch(err => {
            console.warn("⚠️ Proxy inaccessible. Les scores resteront en attente jusqu'au retour de l'API.", err);
            // Continuer à retenter la connexion en arrière-plan
            startPolling(app);
        });
}

function startPolling(app) {
    // Stocker l'état initial des matchs pour la comparaison des buts
    if (app.data && app.data.matches) {
        lastMatchesState = JSON.parse(JSON.stringify(app.data.matches));
    }

    // Interroger l'API toutes les 30 secondes
    setInterval(async () => {
        try {
            const res = await fetch('/api-proxy');
            if (!res.ok) throw new Error('Erreur de réponse du proxy');
            const data = await res.json();

            const rawMatches = Array.isArray(data) ? data : (data.matches || []);
            if (rawMatches.length === 0) return;

            rawMatches.forEach(m => {
                const isFinished = m.matchIsFinished;
                const now = new Date();
                const matchDate = new Date(m.matchDateTimeUTC || m.matchDateTime);
                const timeDiff = now.getTime() - matchDate.getTime();
                const matchDurationMs = 2 * 60 * 60 * 1000;
                const isLive = !isFinished && timeDiff > 0 && timeDiff < matchDurationMs;
                const status = isLive ? 'LIVE' : isFinished ? 'FINISHED' : 'SCHEDULED';

                // Déterminer les scores
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

                // Trouver l'état précédent stocké dans l'app
                const prevMatch = lastMatchesState.find(x => x.id === m.matchID);

                if (prevMatch) {
                    // Détecter si un but a été marqué
                    const homeGoal = homeScore > prevMatch.homeScore;
                    const awayGoal = awayScore > prevMatch.awayScore;
                    const goalScored = homeGoal || awayGoal;
                    
                    let scoringTeam = '';
                    if (homeGoal) scoringTeam = prevMatch.homeTeam;
                    if (awayGoal) scoringTeam = prevMatch.awayTeam;

                    // Détecter le coup d'envoi (passage de SCHEDULED à LIVE)
                    const isKickoff = prevMatch.status === 'SCHEDULED' && status === 'LIVE';

                    // Générer la chronologie et les statistiques mises à jour
                    const events = getDeterministicEvents(m.matchID, prevMatch.homeTla, prevMatch.awayTla, homeScore, awayScore, m.goals);
                    const stats = getDeterministicStats(m.matchID, homeScore, awayScore);

                    // Mettre à jour l'état de référence local
                    prevMatch.homeScore = homeScore;
                    prevMatch.awayScore = awayScore;
                    prevMatch.status = status;
                    prevMatch.events = events;
                    prevMatch.stats = stats;

                    const updateData = {
                        matchId: m.matchID,
                        homeScore: homeScore,
                        awayScore: awayScore,
                        time: isLive ? 'Direct' : prevMatch.time,
                        status: status,
                        event: goalScored ? 'GOAL' : null,
                        team: scoringTeam,
                        score: `${homeScore} - ${awayScore}`,
                        events: events,
                        stats: stats
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
                        app.triggerGoalAnimation(m.matchID);
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
