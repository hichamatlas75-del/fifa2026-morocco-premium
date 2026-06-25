// js/app.js

// Global Error Handler for visual debugging in client environment
window.addEventListener('error', (event) => {
    let errorBox = document.getElementById('debug-error-box');
    if (!errorBox) {
        errorBox = document.createElement('div');
        errorBox.id = 'debug-error-box';
        errorBox.style.cssText = "position: fixed; bottom: 20px; right: 20px; background: rgba(193, 39, 45, 0.95); border: 2px solid #FFD700; color: white; padding: 1.5rem; border-radius: 12px; z-index: 9999; max-width: 400px; font-family: monospace; font-size: 0.8rem; box-shadow: 0 10px 30px rgba(0,0,0,0.5); backdrop-filter: blur(10px);";
        document.body.appendChild(errorBox);
    }
    errorBox.innerHTML = `
        <h4 style="color: #FFD700; margin-bottom: 0.5rem; text-transform: uppercase;">⚠️ Client-side Error</h4>
        <p style="margin-bottom: 0.5rem; word-break: break-all;"><strong>${event.message}</strong></p>
        <p style="opacity: 0.7; font-size: 0.75rem; word-break: break-all;">at ${event.filename}:${event.lineno}:${event.colno}</p>
    `;
});

import { initApi, getH2HData, getFlag, getDeterministicEvents, getDeterministicStats, calculateLiveMinute, computeGroupStandings, computeScorersAndAssists, getStadiumForMatch } from './api.js';
import { setupWebSockets } from './socket.js';
import { TEAMS_SQUADS } from './teams_squads.js';
import { 
    renderMatches, 
    renderLiveMatches, 
    renderTeams, 
    renderMoroccoSquad, 
    renderStandings, 
    renderNews 
} from './components/matches.js';
import { initPremiumFeatures, refreshPremiumFeatures } from './features.js';

const ROUND_NAMES = {
    fr: { r32: 'Seizièmes de finale', r16: 'Huitièmes de finale', qf: 'Quarts de finale', sf: 'Demi-finales', final: 'Finale' },
    en: { r32: 'Round of 32', r16: 'Round of 16', qf: 'Quarter Finals', sf: 'Semi Finals', final: 'Final' },
    es: { r32: 'Dieciseisavos de final', r16: 'Octavos de final', qf: 'Cuartos de final', sf: 'Semifinales', final: 'Final' },
    ar: { r32: 'دور الـ 32', r16: 'دور الـ 16', qf: 'ربع النهائي', sf: 'نصف النهائي', final: 'النهائي' }
};

const ROUND_SHORT_NAMES = {
    fr: { r32: '16es', r16: '8es', qf: 'Quarts', sf: 'Demis', final: 'Finale' },
    en: { r32: 'R32', r16: 'R16', qf: 'Quarters', sf: 'Semis', final: 'Final' },
    es: { r32: '16vos', r16: '8vos', qf: 'Cuartos', sf: 'Semis', final: 'Final' },
    ar: { r32: 'دور 32', r16: 'دور 16', qf: 'ربع', sf: 'نصف', final: 'النهائي' }
};

class WorldCupApp {
    constructor() {
        this.socketUrl = 'wss://api.football-data-premium.com/live';
        // Langue configurée à partir du localStorage ou français par défaut
        this.currentLang = localStorage.getItem('lang') || 'fr';
        this.data = null;
        this.map = null;
        this.chart = null;
        this.i18n = null;
        this.favoriteTeam = localStorage.getItem('favoriteTeam') || 'MAR';
        this._modalAbortController = null;
        this._searchDebounceTimer = null;
        
        this.init();
    }

