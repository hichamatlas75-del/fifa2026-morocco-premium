export function setupWebSockets(app) {
    let socket;
    let isSimulating = false;

    try {
        if (typeof io !== 'undefined') {
            socket = io(app.socketUrl, { 
                transports: ['websocket'],
                timeout: 3000,
                reconnectionAttempts: 2
            });
            
            socket.on('connect', () => {
                console.log('🔴 Connecté au flux réel en direct');
            });
            
            socket.on('match_update', (data) => {
                handleUpdate(data);
            });

            socket.on('connect_error', () => {
                console.warn('Impossible de se connecter au flux réel, basculement en mode simulation.');
                startSimulation();
            });
        } else {
            console.warn('Socket.io non défini, démarrage du mode simulation.');
            startSimulation();
        }
    } catch (e) {
        console.error('Erreur WebSocket, démarrage du mode simulation:', e);
        startSimulation();
    }

    function handleUpdate(data) {
        if (app && typeof app.updateMatchCard === 'function') {
            app.updateMatchCard(data);
        }

        if (data.event === 'GOAL') {
            if (app && typeof app.triggerGoalAnimation === 'function') {
                app.triggerGoalAnimation(data.matchId);
            }
            if (app && typeof app.sendPushNotification === 'function') {
                const teamName = data.team === 'Maroc' ? '🇲🇦 Maroc' : '🇭🇷 Croatie';
                app.sendPushNotification(`BUT ! ${teamName} vient de marquer ! Score : ${data.score}`);
            }
        }
    }

    function startSimulation() {
        if (isSimulating) return;
        isSimulating = true;
        console.log('⚡ Simulateur temps réel démarré.');

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

            // 15% de chance de but par intervalle
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

            handleUpdate(updateData);
        }, 12000); // Simule toutes les 12 secondes
    }
}
