// js/socket.js

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
            console.log("✅ Proxy d'API Cloudflare détecté. Activation du mode Réel Polling.");
            startPolling(app);
        })
        .catch(err => {
            console.warn("⚠️ Proxy inaccessible. Les scores resteront en attente jusqu'au retour de l'API.", err);
            // Continuer à retenter la connexion en arrière-plan, sans simulation locale.
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

            if (!data.matches) return;

            data.matches.forEach(m => {
                const isLive = m.status === 'IN_PLAY' || m.status === 'PAUSED';
                const status = isLive ? 'LIVE' : m.status === 'FINISHED' ? 'FINISHED' : 'SCHEDULED';
                const homeScore = m.score?.fullTime?.home ?? 0;
                const awayScore = m.score?.fullTime?.away ?? 0;

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
