// js/socket.js

let lastMatchesState = [];

export function setupWebSockets(app) {
    console.log("🔌 Initialisation de la connexion temps réel...");

    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // Tenter de faire une première requête pour tester la présence du proxy Cloudflare
    fetch('/api-proxy')
        .then(res => {
            if (!res.ok) throw new Error('Proxy non disponible');
            return res.json();
        })
        .then(data => {
            console.log("✅ Proxy d'API Cloudflare détecté. Activation du mode Réel Polling.");
            startPolling(app);
        })
        .catch(err => {
            if (isLocal) {
                console.warn("⚠️ Proxy inaccessible en local. Activation du mode Simulation.");
                startSimulation(app);
            } else {
                console.error("❌ Erreur de connexion au proxy d'API en production. Pas de simulation active.");
                // En production, on lance quand même startPolling pour retenter la connexion en arrière-plan régulièrement
                startPolling(app);
            }
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

            if (!data.matches) return;

            data.matches.forEach(m => {
                const isLive = m.status === 'IN_PLAY' || m.status === 'PAUSED';
                const status = isLive ? 'LIVE' : m.status === 'FINISHED' ? 'FINISHED' : 'SCHEDULED';
                const homeScore = m.score.fullTime.home ?? 0;
                const awayScore = m.score.fullTime.away ?? 0;

                // Trouver l'état précédent stocké dans l'app
                const prevMatch = lastMatchesState.find(x => x.id === m.id);

                if (prevMatch) {
                    // Détecter si un but a été marqué
                    const homeGoal = homeScore > prevMatch.homeScore;
                    const awayGoal = awayScore > prevMatch.awayScore;
                    const goalScored = homeGoal || awayGoal;
                    
                    let scoringTeam = '';
                    if (homeGoal) scoringTeam = prevMatch.homeTeam;
                    if (awayGoal) scoringTeam = prevMatch.awayTeam;

                    // Mettre à jour l'état de référence local
                    prevMatch.homeScore = homeScore;
                    prevMatch.awayScore = awayScore;
                    prevMatch.status = status;

                    const updateData = {
                        matchId: m.id,
                        homeScore: homeScore,
                        awayScore: awayScore,
                        time: isLive ? 'Direct' : prevMatch.time,
                        status: status,
                        event: goalScored ? 'GOAL' : null,
                        team: scoringTeam,
                        score: `${homeScore} - ${awayScore}`
                    };

                    // Mettre à jour l'UI du match
                    app.updateMatchCard(updateData);

                    // Si un but est marqué, déclencher les effets premium
                    if (goalScored) {
                        app.triggerGoalAnimation(m.id);
                        app.sendPushNotification(`BUT ! ${scoringTeam} vient de marquer ! Score : ${homeScore} - ${awayScore}`);
                    }
                }
            });
        } catch (e) {
            console.warn("Erreur lors de la mise à jour des scores réels:", e);
        }
    }, 30000);
}

function startSimulation(app) {
    let isSimulating = false;
    if (isSimulating) return;
    isSimulating = true;
    console.log('⚡ Simulateur local démarré.');

    let currentMinute = 5;
    let homeScore = 0;
    let awayScore = 0;

    setInterval(() => {
        const match = app.data && app.data.matches ? app.data.matches.find(m => m.id === 1) : null;
        const homeName = match ? match.homeTeam : 'Mexique';
        const awayName = match ? match.awayTeam : 'Afrique du Sud';

        if (currentMinute >= 90) {
            currentMinute = 0;
            homeScore = 0;
            awayScore = 0;
        } else {
            currentMinute += Math.floor(Math.random() * 6) + 1;
            if (currentMinute > 90) currentMinute = 90;
        }

        let event = null;
        let team = null;
        let scoreStr = `${homeScore} - ${awayScore}`;

        // 15% de chance de but
        if (currentMinute > 0 && currentMinute < 90 && Math.random() < 0.15) {
            event = 'GOAL';
            if (Math.random() > 0.4) {
                homeScore++;
                team = homeName;
            } else {
                awayScore++;
                team = awayName;
            }
            scoreStr = `${homeScore} - ${awayScore}`;
        } else if (Math.random() < 0.25) {
            event = 'CARD';
            team = Math.random() > 0.5 ? homeName : awayName;
        }

        const updateData = {
            matchId: 1,
            homeScore: homeScore,
            awayScore: awayScore,
            time: currentMinute === 90 ? 'FT' : `${currentMinute}'`,
            event: event,
            team: team,
            score: scoreStr,
            status: currentMinute === 90 ? 'FINISHED' : 'LIVE'
        };

        // Appeler la mise à jour sur l'application
        if (app && typeof app.updateMatchCard === 'function') {
            app.updateMatchCard(updateData);
        }

        if (event === 'GOAL') {
            if (app && typeof app.triggerGoalAnimation === 'function') {
                app.triggerGoalAnimation(1);
            }
            if (app && typeof app.sendPushNotification === 'function') {
                app.sendPushNotification(`BUT ! ${team} vient de marquer ! Score : ${scoreStr}`);
            }
        }
    }, 12000);
}