    async init() {
        // Initialisation des animations AOS si disponibles
        if (typeof AOS !== 'undefined') {
            AOS.init({ once: true, offset: 80 });
        }

        // Configuration PWA (désenregistrement propre par défaut)
        this.registerServiceWorker();

        // Gestion du thème
        this.setupThemeToggle();
        
        // Gestion du menu mobile
        this.setupMobileMenu();

        // Demander la permission pour les notifications
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                console.log("🔔 [App] Permission de notification :", permission);
            });
        }

        // Charger les traductions initiales
        await this.loadTranslations();

        // Initialisation des API & WebSockets
        try {
            this.data = await initApi();
            
            // Initialisation des rendus de base
            this.applyInitialRender(true);
            initPremiumFeatures(this);

            // Remplissage dynamique des filtres de recherche
            this.populateFilterDropdowns();

            // Attacher les écouteurs sur les filtres
            this.setupFilterListeners();

            // Attacher l'écouteur pour les détails de match (délégation d'événements unique)
            this.setupMatchDetailsListener();

            // Configurer le switcher de langue
            this.setupLanguageSwitcher();

            // Initialiser les sockets (avec simulation si en local)
            setupWebSockets(this);

            // Initialiser la carte Leaflet
            this.initMap(this.data.stadiums);

            // Initialiser le graphique tactique
            this.initChart();

        } catch (error) {
            console.error('Erreur de chargement des données FIFA:', error);
            this.displayOnlineError(error);
        }
    }

    displayOnlineError(error) {
        // Masquer le badge de synchronisation
        const badge = document.getElementById('data-source-badge');
        if (badge) {
            badge.style.display = 'none';
        }

        // Afficher l'erreur dans les conteneurs de grilles majeurs
        const containers = ['calendar-grid', 'live-matches-grid', 'teams-grid', 'morocco-dashboard', 'groups-container', 'top-scorers', 'top-assists'];
        containers.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 2rem; background: rgba(193, 39, 45, 0.05); border: 1px solid var(--rouge-maroc); border-radius: 12px; color: var(--white); font-family: sans-serif; font-size: 0.9rem;">
                        <i class="fa-solid fa-triangle-exclamation" style="color: var(--rouge-maroc); font-size: 1.8rem; margin-bottom: 0.8rem;"></i>
                        <h4 style="margin-bottom: 0.5rem; text-transform: uppercase; font-weight: 700; color: var(--rouge-maroc);">Erreur de Connexion Directe</h4>
                        <p style="opacity: 0.8;">Impossible de charger les données en ligne. Jeton d'API (FOOTBALL_DATA_API_TOKEN) manquant ou invalide.</p>
                        <p style="font-size: 0.75rem; opacity: 0.5; margin-top: 0.5rem; font-family: monospace; word-break: break-all;">${error.message || error}</p>
                    </div>
                `;
            }
        });
    }

    applyInitialRender(shouldScroll = false) {
        if (!this.data) return;
        renderMatches(this.data.matches, 'calendar-grid', shouldScroll);
        renderLiveMatches(this.data.matches);
        renderTeams(this.data.matches);
        renderMoroccoSquad(this.data.moroccoSquad);
        renderStandings(this.data.standings);
        renderNews(this.data.news);
        this.computeKnockoutBracket();
        this.renderRoadToTheFinal();

        const savedMode = localStorage.getItem('rtf-view-mode') || 'list';
        if (savedMode === 'tree') {
            this.renderRoadToTheFinalTree();
            setTimeout(() => this.adjustTreeScale(), 150);
        }
    }

    computeKnockoutBracket() {
        if (!this.data || !this.data.matches) return;

        const isPlaceholderTla = (tla) => {
            if (!tla || tla === 'TBD') return true;
            if (tla.length !== 3) return true;
            if (/\d/.test(tla)) return true; // contient un chiffre (ex: 1F, 2E)
            return false;
        };

        const getTeamInfo = (tla) => {
            if (isPlaceholderTla(tla)) return { tla: 'TBD', name: 'À déterminer' };
            const name = this.t(`teams.${tla}`, tla);
            return { tla, name };
        };

        const getWinnerTla = (match) => {
            if (!match || isPlaceholderTla(match.homeTla) || isPlaceholderTla(match.awayTla)) return 'TBD';
            if (match.status !== 'FINISHED') return 'TBD';
            if (match.homeScore > match.awayScore) return match.homeTla;
            if (match.awayScore > match.homeScore) return match.awayTla;
            return (match.id % 2 === 0) ? match.homeTla : match.awayTla;
        };

        const getLoserTla = (match) => {
            if (!match || isPlaceholderTla(match.homeTla) || isPlaceholderTla(match.awayTla)) return 'TBD';
            if (match.status !== 'FINISHED') return 'TBD';
            if (match.homeScore > match.awayScore) return match.awayTla;
            if (match.awayScore > match.homeScore) return match.homeTla;
            return (match.id % 2 === 0) ? match.awayTla : match.homeTla;
        };

        // --- CALCUL DES QUALIFIÉS DU PREMIER TOUR (1/16 DE FINALE) ---
        const groups = ["Groupe A", "Groupe B", "Groupe C", "Groupe D", "Groupe E", "Groupe F", "Groupe G", "Groupe H", "Groupe I", "Groupe J", "Groupe K", "Groupe L"];
        
        const winners = {};
        const runnersUp = {};
        const thirdPlaces = [];
        
        const allGroupsFinished = groups.every(g => {
            const groupMatches = this.data.matches.filter(m => m.group === g || m.group === g.replace("Groupe", "Group"));
            const finishedCount = groupMatches.filter(m => m.status === 'FINISHED').length;
            return groupMatches.length > 0 && finishedCount === groupMatches.length;
        });

        groups.forEach(g => {
            const groupCode = g.charAt(g.length - 1); // A, B, C...
            const groupMatches = this.data.matches.filter(m => m.group === g || m.group === g.replace("Groupe", "Group"));
            const finishedCount = groupMatches.filter(m => m.status === 'FINISHED').length;
            const isGroupFinished = groupMatches.length > 0 && finishedCount === groupMatches.length;

            const standings = computeGroupStandings(this.data.matches, g);
            
            const first = isGroupFinished && standings[0] ? standings[0].tla : 'TBD';
            const second = isGroupFinished && standings[1] ? standings[1].tla : 'TBD';
            const third = isGroupFinished && standings[2] ? standings[2].tla : 'TBD';
            
            winners[groupCode] = first;
            runnersUp[groupCode] = second;
            
            if (isGroupFinished && third && third !== 'TBD') {
                thirdPlaces.push({
                    tla: third,
                    pts: standings[2].pts,
                    gd: (standings[2].gf - standings[2].ga),
                    gf: standings[2].gf,
                    group: groupCode
                });
            }
        });
        
        // Classer les meilleurs 3èmes
        thirdPlaces.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.tla.localeCompare(b.tla));
        
        const bestThirds = [];
        for (let i = 0; i < 8; i++) {
            if (allGroupsFinished && thirdPlaces[i]) {
                bestThirds.push(thirdPlaces[i].tla);
            } else {
                bestThirds.push('TBD');
            }
        }

        const r32Pairings = [
            { id: 85000, home: runnersUp['A'], away: runnersUp['B'], homePlaceholder: '2A', awayPlaceholder: '2B' }, // M73
            { id: 85001, home: winners['E'], away: bestThirds[3], homePlaceholder: '1E', awayPlaceholder: '3ABCDF' }, // M74
            { id: 85002, home: winners['F'], away: runnersUp['C'], homePlaceholder: '1F', awayPlaceholder: '2C' }, // M75
            { id: 85003, home: winners['C'], away: runnersUp['F'], homePlaceholder: '1C', awayPlaceholder: '2F' }, // M76
            { id: 85004, home: winners['I'], away: bestThirds[5], homePlaceholder: '1I', awayPlaceholder: '3CDFGH' }, // M77
            { id: 85005, home: runnersUp['E'], away: runnersUp['I'], homePlaceholder: '2E', awayPlaceholder: '2I' }, // M78
            { id: 85006, home: winners['A'], away: bestThirds[0], homePlaceholder: '1A', awayPlaceholder: '3CEFHI' }, // M79
            { id: 85007, home: winners['L'], away: bestThirds[7], homePlaceholder: '1L', awayPlaceholder: '3EHIJK' }, // M80
            { id: 85008, home: winners['G'], away: bestThirds[4], homePlaceholder: '1G', awayPlaceholder: '3AEHIJ' }, // M81
            { id: 85009, home: winners['D'], away: bestThirds[2], homePlaceholder: '1D', awayPlaceholder: '3BEFIJ' }, // M82
            { id: 85010, home: runnersUp['K'], away: runnersUp['L'], homePlaceholder: '2K', awayPlaceholder: '2L' }, // M83
            { id: 85011, home: winners['H'], away: runnersUp['J'], homePlaceholder: '1H', awayPlaceholder: '2J' }, // M84
            { id: 85012, home: winners['B'], away: bestThirds[1], homePlaceholder: '1B', awayPlaceholder: '3EFGIJ' }, // M85
            { id: 85013, home: winners['K'], away: runnersUp['H'], homePlaceholder: '1K', awayPlaceholder: '2H' }, // M86
            { id: 85014, home: runnersUp['D'], away: runnersUp['G'], homePlaceholder: '2D', awayPlaceholder: '2G' }, // M87
            { id: 85015, home: winners['J'], away: bestThirds[6], homePlaceholder: '1J', awayPlaceholder: '3DEIJL' }  // M88
        ];

        // --- PRÉDICTION DYNAMIQUE ACTIVE POUR LES 16èmes DE FINALE ---
        r32Pairings.forEach(pairing => {
            const m = this.data.matches.find(match => match.id === pairing.id);
            if (m) {
                m.homePlaceholder = pairing.homePlaceholder;
                m.awayPlaceholder = pairing.awayPlaceholder;
                // Seulement si non résolu par l'API
                if (isPlaceholderTla(m.homeTla)) {
                    m.homeTla = pairing.home || 'TBD';
                    m.homeTeam = getTeamInfo(m.homeTla).name;
                    m.homeFlag = getFlag(m.homeTla);
                }
                if (isPlaceholderTla(m.awayTla)) {
                    m.awayTla = pairing.away || 'TBD';
                    m.awayTeam = getTeamInfo(m.awayTla).name;
                    m.awayFlag = getFlag(m.awayTla);
                }
                m.stadium = getStadiumForMatch(m.homeTeam, m.awayTeam, m.group, m.id);
            }
        });

        // Huitièmes (85016 à 85023)
        const r16Sources = [
            { id: 85016, src: [85001, 85004], homePlaceholder: 'V85001', awayPlaceholder: 'V85004' }, // M89 = W74 vs W77
            { id: 85017, src: [85000, 85002], homePlaceholder: 'V85000', awayPlaceholder: 'V85002' }, // M90 = W73 vs W75
            { id: 85018, src: [85010, 85011], homePlaceholder: 'V85010', awayPlaceholder: 'V85011' }, // M93 = W83 vs W84
            { id: 85019, src: [85012, 85014], homePlaceholder: 'V85012', awayPlaceholder: 'V85014' }, // M94 = W85 vs W87
            { id: 85020, src: [85003, 85005], homePlaceholder: 'V85003', awayPlaceholder: 'V85005' }, // M91 = W76 vs W78
            { id: 85021, src: [85006, 85007], homePlaceholder: 'V85006', awayPlaceholder: 'V85007' }, // M92 = W79 vs W80
            { id: 85022, src: [85008, 85009], homePlaceholder: 'V85008', awayPlaceholder: 'V85009' }, // M95 = W81 vs W82
            { id: 85023, src: [85013, 85015], homePlaceholder: 'V85013', awayPlaceholder: 'V85015' }  // M96 = W86 vs W88
        ];

        r16Sources.forEach(source => {
            const m = this.data.matches.find(match => match.id === source.id);
            if (m) {
                m.homePlaceholder = source.homePlaceholder;
                m.awayPlaceholder = source.awayPlaceholder;
                const m1 = this.data.matches.find(match => match.id === source.src[0]);
                const m2 = this.data.matches.find(match => match.id === source.src[1]);
                if (m1 && m2) {
                    const w1 = getWinnerTla(m1);
                    const w2 = getWinnerTla(m2);
                    if (isPlaceholderTla(m.homeTla)) {
                        m.homeTla = w1;
                        m.homeTeam = getTeamInfo(w1).name;
                        m.homeFlag = getFlag(w1);
                    }
                    if (isPlaceholderTla(m.awayTla)) {
                        m.awayTla = w2;
                        m.awayTeam = getTeamInfo(w2).name;
                        m.awayFlag = getFlag(w2);
                    }
                    m.stadium = getStadiumForMatch(m.homeTeam, m.awayTeam, m.group, m.id);
                }
            }
        });

        // Quarts (85024 à 85027)
        const qfSources = [
            { id: 85024, src: [85016, 85017], homePlaceholder: 'V85016', awayPlaceholder: 'V85017' },
            { id: 85025, src: [85018, 85019], homePlaceholder: 'V85018', awayPlaceholder: 'V85019' },
            { id: 85026, src: [85020, 85021], homePlaceholder: 'V85020', awayPlaceholder: 'V85021' },
            { id: 85027, src: [85022, 85023], homePlaceholder: 'V85022', awayPlaceholder: 'V85023' }
        ];

        qfSources.forEach(source => {
            const m = this.data.matches.find(match => match.id === source.id);
            if (m) {
                m.homePlaceholder = source.homePlaceholder;
                m.awayPlaceholder = source.awayPlaceholder;
                const m1 = this.data.matches.find(match => match.id === source.src[0]);
                const m2 = this.data.matches.find(match => match.id === source.src[1]);
                if (m1 && m2) {
                    const w1 = getWinnerTla(m1);
                    const w2 = getWinnerTla(m2);
                    if (isPlaceholderTla(m.homeTla)) {
                        m.homeTla = w1;
                        m.homeTeam = getTeamInfo(w1).name;
                        m.homeFlag = getFlag(w1);
                    }
                    if (isPlaceholderTla(m.awayTla)) {
                        m.awayTla = w2;
                        m.awayTeam = getTeamInfo(w2).name;
                        m.awayFlag = getFlag(w2);
                    }
                    m.stadium = getStadiumForMatch(m.homeTeam, m.awayTeam, m.group, m.id);
                }
            }
        });

        // Demis (85028 à 85029)
        const sfSources = [
            { id: 85028, src: [85024, 85025], homePlaceholder: 'V85024', awayPlaceholder: 'V85025' },
            { id: 85029, src: [85026, 85027], homePlaceholder: 'V85026', awayPlaceholder: 'V85027' }
        ];

        sfSources.forEach(source => {
            const m = this.data.matches.find(match => match.id === source.id);
            if (m) {
                m.homePlaceholder = source.homePlaceholder;
                m.awayPlaceholder = source.awayPlaceholder;
                const m1 = this.data.matches.find(match => match.id === source.src[0]);
                const m2 = this.data.matches.find(match => match.id === source.src[1]);
                if (m1 && m2) {
                    const w1 = getWinnerTla(m1);
                    const w2 = getWinnerTla(m2);
                    if (isPlaceholderTla(m.homeTla)) {
                        m.homeTla = w1;
                        m.homeTeam = getTeamInfo(w1).name;
                        m.homeFlag = getFlag(w1);
                    }
                    if (isPlaceholderTla(m.awayTla)) {
                        m.awayTla = w2;
                        m.awayTeam = getTeamInfo(w2).name;
                        m.awayFlag = getFlag(w2);
                    }
                    m.stadium = getStadiumForMatch(m.homeTeam, m.awayTeam, m.group, m.id);
                }
            }
        });

        // Finale (85031) et Petite Finale (85030)
        const fMatch = this.data.matches.find(match => match.id === 85031);
        const sf1 = this.data.matches.find(match => match.id === 85028);
        const sf2 = this.data.matches.find(match => match.id === 85029);

        if (fMatch) {
            fMatch.homePlaceholder = 'V85028';
            fMatch.awayPlaceholder = 'V85029';
            if (sf1 && sf2) {
                const w1 = getWinnerTla(sf1);
                const w2 = getWinnerTla(sf2);
                if (isPlaceholderTla(fMatch.homeTla)) {
                    fMatch.homeTla = w1;
                    fMatch.homeTeam = getTeamInfo(w1).name;
                    fMatch.homeFlag = getFlag(w1);
                }
                if (isPlaceholderTla(fMatch.awayTla)) {
                    fMatch.awayTla = w2;
                    fMatch.awayTeam = getTeamInfo(w2).name;
                    fMatch.awayFlag = getFlag(w2);
                }
                fMatch.stadium = getStadiumForMatch(fMatch.homeTeam, fMatch.awayTeam, fMatch.group, fMatch.id);
            }
        }

        const t3Match = this.data.matches.find(match => match.id === 85030);
        if (t3Match) {
            t3Match.homePlaceholder = 'P85028';
            t3Match.awayPlaceholder = 'P85029';
            if (sf1 && sf2) {
                const l1 = getLoserTla(sf1);
                const l2 = getLoserTla(sf2);
                if (isPlaceholderTla(t3Match.homeTla)) {
                    t3Match.homeTla = l1;
                    t3Match.homeTeam = getTeamInfo(l1).name;
                    t3Match.homeFlag = getFlag(l1);
                }
                if (isPlaceholderTla(t3Match.awayTla)) {
                    t3Match.awayTla = l2;
                    t3Match.awayTeam = getTeamInfo(l2).name;
                    t3Match.awayFlag = getFlag(l2);
                }
                t3Match.stadium = getStadiumForMatch(t3Match.homeTeam, t3Match.awayTeam, t3Match.group, t3Match.id);
            }
        }
    }

    _renderBracketMatch(matchId) {
        const match = this.data.matches.find(m => m.id === matchId);
        if (!match) return '';

        const homeTla = match.homeTla || 'TBD';
        const awayTla = match.awayTla || 'TBD';
        
        const homePlaceholder = match.homePlaceholder || 'TBD';
        const awayPlaceholder = match.awayPlaceholder || 'TBD';

        const homeFlag = homeTla === 'TBD' ? '<div class="rtf-team-circle empty-circle">?</div>' : `<div class="rtf-team-circle">${getFlag(homeTla)}</div>`;
        const awayFlag = awayTla === 'TBD' ? '<div class="rtf-team-circle empty-circle">?</div>' : `<div class="rtf-team-circle">${getFlag(awayTla)}</div>`;

        const homeName = homeTla === 'TBD' ? 'À déterminer' : this.t(`teams.${homeTla}`, match.homeTeam);
        const awayName = awayTla === 'TBD' ? 'À déterminer' : this.t(`teams.${awayTla}`, match.awayTeam);

        const homeText = homeTla === 'TBD' ? homePlaceholder : `${homeTla} (${homePlaceholder})`;
        const awayText = awayTla === 'TBD' ? awayPlaceholder : `${awayTla} (${awayPlaceholder})`;

        const homeScore = (match.status === 'LIVE' || match.status === 'FINISHED') ? match.homeScore : '-';
        const awayScore = (match.status === 'LIVE' || match.status === 'FINISHED') ? match.awayScore : '-';

        const isHomeWinner = match.status === 'FINISHED' && match.homeScore > match.awayScore;
        const isAwayWinner = match.status === 'FINISHED' && match.awayScore > match.homeScore;

        return `
            <div class="rtf-match-pair match-card" id="match-${matchId}" style="cursor: pointer;">
                <div class="rtf-team-row ${isHomeWinner ? 'winner-row' : ''}">
                    <div class="rtf-team-info">
                        ${homeFlag}
                        <span class="rtf-team-tla" title="${homeName}">${homeText}</span>
                    </div>
                    <span class="rtf-team-score">${homeScore}</span>
                </div>
                <div class="rtf-team-row ${isAwayWinner ? 'winner-row' : ''}">
                    <div class="rtf-team-info">
                        ${awayFlag}
                        <span class="rtf-team-tla" title="${awayName}">${awayText}</span>
                    </div>
                    <span class="rtf-team-score">${awayScore}</span>
                </div>
                <div class="rtf-match-info-meta">
                    ${match.status === 'LIVE' ? '<span style="color:var(--red-maroc); font-weight:bold; animation: blink 1s infinite;"><span class="live-pulse" style="display:inline-block; margin-right:4px;"></span>LIVE</span>' : (match.status === 'FINISHED' ? 'Terminé' : match.time)}
                </div>
            </div>
        `;
    }

    renderRoadToTheFinal() {
        const container = document.getElementById('rtf-bracket');
        if (!container) return;

        // Vainqueur final
        const finalMatch = this.data.matches.find(m => m.id === 85031);
        let winnerTla = 'TBD';
        if (finalMatch && finalMatch.status === 'FINISHED') {
            winnerTla = finalMatch.homeScore > finalMatch.awayScore ? finalMatch.homeTla : finalMatch.awayTla;
        }
        
        const championNames = {
            fr: 'Champion',
            en: 'Champion',
            es: 'Campeón',
            ar: 'البطل'
        };
        const defaultChamp = championNames[this.currentLang] || championNames['fr'];
        const winnerName = winnerTla === 'TBD' ? defaultChamp : this.t(`teams.${winnerTla}`, winnerTla);
        const winnerFlagHtml = winnerTla === 'TBD' 
            ? '<i class="fa-solid fa-question text-gold" style="font-size: 1.5rem; opacity: 0.5;"></i>' 
            : getFlag(winnerTla);

        const lang = this.currentLang || 'fr';
        const rounds = ROUND_NAMES[lang] || ROUND_NAMES['fr'];

        container.innerHTML = `
            <!-- 1. Seizièmes Gauche -->
            <div class="rtf-column rtf-column-left-r32">
                <div class="rtf-column-title">${rounds.r32}</div>
                ${this._renderBracketMatch(85000)}
                ${this._renderBracketMatch(85001)}
                ${this._renderBracketMatch(85002)}
                ${this._renderBracketMatch(85003)}
                ${this._renderBracketMatch(85004)}
                ${this._renderBracketMatch(85005)}
                ${this._renderBracketMatch(85006)}
                ${this._renderBracketMatch(85007)}
            </div>

            <!-- 2. Huitièmes Gauche -->
            <div class="rtf-column rtf-column-left-r16">
                <div class="rtf-column-title">${rounds.r16}</div>
                ${this._renderBracketMatch(85016)}
                ${this._renderBracketMatch(85017)}
                ${this._renderBracketMatch(85018)}
                ${this._renderBracketMatch(85019)}
            </div>

            <!-- 3. Quarts Gauche -->
            <div class="rtf-column rtf-column-left-qf">
                <div class="rtf-column-title">${rounds.qf}</div>
                ${this._renderBracketMatch(85024)}
                ${this._renderBracketMatch(85025)}
            </div>

            <!-- 4. Demis Gauche -->
            <div class="rtf-column rtf-column-left-sf">
                <div class="rtf-column-title">${rounds.sf}</div>
                ${this._renderBracketMatch(85028)}
            </div>

            <!-- 5. Centre (Finale et Trophée) -->
            <div class="rtf-center-column">
                <div class="rtf-column-title" style="top: 15px;">${rounds.final}</div>
                
                <div class="rtf-trophy-container">
                    <div class="rtf-winner-circle">
                        ${winnerFlagHtml}
                    </div>
                    <div class="rtf-winner-label">${winnerName}</div>
                    <img src="./trophy.svg" class="rtf-trophy-img" alt="World Cup Trophy">
                </div>

                <div style="margin-top: 1.5rem; width: 100%; display: flex; justify-content: center;">
                    ${this._renderBracketMatch(85031)}
                </div>
            </div>

            <!-- 6. Demis Droite -->
            <div class="rtf-column rtf-column-right-sf">
                <div class="rtf-column-title">${rounds.sf}</div>
                ${this._renderBracketMatch(85029)}
            </div>

            <!-- 7. Quarts Droite -->
            <div class="rtf-column rtf-column-right-qf">
                <div class="rtf-column-title">${rounds.qf}</div>
                ${this._renderBracketMatch(85026)}
                ${this._renderBracketMatch(85027)}
            </div>

            <!-- 8. Huitièmes Droite -->
            <div class="rtf-column rtf-column-right-r16">
                <div class="rtf-column-title">${rounds.r16}</div>
                ${this._renderBracketMatch(85020)}
                ${this._renderBracketMatch(85021)}
                ${this._renderBracketMatch(85022)}
                ${this._renderBracketMatch(85023)}
            </div>

            <!-- 9. Seizièmes Droite -->
            <div class="rtf-column rtf-column-right-r32">
                <div class="rtf-column-title">${rounds.r32}</div>
                ${this._renderBracketMatch(85008)}
                ${this._renderBracketMatch(85009)}
                ${this._renderBracketMatch(85010)}
                ${this._renderBracketMatch(85011)}
                ${this._renderBracketMatch(85012)}
                ${this._renderBracketMatch(85013)}
                ${this._renderBracketMatch(85014)}
                ${this._renderBracketMatch(85015)}
            </div>
        `;
    }

    renderRoadToTheFinalTree() {
        const container = document.getElementById('rtf-tree-content');
        if (!container) return;

        const renderTreeCircle = (matchId, type) => {
            const match = this.data.matches.find(m => m.id === matchId);
            if (!match) return `<div class="rtf-tree-team-circle empty-circle">?</div>`;

            const tla = type === 'home' ? match.homeTla : match.awayTla;
            const teamName = type === 'home' ? match.homeTeam : match.awayTeam;
            const score = type === 'home' ? match.homeScore : match.awayScore;
            
            const placeholder = type === 'home' ? (match.homePlaceholder || 'TBD') : (match.awayPlaceholder || 'TBD');

            const isWinner = match.status === 'FINISHED' && (
                (type === 'home' && match.homeScore > match.awayScore) ||
                (type === 'away' && match.awayScore > match.homeScore)
            );

            if (!tla || tla === 'TBD') {
                return `<div class="rtf-tree-team-circle empty-circle" id="tree-circle-${type}-${matchId}" title="${placeholder} - ${this.t('modal.scheduled', 'Programmé')}" style="font-size:0.75rem; display:flex; align-items:center; justify-content:center; font-weight:bold; color:rgba(255,255,255,0.4);">${placeholder}</div>`;
            }

            const flagIcon = getFlag(tla);
            return `
                <div class="rtf-tree-team-circle ${isWinner ? 'winner-highlight' : ''}" 
                     id="tree-circle-${type}-${matchId}" 
                     data-team-tla="${tla}" 
                     title="${this.t(`teams.${tla}`, teamName)} (${placeholder}) (${match.status === 'FINISHED' || match.status === 'LIVE' ? score : '-'})"
                     style="cursor: pointer;">
                     ${flagIcon}
                </div>
            `;
        };

        const renderTreeMatch = (matchId) => {
            return `
                <div class="rtf-tree-match" id="tree-match-${matchId}">
                    ${renderTreeCircle(matchId, 'home')}
                    ${renderTreeCircle(matchId, 'away')}
                </div>
            `;
        };

        // Center Trophy and Champion
        const finalMatch = this.data.matches.find(m => m.id === 85031);
        let winnerTla = 'TBD';
        if (finalMatch && finalMatch.status === 'FINISHED') {
            winnerTla = finalMatch.homeScore > finalMatch.awayScore ? finalMatch.homeTla : finalMatch.awayTla;
        }
        
        const championNames = {
            fr: 'Champion',
            en: 'Champion',
            es: 'Campeón',
            ar: 'البطل'
        };
        const defaultChamp = championNames[this.currentLang] || championNames['fr'];
        const winnerName = winnerTla === 'TBD' ? defaultChamp : this.t(`teams.${winnerTla}`, winnerTla);
        const winnerFlag = winnerTla === 'TBD' 
            ? '<div class="rtf-tree-team-circle empty-circle font-sport" style="width:50px; height:50px; font-size:1.5rem;" id="tree-champion-circle">?</div>' 
            : `<div class="rtf-tree-team-circle winner-highlight" style="width:50px; height:50px;" id="tree-champion-circle">${getFlag(winnerTla)}</div>`;

        const lang = this.currentLang || 'fr';
        const rounds = ROUND_NAMES[lang] || ROUND_NAMES['fr'];

        container.innerHTML = `
            <!-- Left Round of 32 -->
            <div class="rtf-tree-col col-r32">
                <div class="rtf-tree-col-header">${rounds.r32}</div>
                ${renderTreeMatch(85000)}
                ${renderTreeMatch(85001)}
                ${renderTreeMatch(85002)}
                ${renderTreeMatch(85003)}
                ${renderTreeMatch(85004)}
                ${renderTreeMatch(85005)}
                ${renderTreeMatch(85006)}
                ${renderTreeMatch(85007)}
            </div>

            <!-- Left Round of 16 -->
            <div class="rtf-tree-col col-r16">
                <div class="rtf-tree-col-header">${rounds.r16}</div>
                ${renderTreeMatch(85016)}
                ${renderTreeMatch(85017)}
                ${renderTreeMatch(85018)}
                ${renderTreeMatch(85019)}
            </div>

            <!-- Left Quarters -->
            <div class="rtf-tree-col col-qf">
                <div class="rtf-tree-col-header">${rounds.qf}</div>
                ${renderTreeMatch(85024)}
                ${renderTreeMatch(85025)}
            </div>

            <!-- Left Semis -->
            <div class="rtf-tree-col col-sf">
                <div class="rtf-tree-col-header">${rounds.sf}</div>
                ${renderTreeMatch(85028)}
            </div>

            <!-- Center (Trophy & Final) -->
            <div class="rtf-tree-col col-final-center">
                <div class="rtf-tree-col-header">${rounds.final}</div>
                <div class="rtf-tree-champion-wrapper">
                    ${winnerFlag}
                    <div class="rtf-tree-champion-title">${winnerName}</div>
                </div>
                <img src="./trophy.svg" class="rtf-tree-trophy" alt="FIFA Trophy">
                
                <div class="rtf-tree-final-match">
                    ${renderTreeMatch(85031)}
                </div>
            </div>

            <!-- Right Semis -->
            <div class="rtf-tree-col col-sf">
                <div class="rtf-tree-col-header">${rounds.sf}</div>
                ${renderTreeMatch(85029)}
            </div>

            <!-- Right Quarters -->
            <div class="rtf-tree-col col-qf">
                <div class="rtf-tree-col-header">${rounds.qf}</div>
                ${renderTreeMatch(85026)}
                ${renderTreeMatch(85027)}
            </div>

            <!-- Right Round of 16 -->
            <div class="rtf-tree-col col-r16">
                <div class="rtf-tree-col-header">${rounds.r16}</div>
                ${renderTreeMatch(85020)}
                ${renderTreeMatch(85021)}
                ${renderTreeMatch(85022)}
                ${renderTreeMatch(85023)}
            </div>

            <!-- Right Round of 32 -->
            <div class="rtf-tree-col col-r32">
                <div class="rtf-tree-col-header">${rounds.r32}</div>
                ${renderTreeMatch(85008)}
                ${renderTreeMatch(85009)}
                ${renderTreeMatch(85010)}
                ${renderTreeMatch(85011)}
                ${renderTreeMatch(85012)}
                ${renderTreeMatch(85013)}
                ${renderTreeMatch(85014)}
                ${renderTreeMatch(85015)}
            </div>
        `;

        // Draw connecting lines after rendering has finished in the DOM
        setTimeout(() => this.drawTreeBracketLines(), 100);
    }

    drawTreeBracketLines() {
        const svg = document.getElementById('rtf-tree-svg');
        const scrollContainer = document.getElementById('rtf-tree-scroll');
        if (!svg || !scrollContainer) return;

        svg.innerHTML = ''; // Clear previous lines

        const wrapper = svg.parentElement;
        if (!wrapper) return;
        svg.setAttribute('width', wrapper.scrollWidth);
        svg.setAttribute('height', wrapper.scrollHeight);

        const svgRect = svg.getBoundingClientRect();
        const scale = wrapper.getBoundingClientRect().width / wrapper.offsetWidth || 1;

        const getConnectorCoords = (elementId, side) => {
            const el = document.getElementById(elementId);
            if (!el) return null;
            const rect = el.getBoundingClientRect();
            
            let x, y;
            if (side === 'left') {
                x = rect.left - svgRect.left;
                y = rect.top + rect.height / 2 - svgRect.top;
            } else if (side === 'right') {
                x = rect.right - svgRect.left;
                y = rect.top + rect.height / 2 - svgRect.top;
            } else if (side === 'top') {
                x = rect.left + rect.width / 2 - svgRect.left;
                y = rect.top - svgRect.top;
            } else if (side === 'bottom') {
                x = rect.left + rect.width / 2 - svgRect.left;
                y = rect.bottom - svgRect.top;
            } else {
                // center
                x = rect.left + rect.width / 2 - svgRect.left;
                y = rect.top + rect.height / 2 - svgRect.top;
            }
            return { x: x / scale, y: y / scale };
        };

        const drawFork = (src1Id, src2Id, destId, side) => {
            const p1 = getConnectorCoords(src1Id, side === 'left' ? 'right' : 'left');
            const p2 = getConnectorCoords(src2Id, side === 'left' ? 'right' : 'left');
            const pt = getConnectorCoords(destId, side === 'left' ? 'left' : 'right');

            if (!p1 || !p2 || !pt) return;

            // Compute midpoint X
            const deltaX = Math.abs(pt.x - p1.x);
            const offset = side === 'left' ? (deltaX / 2) : -(deltaX / 2);
            const xMid = p1.x + offset;

            const pathData = `
                M ${p1.x} ${p1.y}
                H ${xMid}
                V ${p2.y}
                M ${p2.x} ${p2.y}
                H ${xMid}
                M ${xMid} ${(p1.y + p2.y) / 2}
                H ${pt.x}
            `;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathData);
            path.setAttribute('stroke', side === 'left' ? 'var(--green-maroc)' : 'var(--rouge-maroc)');
            path.setAttribute('stroke-width', (2 / scale).toString());
            path.setAttribute('fill', 'none');
            path.setAttribute('class', side === 'left' ? 'rtf-tree-line-green' : 'rtf-tree-line-red');
            svg.appendChild(path);
        };

        // Left Wing Connectors
        drawFork('tree-circle-home-85000', 'tree-circle-away-85000', 'tree-circle-home-85016', 'left');
        drawFork('tree-circle-home-85001', 'tree-circle-away-85001', 'tree-circle-away-85016', 'left');
        drawFork('tree-circle-home-85002', 'tree-circle-away-85002', 'tree-circle-home-85017', 'left');
        drawFork('tree-circle-home-85003', 'tree-circle-away-85003', 'tree-circle-away-85017', 'left');
        drawFork('tree-circle-home-85004', 'tree-circle-away-85004', 'tree-circle-home-85018', 'left');
        drawFork('tree-circle-home-85005', 'tree-circle-away-85005', 'tree-circle-away-85018', 'left');
        drawFork('tree-circle-home-85006', 'tree-circle-away-85006', 'tree-circle-home-85019', 'left');
        drawFork('tree-circle-home-85007', 'tree-circle-away-85007', 'tree-circle-away-85019', 'left');

        drawFork('tree-circle-home-85016', 'tree-circle-away-85016', 'tree-circle-home-85024', 'left');
        drawFork('tree-circle-home-85017', 'tree-circle-away-85017', 'tree-circle-away-85024', 'left');
        drawFork('tree-circle-home-85018', 'tree-circle-away-85018', 'tree-circle-home-85025', 'left');
        drawFork('tree-circle-home-85019', 'tree-circle-away-85019', 'tree-circle-away-85025', 'left');

        drawFork('tree-circle-home-85024', 'tree-circle-away-85024', 'tree-circle-home-85028', 'left');
        drawFork('tree-circle-home-85025', 'tree-circle-away-85025', 'tree-circle-away-85028', 'left');

        // Right Wing Connectors
        drawFork('tree-circle-home-85008', 'tree-circle-away-85008', 'tree-circle-home-85020', 'right');
        drawFork('tree-circle-home-85009', 'tree-circle-away-85009', 'tree-circle-away-85020', 'right');
        drawFork('tree-circle-home-85010', 'tree-circle-away-85010', 'tree-circle-home-85021', 'right');
        drawFork('tree-circle-home-85011', 'tree-circle-away-85011', 'tree-circle-away-85021', 'right');
        drawFork('tree-circle-home-85012', 'tree-circle-away-85012', 'tree-circle-home-85022', 'right');
        drawFork('tree-circle-home-85013', 'tree-circle-away-85013', 'tree-circle-away-85022', 'right');
        drawFork('tree-circle-home-85014', 'tree-circle-away-85014', 'tree-circle-home-85023', 'right');
        drawFork('tree-circle-home-85015', 'tree-circle-away-85015', 'tree-circle-away-85023', 'right');

        drawFork('tree-circle-home-85020', 'tree-circle-away-85020', 'tree-circle-home-85026', 'right');
        drawFork('tree-circle-home-85021', 'tree-circle-away-85021', 'tree-circle-away-85026', 'right');
        drawFork('tree-circle-home-85022', 'tree-circle-away-85022', 'tree-circle-home-85027', 'right');
        drawFork('tree-circle-home-85023', 'tree-circle-away-85023', 'tree-circle-away-85027', 'right');

        drawFork('tree-circle-home-85026', 'tree-circle-away-85026', 'tree-circle-home-85029', 'right');
        drawFork('tree-circle-home-85027', 'tree-circle-away-85027', 'tree-circle-away-85029', 'right');

        // Connect SF to Final
        drawFork('tree-circle-home-85028', 'tree-circle-away-85028', 'tree-circle-home-85031', 'left');
        drawFork('tree-circle-home-85029', 'tree-circle-away-85029', 'tree-circle-away-85031', 'right');

        // Connect Finalists horizontally and vertically to the Champion Circle above the trophy
        const c1 = getConnectorCoords('tree-circle-home-85031', 'top');
        const c2 = getConnectorCoords('tree-circle-away-85031', 'top');
        const cC = getConnectorCoords('tree-champion-circle', 'bottom');

        if (c1 && c2 && cC) {
            const midX = (c1.x + c2.x) / 2;
            const pathData = `
                M ${c1.x} ${c1.y}
                H ${c2.x}
                M ${midX} ${c1.y}
                V ${cC.y}
            `;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathData);
            path.setAttribute('stroke', 'var(--or-premium)');
            path.setAttribute('stroke-width', (2.5 / scale).toString());
            path.setAttribute('fill', 'none');
            path.setAttribute('class', 'rtf-tree-line-gold');
            svg.appendChild(path);
        }
    }

    adjustTreeScale() {
        const scrollContainer = document.getElementById('rtf-tree-scroll');
        const wrapper = document.querySelector('.rtf-tree-wrapper');
        if (!scrollContainer || !wrapper) return;

        const isTreeVisible = scrollContainer.style.display !== 'none';
        if (!isTreeVisible) return;

        const containerWidth = scrollContainer.clientWidth;
        const baseWidth = 950;
        const baseHeight = 700;

        if (containerWidth < baseWidth && containerWidth > 0) {
            const scale = containerWidth / baseWidth;
            wrapper.style.transform = `scale(${scale})`;
            wrapper.style.transformOrigin = 'top left';
            wrapper.style.width = `${baseWidth}px`;
            wrapper.style.height = `${baseHeight}px`;
            scrollContainer.style.height = `${baseHeight * scale}px`;
            scrollContainer.style.overflowX = 'hidden';
        } else {
            wrapper.style.transform = 'none';
            wrapper.style.width = '100%';
            wrapper.style.height = `${baseHeight}px`;
            scrollContainer.style.height = 'auto';
            scrollContainer.style.overflowX = 'auto';
        }

        // Redraw lines since scale shifts offset coordinates
        this.drawTreeBracketLines();
    }

    populateFilterDropdowns() {
        const groupSelect = document.getElementById('filter-group');
        const stadiumSelect = document.getElementById('filter-stadium');
        const hostSelect = document.getElementById('filter-host');
        
        if (!this.data) return;

        // Vider sauf le premier élément option
        if (groupSelect) {
            const firstOpt = groupSelect.firstElementChild;
            groupSelect.innerHTML = '';
            if (firstOpt) groupSelect.appendChild(firstOpt);
        }
        if (stadiumSelect) {
            const firstOpt = stadiumSelect.firstElementChild;
            stadiumSelect.innerHTML = '';
            if (firstOpt) stadiumSelect.appendChild(firstOpt);
        }

        if (hostSelect) {
            const firstOpt = hostSelect.firstElementChild;
            hostSelect.innerHTML = '';
            if (firstOpt) hostSelect.appendChild(firstOpt);

            [
                { value: 'mexico', label: this.t('teams.MEX', 'Mexique') },
                { value: 'canada', label: this.t('teams.CAN', 'Canada') },
                { value: 'usa', label: this.t('teams.USA', 'États-Unis') }
            ].forEach(host => {
                const opt = document.createElement('option');
                opt.value = host.value;
                opt.innerText = host.label;
                hostSelect.appendChild(opt);
            });
        }

        // Groupes uniques
        const groups = [...new Set(this.data.matches.map(m => m.group))].sort();
        if (groupSelect) {
            groups.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g;
                // Traduire dynamiquement le groupe dans le sélecteur
                const cleanGroup = g.replace("Groupe ", "").replace("Group ", "");
                opt.innerText = this.currentLang === 'en' ? `Group ${cleanGroup}` : `Groupe ${cleanGroup}`;
                groupSelect.appendChild(opt);
            });
        }

        // Stades uniques
        const stadiums = [...new Set(this.data.matches.map(m => m.stadium))].sort();
        if (stadiumSelect) {
            stadiums.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.innerText = s;
                stadiumSelect.appendChild(opt);
            });
        }
    }

    setupFilterListeners() {
        const searchInput = document.getElementById('search-match');
        const groupSelect = document.getElementById('filter-group');
        const stadiumSelect = document.getElementById('filter-stadium');
        const sortSelect = document.getElementById('sort-order');
        const dateInput = document.getElementById('filter-date');
        const hostSelect = document.getElementById('filter-host');
        const favoritesSelect = document.getElementById('filter-favorites');

        const filterHandler = () => this.applyFilters();

        if (searchInput) searchInput.addEventListener('input', () => {
            clearTimeout(this._searchDebounceTimer);
            this._searchDebounceTimer = setTimeout(filterHandler, 300);
        });
        if (groupSelect) groupSelect.addEventListener('change', filterHandler);
        if (stadiumSelect) stadiumSelect.addEventListener('change', filterHandler);
        if (sortSelect) sortSelect.addEventListener('change', filterHandler);
        if (dateInput) dateInput.addEventListener('change', filterHandler);
        if (hostSelect) hostSelect.addEventListener('change', filterHandler);
        if (favoritesSelect) favoritesSelect.addEventListener('change', filterHandler);

        // Écouteurs pour les onglets de sélection de round sur mobile
        const bracketContainer = document.getElementById('rtf-bracket');
        const tabButtons = document.querySelectorAll('.rtf-tab-btn');
        if (bracketContainer && tabButtons.length > 0) {
            tabButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    tabButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const round = btn.getAttribute('data-round');
                    bracketContainer.setAttribute('data-active-round', round);
                });
            });
        }

        // Toggles pour basculer entre la vue classique (liste/onglets) et la vue visuelle (arbre/bracket)
        const toggleListBtn = document.getElementById('rtf-toggle-list');
        const toggleTreeBtn = document.getElementById('rtf-toggle-tree');
        const classicContainer = document.querySelector('.rtf-bracket-scroll');
        const mobileTabsContainer = document.getElementById('rtf-mobile-tabs');
        const treeScrollContainer = document.getElementById('rtf-tree-scroll');

        const switchViewMode = (mode) => {
            if (mode === 'tree') {
                if (toggleTreeBtn) toggleTreeBtn.classList.add('active');
                if (toggleListBtn) toggleListBtn.classList.remove('active');
                
                if (classicContainer) classicContainer.style.display = 'none';
                if (mobileTabsContainer) mobileTabsContainer.style.display = 'none';
                if (treeScrollContainer) {
                    treeScrollContainer.style.display = 'block';
                    this.renderRoadToTheFinalTree();
                    this.adjustTreeScale();
                }
                localStorage.setItem('rtf-view-mode', 'tree');
            } else {
                if (toggleListBtn) toggleListBtn.classList.add('active');
                if (toggleTreeBtn) toggleTreeBtn.classList.remove('active');
                
                if (classicContainer) classicContainer.style.display = 'block';
                if (mobileTabsContainer) mobileTabsContainer.style.display = '';
                if (treeScrollContainer) treeScrollContainer.style.display = 'none';
                
                localStorage.setItem('rtf-view-mode', 'list');
            }
        };

        if (toggleListBtn && toggleTreeBtn) {
            toggleListBtn.addEventListener('click', () => switchViewMode('list'));
            toggleTreeBtn.addEventListener('click', () => switchViewMode('tree'));
        }

        // Charger le mode sauvegardé ou par défaut 'list'
        const savedMode = localStorage.getItem('rtf-view-mode') || 'list';
        switchViewMode(savedMode);

        // Resize handler pour mettre à jour le scale de l'arbre
        window.addEventListener('resize', () => {
            if (localStorage.getItem('rtf-view-mode') === 'tree') {
                this.adjustTreeScale();
            }
        });
    }

    applyFilters() {
        const query = (document.getElementById('search-match')?.value || '').toLowerCase().trim();
        const selectedGroup = document.getElementById('filter-group')?.value || '';
        const selectedStadium = document.getElementById('filter-stadium')?.value || '';
        const sortOrder = document.getElementById('sort-order')?.value || 'chrono';
        const selectedDate = document.getElementById('filter-date')?.value || '';
        const selectedHost = document.getElementById('filter-host')?.value || '';
        const favoritesMode = document.getElementById('filter-favorites')?.value || '';

        let filtered = [...this.data.matches];

        // 1. Filtrer par recherche
        if (query) {
            filtered = filtered.filter(m => {
                const homeNameTrans = this.t(`teams.${m.homeTla}`, m.homeTeam).toLowerCase();
                const awayNameTrans = this.t(`teams.${m.awayTla}`, m.awayTeam).toLowerCase();
                return homeNameTrans.includes(query) || 
                       awayNameTrans.includes(query) || 
                       m.group.toLowerCase().includes(query) || 
                       m.stadium.toLowerCase().includes(query);
            });
        }

        // 2. Filtrer par groupe
        if (selectedGroup) {
            filtered = filtered.filter(m => m.group === selectedGroup);
        }

        // 3. Filtrer par stade
        if (selectedStadium) {
            filtered = filtered.filter(m => m.stadium === selectedStadium);
        }

        if (selectedDate) {
            const normalizedDate = new Date(selectedDate).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: 'Africa/Casablanca'
            }).toLowerCase();
            filtered = filtered.filter(m => (m.date || '').toLowerCase() === normalizedDate);
        }

        if (selectedHost) {
            filtered = filtered.filter(m => this.getHostCountry(m.stadium) === selectedHost);
        }

        if (favoritesMode === 'favorites') {
            filtered = filtered.filter(m => m.homeTla === this.favoriteTeam || m.awayTla === this.favoriteTeam);
        }

        // 4. Trier les résultats
        if (sortOrder === 'maroc') {
            // Matchs du Maroc en premier, puis le reste
            filtered.sort((a, b) => {
                const aIsMaroc = a.homeTla === 'MAR' || a.awayTla === 'MAR';
                const bIsMaroc = b.homeTla === 'MAR' || b.awayTla === 'MAR';
                if (aIsMaroc && !bIsMaroc) return -1;
                if (!aIsMaroc && bIsMaroc) return 1;
                return a.id - b.id;
            });
        } else {
            // Tri Chronologique simple (par id)
            filtered.sort((a, b) => a.id - b.id);
        }

        renderMatches(filtered);
        refreshPremiumFeatures(this);
    }

    getHostCountry(stadiumName) {
        const stadium = (stadiumName || '').toLowerCase();
        if (stadium.includes('mexico') || stadium.includes('guadalajara') || stadium.includes('monterrey')) return 'mexico';
        if (stadium.includes('bc place') || stadium.includes('toronto')) return 'canada';
        return 'usa';
    }

    updateMatchCard(data) {
        if (!this.data) return;

        // Trouver le match à mettre à jour
        const match = this.data.matches.find(m => m.id === data.matchId);
        if (match) {
            match.homeScore = data.homeScore;
            match.awayScore = data.awayScore;
            match.time = data.time;
            match.status = data.status;
            if (data.events) match.events = data.events;
            if (data.stats) match.stats = data.stats;
            if (data.liveMinute !== undefined) match.liveMinute = data.liveMinute;
            
            // Mettre à jour les infos d'équipe si elles changent (cas des qualifiés TBD)
            if (data.homeTla) {
                match.homeTla = data.homeTla;
                match.homeTeam = data.homeTeam || match.homeTeam;
                match.homeFlag = data.homeFlag || match.homeFlag;
            }
            if (data.awayTla) {
                match.awayTla = data.awayTla;
                match.awayTeam = data.awayTeam || match.awayTeam;
                match.awayFlag = data.awayFlag || match.awayFlag;
            }
            
            // Recalculer les classements, buteurs et passeurs en temps réel
            const groupsList = ["Groupe A", "Groupe B", "Groupe C", "Groupe D", "Groupe E", "Groupe F", "Groupe G", "Groupe H", "Groupe I", "Groupe J", "Groupe K", "Groupe L"];
            const groupsStandings = {};
            groupsList.forEach(g => {
                groupsStandings[g] = computeGroupStandings(this.data.matches, g);
            });
            const realTimeStats = computeScorersAndAssists(this.data.matches);
            this.data.standings = {
                groups: groupsStandings,
                scorers: realTimeStats.scorers,
                assists: realTimeStats.assists
            };
            renderStandings(this.data.standings);
            
            // Rafraîchir les sections live
            renderLiveMatches(this.data.matches);
            refreshPremiumFeatures(this);
            this.computeKnockoutBracket();
            this.renderRoadToTheFinal();

            const savedMode = localStorage.getItem('rtf-view-mode') || 'list';
            if (savedMode === 'tree') {
                this.renderRoadToTheFinalTree();
                setTimeout(() => this.adjustTreeScale(), 150);
            }

            // Mettre à jour l'élément spécifique dans le calendrier s'il est affiché
            const scoreHomeEl = document.getElementById(`score-home-${data.matchId}`);
            if ((data.status === 'LIVE' || data.status === 'FINISHED') && !scoreHomeEl) {
                this.applyFilters();
                return;
            }
            const scoreAwayEl = document.getElementById(`score-away-${data.matchId}`);
            const statusEl = document.getElementById(`status-${data.matchId}`);
            
            if (scoreHomeEl) scoreHomeEl.innerText = data.homeScore;
            if (scoreAwayEl) scoreAwayEl.innerText = data.awayScore;

            // Mettre à jour le score du modal s'il est ouvert
            const modalScoreEl = document.getElementById(`modal-score-${data.matchId}`);
            if (modalScoreEl) modalScoreEl.innerText = `${data.homeScore} - ${data.awayScore}`;
            
            // Si le modal du match mis à jour est actuellement ouvert, mettre à jour la chronologie et les stats en direct
            const isCurrentModal = document.getElementById(`modal-score-${data.matchId}`) !== null;
            if (isCurrentModal) {
                const modalTimelineEl = document.querySelector('#match-details-modal .match-events-timeline');
                const modalStatsEl = document.querySelector('#match-details-modal .stats-table');
                if (modalTimelineEl && data.events) {
                    modalTimelineEl.innerHTML = this.renderModalEvents(match, data.events);
                }
                if (modalStatsEl && data.stats) {
                    modalStatsEl.innerHTML = this.renderModalStats(data.stats);
                }
            }
            
            if (statusEl) {
                if (data.status === 'LIVE') {
                    let minDisplay = '';
                    if (data.liveMinute) {
                        minDisplay = data.liveMinute === 'MT' ? ' · MT' : ` · ${data.liveMinute}'`;
                    }
                    statusEl.innerHTML = `<span class="live-badge" style="padding: 0.2rem 0.6rem; font-size: 0.7rem;"><span class="live-pulse"></span> ${this.t('modal.live', 'Direct')}${minDisplay}</span>`;
                } else if (data.status === 'FINISHED') {
                    statusEl.innerHTML = `<span style="font-size: 0.8rem; opacity: 0.6; font-weight: bold;">${this.t('modal.finished', 'Terminé')}</span>`;
                } else {
                    statusEl.innerHTML = `<span style="font-size: 0.8rem; opacity: 0.8; font-weight: bold; color: var(--or-premium);"><i class="fa-regular fa-clock"></i> ${data.time}</span>`;
                }
            }
        }
    }

    triggerGoalAnimation(matchId) {
        // Animation sur la carte calendrier
        const card = document.getElementById(`match-${matchId}`);
        if (card) {
            card.classList.add('goal-scored');
            setTimeout(() => card.classList.remove('goal-scored'), 1800);
        }
        
        // Animation sur la carte live
        const liveCard = document.querySelector(`#live-matches-grid #match-${matchId}`);
        if (liveCard) {
            liveCard.classList.add('goal-scored');
            setTimeout(() => liveCard.classList.remove('goal-scored'), 1800);
        }

        // Synthétiser un sifflet d'arbitre (Audio Context)
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                const ctx = new AudioContext();
                this.playWhistleBeep(ctx, 0, 0.15, 1200);
                this.playWhistleBeep(ctx, 0.2, 0.5, 1400);
            }
        } catch (e) {
            console.warn('Sifflet audio bloqué par la politique de sécurité:', e);
        }
    }

    playWhistleBeep(ctx, startTime, duration, freq) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
        osc.frequency.linearRampToValueAtTime(freq + 100, ctx.currentTime + startTime + (duration * 0.2));
        osc.frequency.linearRampToValueAtTime(freq - 50, ctx.currentTime + startTime + (duration * 0.8));
        
        gain.gain.setValueAtTime(0.08, ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration);
    }

    async sendPushNotification(body) {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
                new Notification('Coupe du Monde 2026', {
                    body: body,
                    icon: './trophy.svg'
                });
            } catch (e) {
                console.warn('Notification non supportée :', e);
            }
        }
    }

    setupThemeToggle() {
        const btn = document.getElementById('theme-toggle');
        if (!btn) return;

        // Default to light theme if no preference is saved
        const isDark = localStorage.getItem('theme') === 'dark';
        
        if (isDark) {
            document.body.classList.remove('theme-light');
            document.body.classList.add('theme-dark');
            btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        } else {
            document.body.classList.remove('theme-dark');
            document.body.classList.add('theme-light');
            btn.innerHTML = '<i class="fa-solid fa-moon"></i>';
        }

        btn.addEventListener('click', () => {
            if (document.body.classList.contains('theme-light')) {
                document.body.classList.remove('theme-light');
                document.body.classList.add('theme-dark');
                btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
                localStorage.setItem('theme', 'dark');
            } else {
                document.body.classList.remove('theme-dark');
                document.body.classList.add('theme-light');
                btn.innerHTML = '<i class="fa-solid fa-moon"></i>';
                localStorage.setItem('theme', 'light');
            }
        });
    }

    async loadTranslations() {
        try {
            const response = await fetch(`./data/locales/${this.currentLang}.json`);
            this.i18n = await response.json();
            this.hydrateTranslations();
        } catch (error) {
            console.error(`Erreur de chargement des traductions (${this.currentLang}):`, error);
        }
    }

    t(path, defaultValue = '') {
        if (!this.i18n) return defaultValue;
        const parts = path.split('.');
        let current = this.i18n;
        for (const part of parts) {
            if (current[part] === undefined) return defaultValue;
            current = current[part];
        }
        return current;
    }

    hydrateTranslations() {
        if (!this.i18n) return;

        // 1. Liens de navigation (Desktop)
        const navLinks = document.querySelectorAll('.nav-links a');
        if (navLinks.length >= 11) {
            navLinks[0].innerHTML = this.t('nav.home');
            navLinks[1].innerHTML = this.t('nav.calendar');
            navLinks[2].innerHTML = this.t('nav.live');
            navLinks[3].innerHTML = this.t('nav.teams');
            navLinks[4].innerHTML = this.t('nav.morocco');
            navLinks[5].innerHTML = this.t('nav.roadtofinal');
            navLinks[6].innerHTML = this.t('nav.standings');
            navLinks[7].innerHTML = this.currentLang === 'en' ? 'Tools' : 'Outils';
            navLinks[8].innerHTML = this.t('nav.analytics');
            navLinks[9].innerHTML = this.t('nav.stadiums');
            navLinks[10].innerHTML = this.t('nav.news');
        } else if (navLinks.length >= 10) {
            navLinks[0].innerHTML = this.t('nav.home');
            navLinks[1].innerHTML = this.t('nav.calendar');
            navLinks[2].innerHTML = this.t('nav.live');
            navLinks[3].innerHTML = this.t('nav.teams');
            navLinks[4].innerHTML = this.t('nav.morocco');
            navLinks[5].innerHTML = this.t('nav.standings');
            navLinks[6].innerHTML = this.currentLang === 'en' ? 'Tools' : 'Outils';
            navLinks[7].innerHTML = this.t('nav.analytics');
            navLinks[8].innerHTML = this.t('nav.stadiums');
            navLinks[9].innerHTML = this.t('nav.news');
        } else if (navLinks.length >= 8) {
            navLinks[0].innerHTML = this.t('nav.home');
            navLinks[1].innerHTML = this.t('nav.calendar');
            navLinks[2].innerHTML = this.t('nav.live');
            navLinks[3].innerHTML = this.t('nav.teams');
            navLinks[4].innerHTML = this.t('nav.morocco');
            navLinks[5].innerHTML = this.t('nav.standings');
            if (navLinks.length >= 9) {
                navLinks[6].innerHTML = this.currentLang === 'en' ? 'Tools' : 'Outils';
                navLinks[7].innerHTML = this.t('nav.analytics');
                navLinks[8].innerHTML = this.t('nav.stadiums');
            } else {
                navLinks[6].innerHTML = this.t('nav.analytics');
                navLinks[7].innerHTML = this.t('nav.stadiums');
            }
        }

        // 2. Liens de navigation (Mobile)
        const mobileLinks = document.querySelectorAll('.mobile-nav-links a');
        if (mobileLinks.length >= 11) {
            mobileLinks[0].innerHTML = this.t('nav.home');
            mobileLinks[1].innerHTML = this.t('nav.calendar');
            mobileLinks[2].innerHTML = this.t('nav.live');
            mobileLinks[3].innerHTML = this.t('nav.teams');
            mobileLinks[4].innerHTML = this.t('nav.morocco');
            mobileLinks[5].innerHTML = this.t('nav.roadtofinal');
            mobileLinks[6].innerHTML = this.t('nav.standings');
            mobileLinks[7].innerHTML = this.currentLang === 'en' ? 'Tools' : 'Outils';
            mobileLinks[8].innerHTML = this.t('nav.analytics');
            mobileLinks[9].innerHTML = this.t('nav.stadiums');
            mobileLinks[10].innerHTML = this.t('nav.news');
        } else if (mobileLinks.length >= 10) {
            mobileLinks[0].innerHTML = this.t('nav.home');
            mobileLinks[1].innerHTML = this.t('nav.calendar');
            mobileLinks[2].innerHTML = this.t('nav.live');
            mobileLinks[3].innerHTML = this.t('nav.teams');
            mobileLinks[4].innerHTML = this.t('nav.morocco');
            mobileLinks[5].innerHTML = this.t('nav.standings');
            mobileLinks[6].innerHTML = this.currentLang === 'en' ? 'Tools' : 'Outils';
            mobileLinks[7].innerHTML = this.t('nav.analytics');
            mobileLinks[8].innerHTML = this.t('nav.stadiums');
            mobileLinks[9].innerHTML = this.t('nav.news');
        } else if (mobileLinks.length >= 8) {
            mobileLinks[0].innerHTML = this.t('nav.home');
            mobileLinks[1].innerHTML = this.t('nav.calendar');
            mobileLinks[2].innerHTML = this.t('nav.live');
            mobileLinks[3].innerHTML = this.t('nav.teams');
            mobileLinks[4].innerHTML = this.t('nav.morocco');
            mobileLinks[5].innerHTML = this.t('nav.standings');
            if (mobileLinks.length >= 9) {
                mobileLinks[6].innerHTML = this.currentLang === 'en' ? 'Tools' : 'Outils';
                mobileLinks[7].innerHTML = this.t('nav.analytics');
                mobileLinks[8].innerHTML = this.t('nav.stadiums');
            } else {
                mobileLinks[6].innerHTML = this.t('nav.analytics');
                mobileLinks[7].innerHTML = this.t('nav.stadiums');
            }
        }

        // 3. Hero Section
        const tagline = document.querySelector('.hero-tagline');
        if (tagline) tagline.innerText = this.t('hero.tagline');

        const heroTitle = document.querySelector('.hero-title');
        if (heroTitle) {
            heroTitle.innerHTML = `${this.t('hero.title')}<br><span style="color:var(--or-premium)">${this.t('hero.subtitle')}</span>`;
        }

        // 4. Hero Stats
        const statNations = document.getElementById('stat-nations');
        if (statNations) statNations.innerText = this.t('sections.teams');
        const statMatches = document.getElementById('stat-matches');
        if (statMatches) statMatches.innerText = this.currentLang === 'en' ? 'Total Matches' : 'Matchs Totaux';
        const statStadiums = document.getElementById('stat-stadiums');
        if (statStadiums) statStadiums.innerText = this.currentLang === 'en' ? 'Official Stadiums' : 'Stades Officiels';
        const statHosts = document.getElementById('stat-hosts');
        if (statHosts) statHosts.innerText = this.currentLang === 'en' ? 'Host Countries' : 'Pays Hôtes';



        // 6. Section Titles
        const secCalendar = document.getElementById('sec-title-calendar');
        if (secCalendar) secCalendar.innerText = this.t('sections.calendar');
        const secLive = document.getElementById('sec-title-live');
        if (secLive) secLive.innerText = this.t('sections.live');
        const secTeams = document.getElementById('sec-title-teams');
        if (secTeams) secTeams.innerText = this.t('sections.teams');
        const secMorocco = document.getElementById('sec-title-morocco');
        if (secMorocco) secMorocco.innerText = this.t('sections.morocco');
        const secRoadToFinal = document.getElementById('sec-title-roadtofinal');
        if (secRoadToFinal) secRoadToFinal.innerText = this.t('sections.roadtofinal', '🏆 Tableau de Phase Finale');
        const lblToggleList = document.getElementById('lbl-toggle-list');
        if (lblToggleList) lblToggleList.innerText = this.t('rtf.toggleList', 'Vue Classique');
        const lblToggleTree = document.getElementById('lbl-toggle-tree');
        if (lblToggleTree) lblToggleTree.innerText = this.t('rtf.toggleTree', 'Vue Visuelle');
        const secStandings = document.getElementById('sec-title-standings');
        if (secStandings) secStandings.innerText = this.t('sections.standings');
        const secNews = document.getElementById('sec-title-news');
        if (secNews) secNews.innerText = this.t('sections.news');
        const secStadiums = document.getElementById('sec-title-stadiums');
        if (secStadiums) secStadiums.innerText = this.t('sections.stadiums');

        // 7. Search Input Placeholder
        const searchInput = document.getElementById('search-match');
        if (searchInput) searchInput.placeholder = this.t('filters.search');

        // 8. Filters Options
        const optGroups = document.getElementById('opt-all-groups');
        if (optGroups) optGroups.innerText = this.t('filters.allGroups');
        const optStadiums = document.getElementById('opt-all-stadiums');
        if (optStadiums) optStadiums.innerText = this.t('filters.allStadiums');
        const optChrono = document.getElementById('opt-sort-chrono');
        if (optChrono) optChrono.innerText = this.t('filters.chrono');
        const optMaroc = document.getElementById('opt-sort-maroc');
        if (optMaroc) optMaroc.innerText = this.t('filters.maroc');

        const hostSelect = document.getElementById('filter-host');
        if (hostSelect && hostSelect.firstElementChild) {
            hostSelect.firstElementChild.innerText = this.t('filters.allHosts', 'Tous les pays hôtes');
        }

        const favSelect = document.getElementById('filter-favorites');
        if (favSelect && favSelect.options.length >= 2) {
            favSelect.options[0].innerText = this.t('filters.allMatches', 'Tous les matchs');
            favSelect.options[1].innerText = this.t('filters.myFavorites', 'Mes favoris');
        }

        // 9. Live Badge
        const liveBadge = document.getElementById('live-update-badge');
        if (liveBadge) {
            liveBadge.innerHTML = `<span class="live-pulse"></span> ${this.currentLang === 'en' ? 'Live Update Active' : 'Live Update Actif'}`;
        }

        // 10. Espace Lions de l'Atlas
        const squadTitle = document.getElementById('morocco-squad-title');
        if (squadTitle) squadTitle.innerHTML = `<i class="fa-solid fa-shield-halved"></i> ${this.t('moroccoZone.squad')}`;
        const histTitle = document.getElementById('morocco-history-title');
        if (histTitle) histTitle.innerHTML = `<i class="fa-solid fa-history"></i> ${this.t('moroccoZone.history')}`;
        const histDesc = document.getElementById('morocco-history-desc');
        if (histDesc) histDesc.innerText = this.t('moroccoZone.historyText');
        const mediaTitle = document.getElementById('morocco-media-title');
        if (mediaTitle) mediaTitle.innerHTML = `<i class="fa-solid fa-photo-film"></i> ${this.t('moroccoZone.media')}`;

        // 11. Standings Cards Headers
        const titleGroups = document.getElementById('title-groups');
        if (titleGroups) titleGroups.innerText = this.t('standingsTable.groups');
        const titleScorers = document.getElementById('title-scorers');
        if (titleScorers) titleScorers.innerText = this.t('standingsTable.scorers');
        const titleAssists = document.getElementById('title-assists');
        if (titleAssists) titleAssists.innerText = this.t('standingsTable.assists');

        // 12. Analytics title
        const titleAnalytics = document.getElementById('title-analytics');
        if (titleAnalytics) {
            titleAnalytics.innerHTML = `<i class="fa-solid fa-chart-line" style="color:var(--or-premium)"></i> ${this.t('analyticsZone.title')}`;
        }

        // 13. Analytics team labels
        const lblTeamA = document.getElementById('lbl-analytics-team-a');
        if (lblTeamA) lblTeamA.innerText = this.t('analyticsZone.teamA', 'Équipe A :');
        const lblTeamB = document.getElementById('lbl-analytics-team-b');
        if (lblTeamB) lblTeamB.innerText = this.t('analyticsZone.teamB', 'Équipe B :');

        // 14. Bracket mobile tabs
        const tabBtns = document.querySelectorAll('.rtf-tab-btn');
        if (tabBtns.length > 0) {
            const lang = this.currentLang || 'fr';
            const shortRounds = ROUND_SHORT_NAMES[lang] || ROUND_SHORT_NAMES['fr'];
            tabBtns.forEach(btn => {
                const roundKey = btn.getAttribute('data-round');
                if (shortRounds[roundKey]) {
                    btn.innerText = shortRounds[roundKey];
                }
            });
        }
    }

    setupLanguageSwitcher() {
        const desktopBtns = document.querySelectorAll('.lang-switcher .lang-btn');
        const mobileBtns = document.querySelectorAll('.mobile-lang-switcher .lang-btn');

        const updateActiveLangButton = (lang) => {
            // Desktop
            desktopBtns.forEach(btn => {
                if (btn.getAttribute('data-lang') === lang) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            // Mobile
            mobileBtns.forEach(btn => {
                if (btn.getAttribute('data-lang') === lang) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        };

        const switchHandler = async (e) => {
            const btn = e.target.closest('.lang-btn');
            if (!btn) return;
            const newLang = btn.getAttribute('data-lang');
            if (newLang && newLang !== this.currentLang) {
                console.log(`🌐 [App] Changement de langue vers: ${newLang}`);
                this.currentLang = newLang;
                localStorage.setItem('lang', newLang);
                
                updateActiveLangButton(newLang);
                
                // Charger les traductions
                await this.loadTranslations();
                
                // Mettre à jour le sélecteur
                this.populateFilterDropdowns();

                // Re-rendre
                this.applyInitialRender();
                refreshPremiumFeatures(this);

                // Recréer le graphe
                this.initChart();

                // Ré-initialiser la carte Leaflet pour traduire les popups des stades
                if (this.data && this.data.stadiums) {
                    this.initMap(this.data.stadiums);
                }
            }
        };

        desktopBtns.forEach(btn => btn.addEventListener('click', switchHandler));
        mobileBtns.forEach(btn => btn.addEventListener('click', switchHandler));

        updateActiveLangButton(this.currentLang);
    }

    registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;

        // Désactiver le Service Worker en local pour éviter les blocages de cache en développement
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocal) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                for (let registration of registrations) {
                    registration.unregister().then(success => {
                        if (success) console.log('SW: Désenregistré en local avec succès.');
                    });
                }
            }).catch(err => console.warn('SW error:', err));

            if ('caches' in window) {
                caches.keys().then(keys => {
                    return Promise.all(keys.map(key => {
                        console.log('SW: Suppression du cache local:', key);
                        return caches.delete(key);
                    }));
                }).catch(err => console.warn('SW cache clear error:', err));
            }
            return;
        }

        // Recharger la page automatiquement quand un nouveau service worker (v2) prend le contrôle et vide le cache
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        });

        window.addEventListener('load', () => {
            navigator.serviceWorker
                .register('/service-worker.js')
                .catch(err => console.warn('SW registration error:', err));
        });
    }

    initMap(stadiums) {
        if (typeof L === 'undefined' || !document.getElementById('map')) return;

        if (this.map) {
            this.map.remove();
            this.map = null;
        }

        // Centrer sur l'Amérique du Nord (USA, Canada, Mexique)
        this.map = L.map('map', {
            scrollWheelZoom: false
        }).setView([38.5, -98.0], 4);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(this.map);

        const customIcon = L.divIcon({
            className: 'custom-map-marker',
            html: `<div style="background: var(--red-maroc); border: 2px solid var(--gold-premium); width: 14px; height: 14px; border-radius: 50%; box-shadow: 0 0 10px var(--red-maroc);"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });

        stadiums.forEach(stad => {
            // Mettre à jour dynamiquement le contenu du popup selon la langue
            const renderPopup = () => {
                const labelCity = this.t('stadiumDetails.city', 'Ville');
                const labelCapacity = this.t('stadiumDetails.capacity', 'Capacité');
                const labelMatches = this.t('stadiumDetails.matches', 'Matchs');
                return `
                    <div style="font-family: 'Inter', sans-serif; padding: 5px;">
                        <h4 class="font-sport" style="color: var(--or-premium); margin: 0 0 8px 0; font-size: 1rem; border-bottom: 1px solid rgba(255,215,0,0.2); padding-bottom: 3px;">${stad.name}</h4>
                        <p style="margin: 3px 0; font-size: 0.85rem;"><i class="fa-solid fa-city" style="color: var(--text-main); width: 15px; opacity:0.8;"></i> ${labelCity} : <strong>${stad.city}</strong></p>
                        <p style="margin: 3px 0; font-size: 0.85rem;"><i class="fa-solid fa-users" style="color: var(--text-main); width: 15px; opacity:0.8;"></i> ${labelCapacity} : <strong>${stad.capacity} places</strong></p>
                        <p style="margin: 3px 0; font-size: 0.85rem;"><i class="fa-solid fa-futbol" style="color: var(--text-main); width: 15px; opacity:0.8;"></i> ${labelMatches} : <strong>${stad.matchesCount} programmés</strong></p>
                    </div>
                `;
            };

            const marker = L.marker(stad.coords, { icon: customIcon }).addTo(this.map);
            marker.bindPopup(renderPopup);

            // Re-render popup content when opened to catch active language
            marker.on('click', () => {
                marker.setPopupContent(renderPopup());
            });
        });
    }

    initChart() {
        const canvas = document.getElementById('advancedStatsChart');
        if (typeof Chart === 'undefined' || !canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Détruire l'ancien graphique pour éviter les superpositions d'éléments
        if (this.chart) {
            this.chart.destroy();
        }

        // Récupérer les labels traduits du Radar
        const radarLabels = [
            this.t('analyticsZone.radar.possession', 'Possession (%)'),
            this.t('analyticsZone.radar.xg', 'xG (Expected Goals)'),
            this.t('analyticsZone.radar.shotsOnTarget', 'Tirs cadrés'),
            this.t('analyticsZone.radar.passAccuracy', 'Précision Passes (%)'),
            this.t('analyticsZone.radar.duelsWon', 'Duels Gagnés'),
            this.t('analyticsZone.radar.pressing', 'Efficacité Pressing')
        ];

        // Équipes sélectionnées
        const teamAVal = document.getElementById('analytics-team-a')?.value || 'MAR';
        const teamBVal = document.getElementById('analytics-team-b')?.value || 'BRA';

        // Puissance des équipes pour générer des stats réalistes
        const ratings = {
            BRA: 92, ARG: 91, FRA: 90, ESP: 89, ENG: 88, GER: 88, PRT: 87,
            NED: 86, ITA: 85, MAR: 84, BEL: 84, CRO: 84, COL: 84,
            URU: 83, USA: 82, SUI: 81, MEX: 80, SEN: 80, JPN: 79, DZA: 79,
            TUR: 78, NGA: 78, EGY: 78, KOR: 77, CAN: 77, SWE: 77,
            AUT: 76, CZE: 76, NOR: 76, IRN: 76, PAR: 75, SCO: 75,
            CMR: 75, GHA: 75, AUS: 74, BIH: 74, TUN: 74, ECU: 74,
            COD: 73, UZB: 72, CRC: 72, JOR: 71, PAN: 71, IRQ: 70,
            HON: 69, RSA: 69, CPV: 68, NZL: 67, KSA: 67, CUW: 63,
            HAI: 64, JAM: 66, OMA: 65, UAE: 66
        };

        const getTeamStats = (tla, opponentTla) => {
            const rA = ratings[tla.toUpperCase()] || 70;
            const rB = ratings[opponentTla.toUpperCase()] || 70;
            
            // 1. Possession (%)
            let possession = Math.round(50 + (rA - rB) * 0.5);
            possession = Math.max(35, Math.min(65, possession));
            
            // 2. xG (Expected Goals)
            const tlaCodeSum = (tla.charCodeAt(0) || 0) + (tla.charCodeAt(1) || 0);
            let xg = 0.5 + (rA - 60) * 0.04 + (tlaCodeSum % 10) * 0.05;
            xg = Math.max(0.4, Math.min(3.5, xg));
            
            // 3. Tirs cadrés (Shots on Target)
            const tlaCodeLast = tla.charCodeAt(2) || 0;
            let shotsOnTarget = Math.round(xg * 3.5 + (tlaCodeLast % 3));
            shotsOnTarget = Math.max(2, Math.min(15, shotsOnTarget));
            
            // 4. Précision Passes (%)
            let passAccuracy = Math.round(70 + (rA - 60) * 0.5 + (tlaCodeSum % 5));
            passAccuracy = Math.max(65, Math.min(95, passAccuracy));
            
            // 5. Duels Gagnés (%)
            let duelsWon = Math.round(50 + (rA - rB) * 0.3 + (tlaCodeSum % 7) - 3);
            duelsWon = Math.max(40, Math.min(60, duelsWon));
            
            // 6. Efficacité Pressing (%)
            let pressing = Math.round(65 + (rA - 60) * 0.6 + (tlaCodeLast % 8));
            pressing = Math.max(55, Math.min(92, pressing));
            
            return { possession, xg, shotsOnTarget, passAccuracy, duelsWon, pressing };
        };

        const statsA = getTeamStats(teamAVal, teamBVal);
        const statsB = getTeamStats(teamBVal, teamAVal);

        // Rééquilibrer possession et duels pour la cohérence
        if (teamAVal !== teamBVal) {
            const totalPoss = statsA.possession + statsB.possession;
            statsA.possession = Math.round((statsA.possession / totalPoss) * 100);
            statsB.possession = 100 - statsA.possession;

            const totalDuels = statsA.duelsWon + statsB.duelsWon;
            statsA.duelsWon = Math.round((statsA.duelsWon / totalDuels) * 100);
            statsB.duelsWon = 100 - statsA.duelsWon;
        } else {
            statsA.possession = 50;
            statsB.possession = 50;
            statsA.duelsWon = 50;
            statsB.duelsWon = 50;
        }

        // xG est mis sur échelle 30 et shotsOnTarget sur échelle 8 pour un rendu visuel équilibré
        const scaleXG = 30;
        const scaleShots = 8;

        const dataA = [
            statsA.possession,
            Math.min(100, Math.round(statsA.xg * scaleXG)),
            Math.min(100, Math.round(statsA.shotsOnTarget * scaleShots)),
            statsA.passAccuracy,
            statsA.duelsWon,
            statsA.pressing
        ];

        const dataB = [
            statsB.possession,
            Math.min(100, Math.round(statsB.xg * scaleXG)),
            Math.min(100, Math.round(statsB.shotsOnTarget * scaleShots)),
            statsB.passAccuracy,
            statsB.duelsWon,
            statsB.pressing
        ];

        const getTeamLabel = (tla) => {
            const name = this.t(`teams.${tla.toUpperCase()}`, tla);
            const flags = {
                MAR: "🇲🇦 ", BRA: "🇧🇷 ", USA: "🇺🇸 ", MEX: "🇲🇽 ", CAN: "🇨🇦 ",
                SUI: "🇨🇭 ", GER: "🇩🇪 ", ESP: "🇪🇸 ", ENG: "🏴󠁧󠁢󠁥󠁮穫 ", CRO: "🇭🇷 ",
                NED: "🇳🇱 ", BEL: "🇧🇪 ", URU: "🇺🇾 ", JPN: "🇯🇵 ", KOR: "🇰🇷 ",
                AUS: "🇦🇺 ", TUR: "🇹🇷 ", RSA: "🇿🇦 ", HAI: "🇭🇹 ", SCO: "🏴󠁧󠁢󠁳󠁣󠁴󠁿 ",
                CZE: "🇨🇿 ", PAR: "🇵🇾 ", BIH: "🇧🇦 "
            };
            const flag = flags[tla.toUpperCase()] || "🏳️ ";
            return `${flag}${name}`;
        };

        const getTeamStyle = (tla, isTeamA) => {
            if (tla.toUpperCase() === 'MAR') {
                return {
                    bg: 'rgba(0, 98, 51, 0.25)',
                    border: '#006233',
                    point: '#FFD700'
                };
            }
            if (tla.toUpperCase() === 'BRA') {
                return {
                    bg: 'rgba(255, 223, 0, 0.15)',
                    border: '#009c3b',
                    point: '#ffdf00'
                };
            }
            return isTeamA ? {
                bg: 'rgba(255, 215, 0, 0.15)',
                border: '#FFD700',
                point: '#FFFFFF'
            } : {
                bg: 'rgba(30, 144, 255, 0.15)',
                border: '#1E90FF',
                point: '#FFFFFF'
            };
        };

        const styleA = getTeamStyle(teamAVal, true);
        const styleB = getTeamStyle(teamBVal, false);

        this.chart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: radarLabels,
                datasets: [
                    {
                        label: getTeamLabel(teamAVal),
                        data: dataA,
                        backgroundColor: styleA.bg,
                        borderColor: styleA.border,
                        pointBackgroundColor: styleA.point,
                        pointBorderColor: styleA.border,
                        borderWidth: 2
                    },
                    {
                        label: getTeamLabel(teamBVal),
                        data: dataB,
                        backgroundColor: styleB.bg,
                        borderColor: styleB.border,
                        pointBackgroundColor: styleB.point,
                        pointBorderColor: styleB.border,
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: 'var(--text-main)',
                            font: {
                                family: 'Inter',
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                let val = context.raw;
                                // Récupérer la valeur décimale non mise à l'échelle pour l'affichage
                                if (context.label.includes('xG')) {
                                    val = (val / scaleXG).toFixed(2) + ' xG';
                                } else if (context.label.includes('cadrés') || context.label.includes('Target')) {
                                    val = Math.round(val / scaleShots) + ' tirs';
                                } else {
                                    val = val + '%';
                                }
                                return label + val;
                            }
                        }
                    }
                },
                scales: {
                    r: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.08)'
                        },
                        angleLines: {
                            color: 'rgba(255, 255, 255, 0.08)'
                        },
                        pointLabels: {
                            color: 'var(--text-main)',
                            font: {
                                family: 'Inter',
                                size: 11
                            }
                        },
                        ticks: {
                            display: false,
                            maxTicksLimit: 5
                        },
                        suggestedMin: 0,
                        suggestedMax: 100
                    }
                }
            }
        });
    }

    setupMobileMenu() {
        const burger = document.getElementById('burger-menu');
        const drawer = document.getElementById('mobile-drawer');
        const closeBtn = document.getElementById('close-drawer');
        const links = document.querySelectorAll('.mobile-nav-links a');

        if (!burger || !drawer) return;

        burger.addEventListener('click', () => {
            drawer.classList.add('active');
        });

        const closeDrawer = () => {
            drawer.classList.remove('active');
        };

        if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

        links.forEach(l => l.addEventListener('click', closeDrawer));
    }

    setupMatchDetailsListener() {
        console.log("⚽ [App] Enregistrement de l'écouteur de clic unique...");
        document.addEventListener('click', (e) => {
            const card = e.target.closest('.match-card');
            if (e.target.closest('[data-fav-toggle]')) return;
            if (card) {
                console.log("⚽ [App] Carte cliquée :", card.id);
                const matchId = parseInt(card.id.replace('match-', ''), 10);
                this.openMatchDetails(matchId);
                return;
            }

            const teamCard = e.target.closest('.team-card-clickable');
            if (teamCard) {
                const teamTla = teamCard.getAttribute('data-team-tla');
                this.openTeamSquadModal(teamTla);
            }
        });
    }

    renderModalEvents(match, events) {
        const translateTeam = (tla, defaultName) => {
            return this.t(`teams.${tla}`, defaultName);
        };
        
        if (!events || events.length === 0) {
            return `<p style="text-align: center; opacity: 0.6; font-size: 0.85rem; margin: 15px 0; padding: 10px 0;">${this.t('events.none', 'Aucun événement majeur à signaler.')}</p>`;
        }

        return events.map(ev => {
            let iconHtml = '';
            let detailSuffix = '';
            
            if (ev.type === 'goal') {
                if (ev.detail === 'penalty') {
                    iconHtml = `<i class="fa-solid fa-futbol" style="color:var(--vert-maroc);" title="${this.t('events.penalty', 'Penalty')}"></i>`;
                    detailSuffix = ` <span style="font-size: 0.8rem; color: var(--vert-maroc); font-weight: 700;">(${this.t('events.penalty', 'pén.')})</span>`;
                } else if (ev.detail === 'own_goal') {
                    iconHtml = `<i class="fa-solid fa-futbol" style="color:#C1272D;" title="${this.t('events.own_goal', 'CSC')}"></i>`;
                    detailSuffix = ` <span style="font-size: 0.8rem; color: #C1272D; font-weight: 700;">(${this.t('events.own_goal', 'CSC')})</span>`;
                } else {
                    iconHtml = `<i class="fa-solid fa-futbol" style="color:var(--vert-maroc);" title="But"></i>`;
                }
            } else if (ev.type === 'card') {
                if (ev.detail === 'red') {
                    iconHtml = `<i class="fa-solid fa-square" style="color:#C1272D; transform: rotate(10deg); font-size: 0.85rem;" title="${this.t('events.red_card', 'Carton rouge')}"></i>`;
                    detailSuffix = ` <span style="font-size: 0.8rem; color: #C1272D; font-weight: 700;">(${this.t('events.red_card', 'Carton rouge')})</span>`;
                } else {
                    // yellow (default)
                    iconHtml = `<i class="fa-solid fa-square" style="color:#FFD700; transform: rotate(10deg); font-size: 0.85rem;" title="${this.t('events.yellow_card', 'Carton jaune')}"></i>`;
                }
            } else if (ev.type === 'penalty_miss') {
                iconHtml = `<i class="fa-solid fa-circle-xmark" style="color:#C1272D; font-size: 0.9rem;" title="${this.t('events.penalty_miss', 'Penalty manqué')}"></i>`;
                detailSuffix = ` <span style="font-size: 0.8rem; color: rgba(255,255,255,0.5); font-weight: 500;">(${this.t('events.penalty_miss', 'Penalty manqué')})</span>`;
            } else {
                iconHtml = `<i class="fa-solid fa-futbol" style="color:var(--text-main);"></i>`;
            }

            return `
                <div style="display: flex; align-items: center; gap: 15px; font-size: 0.9rem; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
                    <span style="font-weight: 800; color: var(--or-premium); width: 35px; text-align: right;">${ev.minute === 'MT' ? 'MT' : `${ev.minute}'`}</span>
                    <span style="font-size: 1.1rem; display: flex; align-items: center; width: 20px; justify-content: center;">
                        ${iconHtml}
                    </span>
                    <div style="flex: 1; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                        <span style="font-weight: 500; color: var(--text-main);">${ev.player}${detailSuffix}</span>
                        <span style="font-size: 0.75rem; opacity: 0.6; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                            ${getFlag(ev.team === 'home' ? match.homeTla : match.awayTla)} 
                            ${ev.team === 'home' ? translateTeam(match.homeTla, match.homeTeam) : translateTeam(match.awayTla, match.awayTeam)}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderModalStats(stats) {
        const xgHome = parseFloat(stats.xg[0]) || 0;
        const xgAway = parseFloat(stats.xg[1]) || 0;
        const xgTotal = (xgHome + xgAway) || 1;
        const pctHome = Math.round((xgHome / xgTotal) * 100);
        const pctAway = 100 - pctHome;

        const shotsHome = stats.shots[0] || 0;
        const shotsAway = stats.shots[1] || 0;
        const shotsTotal = (shotsHome + shotsAway) || 1;
        const pctShotsHome = Math.round((shotsHome / shotsTotal) * 100);
        const pctShotsAway = 100 - pctShotsHome;

        const passesHome = stats.passes[0] || 0;
        const passesAway = stats.passes[1] || 0;
        const passesTotal = (passesHome + passesAway) || 1;
        const pctPassesHome = Math.round((passesHome / passesTotal) * 100);
        const pctPassesAway = 100 - pctPassesHome;

        const cornersHome = stats.corners[0] || 0;
        const cornersAway = stats.corners[1] || 0;
        const cornersTotal = (cornersHome + cornersAway) || 1;
        const pctCornersHome = Math.round((cornersHome / cornersTotal) * 100);
        const pctCornersAway = 100 - pctCornersHome;

        const foulsHome = stats.fouls[0] || 0;
        const foulsAway = stats.fouls[1] || 0;
        const foulsTotal = (foulsHome + foulsAway) || 1;
        const pctFoulsHome = Math.round((foulsHome / foulsTotal) * 100);
        const pctFoulsAway = 100 - pctFoulsHome;

        const savesHome = stats.saves[0] || 0;
        const savesAway = stats.saves[1] || 0;
        const savesTotal = (savesHome + savesAway) || 1;
        const pctSavesHome = Math.round((savesHome / savesTotal) * 100);
        const pctSavesAway = 100 - pctSavesHome;

        return `
            <!-- Possession -->
            <div class="stat-item">
                <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 0.85rem; margin-bottom: 5px;">
                    <span>${stats.possession[0]}%</span>
                    <span style="opacity: 0.7; font-weight: 500;">Possession</span>
                    <span>${stats.possession[1]}%</span>
                </div>
                <div style="height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; display: flex; overflow: hidden;">
                    <div style="width: ${stats.possession[0]}%; background: var(--or-premium);"></div>
                    <div style="width: ${stats.possession[1]}%; background: rgba(255,255,255,0.2);"></div>
                </div>
            </div>
            
            <!-- xG -->
            <div class="stat-item">
                <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 0.85rem; margin-bottom: 5px;">
                    <span>${stats.xg[0]}</span>
                    <span style="opacity: 0.7; font-weight: 500;">xG (Expected Goals)</span>
                    <span>${stats.xg[1]}</span>
                </div>
                <div style="height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; display: flex; overflow: hidden;">
                    <div style="width: ${pctHome}%; background: var(--or-premium);"></div>
                    <div style="width: ${pctAway}%; background: rgba(255,255,255,0.2);"></div>
                </div>
            </div>

            <!-- Tirs cadrés / Tirs totaux -->
            <div class="stat-item">
                <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 0.85rem; margin-bottom: 5px;">
                    <span>${stats.target[0]} (${stats.shots[0]})</span>
                    <span style="opacity: 0.7; font-weight: 500;">Tirs cadrés (totaux)</span>
                    <span>${stats.target[1]} (${stats.shots[1]})</span>
                </div>
                <div style="height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; display: flex; overflow: hidden;">
                    <div style="width: ${pctShotsHome}%; background: var(--or-premium);"></div>
                    <div style="width: ${pctShotsAway}%; background: rgba(255,255,255,0.2);"></div>
                </div>
            </div>

            <!-- Passes -->
            <div class="stat-item">
                <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 0.85rem; margin-bottom: 5px;">
                    <span>${stats.passes[0]} (${stats.passAcc[0]}%)</span>
                    <span style="opacity: 0.7; font-weight: 500;">Passes (précision)</span>
                    <span>${stats.passes[1]} (${stats.passAcc[1]}%)</span>
                </div>
                <div style="height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; display: flex; overflow: hidden;">
                    <div style="width: ${pctPassesHome}%; background: var(--or-premium);"></div>
                    <div style="width: ${pctPassesAway}%; background: rgba(255,255,255,0.2);"></div>
                </div>
            </div>

            <!-- Corners -->
            <div class="stat-item">
                <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 0.85rem; margin-bottom: 5px;">
                    <span>${stats.corners[0]}</span>
                    <span style="opacity: 0.7; font-weight: 500;">Corners</span>
                    <span>${stats.corners[1]}</span>
                </div>
                <div style="height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; display: flex; overflow: hidden;">
                    <div style="width: ${pctCornersHome}%; background: var(--or-premium);"></div>
                    <div style="width: ${pctCornersAway}%; background: rgba(255,255,255,0.2);"></div>
                </div>
            </div>

            <!-- Fautes -->
            <div class="stat-item">
                <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 0.85rem; margin-bottom: 5px;">
                    <span>${stats.fouls[0]}</span>
                    <span style="opacity: 0.7; font-weight: 500;">Fautes commises</span>
                    <span>${stats.fouls[1]}</span>
                </div>
                <div style="height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; display: flex; overflow: hidden;">
                    <div style="width: ${pctFoulsHome}%; background: var(--or-premium);"></div>
                    <div style="width: ${pctFoulsAway}%; background: rgba(255,255,255,0.2);"></div>
                </div>
            </div>

            <!-- Arrêts -->
            <div class="stat-item">
                <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 0.85rem; margin-bottom: 5px;">
                    <span>${stats.saves[0]}</span>
                    <span style="opacity: 0.7; font-weight: 500;">Arrêts du gardien</span>
                    <span>${stats.saves[1]}</span>
                </div>
                <div style="height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; display: flex; overflow: hidden;">
                    <div style="width: ${pctSavesHome}%; background: var(--or-premium);"></div>
                    <div style="width: ${pctSavesAway}%; background: rgba(255,255,255,0.2);"></div>
                </div>
            </div>
        `;
    }

    openMatchDetails(matchId) {
        console.log("⚽ [App] Ouverture des détails du match ID :", matchId);
        if (!this.data) return;
        
        const match = this.data.matches.find(m => m.id === matchId);
        if (!match) return;
        const prediction = this.predictMatch(match.homeTla, match.awayTla);

        // Récupérer les statistiques et évènements réels/déterministes du match
        let events = match.events;
        let stats = match.stats;
        if (match.status !== 'SCHEDULED') {
            if (!events) {
                events = getDeterministicEvents(match.id, match.homeTla, match.awayTla, match.homeScore, match.awayScore, match.goals || null);
                match.events = events;
            }
            if (!stats) {
                stats = getDeterministicStats(match.id, match.homeScore, match.awayScore);
                match.stats = stats;
            }
        }

        // Récupérer l'historique H2H
        const rawH2H = getH2HData(match.homeTeam, match.awayTeam);
        
        // Traduction dynamique à la volée du H2H pour l'anglais
        const h2h = rawH2H.map(game => {
            let details = game.details;
            let comp = game.comp;
            let date = game.date;
            
            if (this.currentLang === 'en') {
                comp = comp
                    .replace("Match Amical", "Friendly Match")
                    .replace("Coupe du Monde", "World Cup")
                    .replace("Gold Cup", "Gold Cup")
                    .replace("Copa América Centenario", "Copa América Centenario");
                
                date = date
                    .replace("Mars", "March")
                    .replace("Juin", "June")
                    .replace("Juillet", "July")
                    .replace("Décembre", "December")
                    .replace("Avril", "April")
                    .replace("Août", "August");

                details = details
                    .replace("Victoire historique des Lions de l'Atlas à Tanger (Boufal 29', Sabiri 79' / Casemiro 67')", "Historic victory for the Atlas Lions in Tangier (Boufal 29', Sabiri 79' / Casemiro 67')")
                    .replace("Phase de groupes à Nantes (Ronaldo 9', Rivaldo 45', Bebeto 50')", "Group stage in Nantes (Ronaldo 9', Rivaldo 45', Bebeto 50')")
                    .replace("Match d'ouverture historique à Johannesburg (Tshabalala 55' / Márquez 79')", "Historic opening match in Johannesburg (Tshabalala 55' / Márquez 79')")
                    .replace("Phase de groupes (Rodriguez 40' / Evans 28', Sibaya 41' pen)", "Group stage (Rodriguez 40' / Evans 28', Sibaya 41' pen)")
                    .replace("Phase de groupes à Saint-Étienne. Doublé légendaire de Salaheddine Bassir (22', 85') et but d'Abdeljalil Hadda (46')", "Group stage in Saint-Étienne. Legendary brace by Salaheddine Bassir (22', 85') and goal by Hadda (46')")
                    .replace("Match de préparation à Casablanca", "Friendly match in Casablanca")
                    .replace("But décisif de Clint Dempsey à Philadelphie", "Decisive goal by Clint Dempsey in Philadelphia")
                    .replace("Match amical disputé à Nashville", "Friendly match played in Nashville")
                    .replace("Victoire coréenne à Prague", "Korean victory in Prague")
                    .replace("Match amical à Drnovice", "Friendly match in Drnovice")
                    .replace("Rencontre amicale disputée à Rabat", "Friendly match played in Rabat");
            }
            
            return { ...game, comp, date, details };
        });

        // Récupérer le modal ou le créer s'il n'existe pas
        let modal = document.getElementById('match-details-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'match-details-modal';
            document.body.appendChild(modal);
        }

        // S'assurer que le modal a la bonne classe de style
        modal.className = 'match-details-modal';

        // Déterminer les statuts traduits
        let statusLabel = this.t('modal.scheduled', 'Programmé');
        let statusClass = 'status-scheduled';
        
        if (match.status === 'LIVE') {
            const actualLiveMin = calculateLiveMinute(match.utcDate);
            if (actualLiveMin !== null) {
                match.liveMinute = actualLiveMin;
            } else if (!match.liveMinute) {
                match.liveMinute = (match.id % 75) + 10;
            }
            const minStr = match.liveMinute === 'MT' ? 'MT' : `${match.liveMinute}'`;
            statusLabel = `${this.t('modal.live', 'En Direct')} · ${minStr}`;
            statusClass = 'status-live';
        } else if (match.status === 'FINISHED') {
            statusLabel = this.t('modal.finished', 'Terminé');
            statusClass = 'status-finished';
        }

        const translateGroupDisplay = (groupName) => {
            if (!groupName) return '';
            const cleanGroup = groupName.replace("Groupe ", "").replace("Group ", "");
            return this.currentLang === 'en' ? `Group ${cleanGroup}` : `Groupe ${cleanGroup}`;
        };

        const translateTeam = (tla, defaultName) => {
            return this.t(`teams.${tla}`, defaultName);
        };

        // Injecter le contenu (sans styles de couleurs en dur)
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content premium-card">
                <button class="modal-close-btn" id="close-match-modal" aria-label="Fermer">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                
                <div class="modal-header">
                    <span class="group-label">${translateGroupDisplay(match.group)}</span>
                    <span class="date-label"><i class="fa-regular fa-calendar-days"></i> ${this._translateDate(match.date)} · ${match.kickoffTime || match.time}</span>
                </div>
                
                <div class="match-score-section">
                    <div class="team-side">
                        <div class="modal-flag-wrapper">${getFlag(match.homeTla)}</div>
                        <span class="modal-team-name">${translateTeam(match.homeTla, match.homeTeam)}</span>
                    </div>
                    
                    <div class="score-display">
                        ${match.status === 'SCHEDULED' ? `
                            <span class="kickoff-time">${match.time}</span>
                            <span class="status-badge ${statusClass}">${statusLabel}</span>
                        ` : `
                            <span class="live-score" id="modal-score-${match.id}">${match.homeScore} - ${match.awayScore}</span>
                            <span class="status-badge ${statusClass}">${statusLabel}</span>
                        `}
                    </div>
                    
                    <div class="team-side">
                        <div class="modal-flag-wrapper">${getFlag(match.awayTla)}</div>
                        <span class="modal-team-name">${translateTeam(match.awayTla, match.awayTeam)}</span>
                    </div>
                </div>

                <div class="modal-body">
                    <div class="info-row" style="display: flex; align-items: center; gap: 8px; font-size: 0.95rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
                        <span style="display: flex; align-items: center; gap: 6px; margin-right: 15px;">
                            <i class="fa-solid fa-location-dot" style="color: var(--or-premium);"></i> <span>${this.t('modal.stadium', 'Stade')} :</span>
                            <strong>${match.stadium}</strong>
                        </span>
                        <span style="display: flex; align-items: center; gap: 6px;">
                            <i class="fa-regular fa-clock" style="color: var(--or-premium);"></i> <span>${this.currentLang === 'en' ? 'Kickoff' : 'Coup d\'envoi'} :</span>
                            <strong>${match.kickoffTime || match.time}</strong>
                        </span>
                    </div>
                    <div class="modal-actions-row">
                        <button class="control-btn modal-calendar-btn" data-calendar-match="${match.id}"><i class="fa-solid fa-calendar-plus"></i> Ajouter au calendrier</button>
                        <button class="control-btn modal-favorite-btn" data-modal-favorite="${match.homeTla}"><i class="fa-solid fa-star"></i> Suivre ${translateTeam(match.homeTla, match.homeTeam)}</button>
                    </div>
                    <div class="prediction-strip">
                        <span>Pronostic local</span>
                        <strong>${prediction.label}</strong>
                        <small>${prediction.home}% - ${prediction.away}%</small>
                    </div>
                    
                    <div class="modal-divider"></div>
                    
                    <h3 class="modal-section-title"><i class="fa-solid fa-clock-rotate-left"></i> ${this.t('modal.h2h', 'Confrontations Précédentes')}</h3>
                    <div class="h2h-list">
                        ${h2h.map(game => `
                            <div class="h2h-item">
                                <div class="h2h-meta">
                                    <span class="h2h-date">${game.date}</span>
                                    <span class="h2h-comp" style="color: var(--or-premium); font-weight: 500;">${game.comp}</span>
                                </div>
                                <div class="h2h-result">
                                    <span class="h2h-score" style="font-weight: 700;">${game.score.replace("Maroc", translateTeam("MAR", "Maroc")).replace("Brésil", translateTeam("BRA", "Brésil")).replace("Écosse", translateTeam("SCO", "Écosse")).replace("Afrique du Sud", translateTeam("RSA", "Afrique du Sud")).replace("Mexique", translateTeam("MEX", "Mexique")).replace("États-Unis", translateTeam("USA", "États-Unis")).replace("Paraguay", translateTeam("PAR", "Paraguay")).replace("République Tchèque", translateTeam("CZE", "République Tchèque")).replace("Corée du Sud", translateTeam("KOR", "Corée du Sud")).replace("Haïti", translateTeam("HAI", "Haïti"))}</span>
                                    <p class="h2h-details" style="font-size: 0.85rem; opacity: 0.7; margin-top: 5px; line-height: 1.5;">${game.details}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    ${match.status !== 'SCHEDULED' ? `
                        <div class="modal-divider"></div>
                        <h3 class="modal-section-title"><i class="fa-solid fa-clock"></i> Chronologie du Match</h3>
                        <div class="match-events-timeline" style="margin-bottom: 2rem; display: flex; flex-direction: column; gap: 12px; background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem;">
                            ${this.renderModalEvents(match, events)}
                        </div>

                        ${stats ? `
                        <div class="modal-divider"></div>
                        <h3 class="modal-section-title"><i class="fa-solid fa-chart-simple"></i> Statistiques du Match</h3>
                        <div class="stats-table" style="display: flex; flex-direction: column; gap: 15px; background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem;">
                            ${this.renderModalStats(stats)}
                        </div>
                        ` : ''}
                    ` : ''}
                </div>
            </div>
        `;

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Nettoyer les anciens listeners pour éviter les fuites de mémoire
        if (this._modalAbortController) {
            this._modalAbortController.abort();
        }
        this._modalAbortController = new AbortController();
        const signal = this._modalAbortController.signal;

        const closeBtn = modal.querySelector('#close-match-modal');
        const backdrop = modal.querySelector('.modal-backdrop');
        
        const closeModal = () => {
            console.log("⚽ [App] Fermeture du modal");
            modal.style.display = 'none';
            document.body.style.overflow = '';
            if (this._modalAbortController) {
                this._modalAbortController.abort();
                this._modalAbortController = null;
            }
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal, { signal });
        if (backdrop) backdrop.addEventListener('click', closeModal, { signal });
        modal.querySelector('[data-modal-favorite]')?.addEventListener('click', (event) => {
            this.favoriteTeam = event.currentTarget.getAttribute('data-modal-favorite') || 'MAR';
            localStorage.setItem('favoriteTeam', this.favoriteTeam);
            this.applyInitialRender();
            refreshPremiumFeatures(this);
        }, { signal });
        modal.querySelector('[data-calendar-match]')?.addEventListener('click', () => {
            this.downloadCalendarEvent(match);
        }, { signal });
    }

    openTeamSquadModal(teamTla) {
        console.log("⚽ [App] Ouverture de la composition de l'équipe :", teamTla);
        if (!this.data) return;

        const squad = TEAMS_SQUADS[teamTla.toUpperCase()] || [];
        const teamName = this.t(`teams.${teamTla.toUpperCase()}`, teamTla);

        let modal = document.getElementById('team-squad-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'team-squad-modal';
            document.body.appendChild(modal);
        }

        modal.className = 'match-details-modal';
        
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content premium-card" style="max-height: 85vh; overflow-y: auto;">
                <button class="modal-close-btn" id="close-squad-modal" aria-label="Fermer">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                
                <div class="modal-header" style="text-align: center; margin-bottom: 1.5rem; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
                    <div style="font-size: 4rem; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.25));">${getFlag(teamTla)}</div>
                    <h2 class="font-sport" style="font-size: 1.8rem; color: var(--or-premium); margin: 0; font-weight: 700; text-transform: uppercase;">
                        ${teamName}
                    </h2>
                    <span class="group-label" style="font-size: 0.85rem;">Effectif Coupe du Monde 2026</span>
                </div>
                
                <div class="modal-body">
                    <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 1rem;">
                        ${squad.length > 0 ? squad.map((p, idx) => `
                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.95rem; padding: 10px 14px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px; transition: var(--transition-smooth);">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <span style="font-weight: 900; color: var(--or-premium); font-size: 0.95rem; width: 20px;">${idx + 1}</span>
                                    <span style="font-weight: 500; color: var(--text-main);">${p.name}</span>
                                </div>
                                <span style="opacity: 0.6; font-size: 0.75rem; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">${p.club}</span>
                            </div>
                        `).join('') : `
                            <p style="text-align: center; opacity: 0.6; padding: 2rem;">Aucune composition disponible pour ce pays.</p>
                        `}
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Nettoyer les anciens listeners pour éviter les fuites de mémoire
        if (this._modalAbortController) {
            this._modalAbortController.abort();
        }
        this._modalAbortController = new AbortController();
        const signal = this._modalAbortController.signal;

        const closeBtn = modal.querySelector('#close-squad-modal');
        const backdrop = modal.querySelector('.modal-backdrop');
        
        const closeModal = () => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
            if (this._modalAbortController) {
                this._modalAbortController.abort();
                this._modalAbortController = null;
            }
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal, { signal });
        if (backdrop) backdrop.addEventListener('click', closeModal, { signal });
    }

    predictMatch(homeTla, awayTla) {
        const ratings = {
            BRA: 92, ARG: 91, FRA: 90, ESP: 89, ENG: 88, GER: 88, PRT: 87,
            NED: 86, ITA: 85, MAR: 84, BEL: 84, CRO: 84, COL: 84,
            URU: 83, USA: 82, SUI: 81, MEX: 80, SEN: 80, JPN: 79, DZA: 79,
            TUR: 78, NGA: 78, EGY: 78, KOR: 77, CAN: 77, SWE: 77,
            AUT: 76, CZE: 76, NOR: 76, IRN: 76, PAR: 75, SCO: 75,
            CMR: 75, GHA: 75, AUS: 74, BIH: 74, TUN: 74, ECU: 74,
            COD: 73, UZB: 72, CRC: 72, JOR: 71, PAN: 71, IRQ: 70,
            HON: 69, RSA: 69, CPV: 68, NZL: 67, KSA: 67, CUW: 63,
            HAI: 64, JAM: 66, OMA: 65, UAE: 66
        };
        const homeRating = ratings[homeTla] || 70;
        const awayRating = ratings[awayTla] || 70;
        const home = Math.round((homeRating / (homeRating + awayRating)) * 100);
        const away = 100 - home;
        return {
            home,
            away,
            label: home === away ? 'Match équilibré' : home > away ? `${homeTla} léger avantage` : `${awayTla} léger avantage`
        };
    }

    downloadCalendarEvent(match) {
        const title = `${match.homeTeam} vs ${match.awayTeam}`;
        
        // Parsing de la date (ex: "11 juin 2026")
        const monthsFr = {
            'janvier': 0, 'février': 1, 'mars': 2, 'avril': 3, 'mai': 4, 'juin': 5,
            'juillet': 6, 'août': 7, 'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11
        };
        const dateClean = (match.date || '').toLowerCase().trim();
        const parts = dateClean.split(' ');
        const day = parseInt(parts[0], 10) || 11;
        const monthStr = parts[1] || 'juin';
        const year = parseInt(parts[2], 10) || 2026;
        const month = monthsFr[monthStr] !== undefined ? monthsFr[monthStr] : 5; // Juin par défaut
        
        // Parsing de l'heure (ex: "20:00")
        const timeParts = (match.time || '20:00').split(':');
        const hours = parseInt(timeParts[0], 10) || 20;
        const minutes = parseInt(timeParts[1], 10) || 0;
        
        // Casablanca est en UTC+1 pendant le mois de juin.
        // Nous créons une date UTC en soustrayant 1 heure de l'heure marocaine pour DTSTART.
        const utcDateObj = new Date(Date.UTC(year, month, day, hours - 1, minutes));
        
        const formatICSDate = (date) => {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };
        
        const dtstart = formatICSDate(utcDateObj);
        
        // Durée moyenne d'un match (environ 2 heures)
        const endDateObj = new Date(utcDateObj.getTime() + 2 * 60 * 60 * 1000);
        const dtend = formatICSDate(endDateObj);
        
        const dtstamp = formatICSDate(new Date());
        const uid = `match-${match.id}-fifa2026@moroccopremium.ma`;
        
        const body = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//FIFA 2026 Morocco Premium Platform//FR',
            'BEGIN:VEVENT',
            `UID:${uid}`,
            `DTSTAMP:${dtstamp}`,
            `DTSTART:${dtstart}`,
            `DTEND:${dtend}`,
            `SUMMARY:${title}`,
            `DESCRIPTION:Coupe du Monde FIFA 2026 - ${match.group} - ${match.stadium}`,
            `LOCATION:${match.stadium}`,
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\n');
        
        const blob = new Blob([body], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${match.homeTla}-${match.awayTla}.ics`;
        link.click();
        URL.revokeObjectURL(url);
    }

    _translateDate(dateStr) {
        if (this.currentLang !== 'en') return dateStr;
        const monthMap = {
            'janvier': 'January', 'février': 'February', 'mars': 'March',
            'avril': 'April', 'mai': 'May', 'juin': 'June',
            'juillet': 'July', 'août': 'August', 'septembre': 'September',
            'octobre': 'October', 'novembre': 'November', 'décembre': 'December'
        };
        let result = dateStr;
        Object.entries(monthMap).forEach(([fr, en]) => {
            result = result.replace(new RegExp(fr, 'gi'), en);
        });
        return result;
    }
}

// Lancement de l'application
function initApp() {
    if (!window.App) {
        console.log("🚀 [App] Initialisation de l'application WorldCupApp...");
        window.App = new WorldCupApp();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
