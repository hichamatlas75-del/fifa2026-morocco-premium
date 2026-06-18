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

import { initApi, getH2HData, getFlag, getDeterministicEvents, getDeterministicStats, calculateLiveMinute } from './api.js';
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
            
            // Rafraîchir les sections live
            renderLiveMatches(this.data.matches);
            refreshPremiumFeatures(this);

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
                    icon: 'https://cdn-icons-png.flaticon.com/512/5323/5323977.png'
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
        if (navLinks.length >= 10) {
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
        if (mobileLinks.length >= 10) {
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
                    <span class="date-label"><i class="fa-regular fa-calendar-days"></i> ${this._translateDate(match.date)}</span>
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
                    <div class="info-row" style="display: flex; align-items: center; gap: 8px; font-size: 0.95rem; margin-bottom: 1.5rem;">
                        <i class="fa-solid fa-location-dot" style="color: var(--or-premium);"></i> <span>${this.t('modal.stadium', 'Stade')} :</span>
                        <strong>${match.stadium}</strong>
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
                            ${events.map(ev => `
                                <div style="display: flex; align-items: center; gap: 15px; font-size: 0.9rem; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.02);">
                                    <span style="font-weight: 800; color: var(--or-premium); width: 35px; text-align: right;">${ev.minute}'</span>
                                    <span style="font-size: 1.1rem; display: flex; align-items: center; width: 20px; justify-content: center;">
                                        ${ev.type === 'goal' 
                                            ? `<i class="fa-solid fa-futbol" style="color:var(--vert-maroc);"></i>` 
                                            : `<i class="fa-solid fa-square" style="color:#FFD700; transform: rotate(10deg); font-size: 0.85rem;"></i>`
                                        }
                                    </span>
                                    <div style="flex: 1; display: flex; justify-content: space-between; align-items: center;">
                                        <span style="font-weight: 500; color: var(--text-main);">${ev.player}</span>
                                        <span style="font-size: 0.75rem; opacity: 0.6; display: flex; align-items: center; gap: 6px;">
                                            ${getFlag(ev.team === 'home' ? match.homeTla : match.awayTla)} 
                                            ${ev.team === 'home' ? translateTeam(match.homeTla, match.homeTeam) : translateTeam(match.awayTla, match.awayTeam)}
                                        </span>
                                    </div>
                                </div>
                            `).join('')}
                            ${events.length === 0 ? `<p style="text-align: center; opacity: 0.6; font-size: 0.85rem; margin: 0;">Aucun événement majeur à signaler.</p>` : ''}
                        </div>

                        ${stats ? `
                        <div class="modal-divider"></div>
                        <h3 class="modal-section-title"><i class="fa-solid fa-chart-simple"></i> Statistiques du Match</h3>
                        <div class="stats-table" style="display: flex; flex-direction: column; gap: 15px; background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem;">
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
                                    ${(() => {
                                        const xgHome = parseFloat(stats.xg[0]) || 0;
                                        const xgAway = parseFloat(stats.xg[1]) || 0;
                                        const xgTotal = (xgHome + xgAway) || 1;
                                        const pctHome = Math.round((xgHome / xgTotal) * 100);
                                        const pctAway = 100 - pctHome;
                                        return `
                                            <div style="width: ${pctHome}%; background: var(--or-premium);"></div>
                                            <div style="width: ${pctAway}%; background: rgba(255,255,255,0.2);"></div>
                                        `;
                                    })()}
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
                                    <div style="width: ${Math.round((stats.shots[0] / Math.max(1, stats.shots[0] + stats.shots[1])) * 100)}%; background: var(--or-premium);"></div>
                                    <div style="width: ${Math.round((stats.shots[1] / Math.max(1, stats.shots[0] + stats.shots[1])) * 100)}%; background: rgba(255,255,255,0.2);"></div>
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
                                    <div style="width: ${stats.passAcc[0]}%; background: var(--or-premium);"></div>
                                    <div style="width: ${stats.passAcc[1]}%; background: rgba(255,255,255,0.2);"></div>
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
                                    <div style="width: ${Math.round((stats.corners[0] / Math.max(1, stats.corners[0] + stats.corners[1])) * 100)}%; background: var(--or-premium);"></div>
                                    <div style="width: ${Math.round((stats.corners[1] / Math.max(1, stats.corners[0] + stats.corners[1])) * 100)}%; background: rgba(255,255,255,0.2);"></div>
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
                                    <div style="width: ${Math.round((stats.fouls[0] / Math.max(1, stats.fouls[0] + stats.fouls[1])) * 100)}%; background: var(--or-premium);"></div>
                                    <div style="width: ${Math.round((stats.fouls[1] / Math.max(1, stats.fouls[0] + stats.fouls[1])) * 100)}%; background: rgba(255,255,255,0.2);"></div>
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
                                    <div style="width: ${Math.round((stats.saves[0] / (Math.max(1, stats.saves[0] + stats.saves[1]))) * 100)}%; background: var(--or-premium);"></div>
                                    <div style="width: ${Math.round((stats.saves[1] / (Math.max(1, stats.saves[0] + stats.saves[1]))) * 100)}%; background: rgba(255,255,255,0.2);"></div>
                                </div>
                            </div>
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
