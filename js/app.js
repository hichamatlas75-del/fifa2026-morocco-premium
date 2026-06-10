// js/app.js
import '../style.css';
import { initApi, getH2HData, getFlag } from './api.js';
import { setupWebSockets } from './socket.js';
import { 
    renderMatches, 
    renderLiveMatches, 
    renderTeams, 
    renderMoroccoSquad, 
    renderStandings, 
    renderNews 
} from './components/matches.js';

class WorldCupApp {
    constructor() {
        this.socketUrl = 'wss://api.football-data-premium.com/live';
        // Langue configurée à partir du localStorage ou français par défaut
        this.currentLang = localStorage.getItem('lang') || 'fr';
        this.data = null;
        this.map = null;
        this.chart = null;
        this.i18n = null;
        
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

        // Charger les traductions initiales
        await this.loadTranslations();

        // Initialisation des API & WebSockets
        try {
            this.data = await initApi();
            
            // Initialisation des rendus de base
            this.applyInitialRender();

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
        }
    }

    applyInitialRender() {
        if (!this.data) return;
        renderMatches(this.data.matches);
        renderLiveMatches(this.data.matches);
        renderTeams(this.data.matches);
        renderMoroccoSquad(this.data.moroccoSquad);
        renderStandings(this.data.standings);
        renderNews(this.data.news);
    }

    populateFilterDropdowns() {
        const groupSelect = document.getElementById('filter-group');
        const stadiumSelect = document.getElementById('filter-stadium');
        
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

        const filterHandler = () => this.applyFilters();

        if (searchInput) searchInput.addEventListener('input', filterHandler);
        if (groupSelect) groupSelect.addEventListener('change', filterHandler);
        if (stadiumSelect) stadiumSelect.addEventListener('change', filterHandler);
        if (sortSelect) sortSelect.addEventListener('change', filterHandler);
    }

    applyFilters() {
        const query = (document.getElementById('search-match')?.value || '').toLowerCase().trim();
        const selectedGroup = document.getElementById('filter-group')?.value || '';
        const selectedStadium = document.getElementById('filter-stadium')?.value || '';
        const sortOrder = document.getElementById('sort-order')?.value || 'chrono';

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
            
            // Rafraîchir les sections live
            renderLiveMatches(this.data.matches);

            // Mettre à jour l'élément spécifique dans le calendrier s'il est affiché
            const scoreHomeEl = document.getElementById(`score-home-${data.matchId}`);
            const scoreAwayEl = document.getElementById(`score-away-${data.matchId}`);
            const statusEl = document.getElementById(`status-${data.matchId}`);
            
            if (scoreHomeEl) scoreHomeEl.innerText = data.homeScore;
            if (scoreAwayEl) scoreAwayEl.innerText = data.awayScore;

            // Mettre à jour le score du modal s'il est ouvert
            const modalScoreEl = document.getElementById(`modal-score-${data.matchId}`);
            if (modalScoreEl) modalScoreEl.innerText = `${data.homeScore} - ${data.awayScore}`;
            
            if (statusEl) {
                if (data.status === 'LIVE') {
                    statusEl.innerHTML = `<span class="live-badge" style="padding: 0.2rem 0.6rem; font-size: 0.7rem;"><span class="live-pulse"></span> ${this.t('modal.live', 'Direct')} ${data.time}</span>`;
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
        if (Notification.permission === 'granted') {
            new Notification('Coupe du Monde 2026', {
                body: body,
                icon: 'https://cdn-icons-png.flaticon.com/512/5323/5323977.png'
            });
        }
    }

    setupThemeToggle() {
        const btn = document.getElementById('theme-toggle');
        if (!btn) return;

        const isLight = localStorage.getItem('theme') === 'light';
        
        if (isLight) {
            document.body.classList.replace('theme-dark', 'theme-light');
            btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        }

        btn.addEventListener('click', () => {
            if (document.body.classList.contains('theme-light')) {
                document.body.classList.replace('theme-light', 'theme-dark');
                btn.innerHTML = '<i class="fa-solid fa-moon"></i>';
                localStorage.setItem('theme', 'dark');
            } else {
                document.body.classList.replace('theme-dark', 'theme-light');
                btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
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
        if (navLinks.length >= 8) {
            navLinks[0].innerHTML = this.t('nav.home');
            navLinks[1].innerHTML = this.t('nav.calendar');
            navLinks[2].innerHTML = this.t('nav.live');
            navLinks[3].innerHTML = this.t('nav.teams');
            navLinks[4].innerHTML = this.t('nav.morocco');
            navLinks[5].innerHTML = this.t('nav.standings');
            navLinks[6].innerHTML = this.t('nav.analytics');
            navLinks[7].innerHTML = this.t('nav.stadiums');
        }

        // 2. Liens de navigation (Mobile)
        const mobileLinks = document.querySelectorAll('.mobile-nav-links a');
        if (mobileLinks.length >= 8) {
            mobileLinks[0].innerHTML = this.t('nav.home');
            mobileLinks[1].innerHTML = this.t('nav.calendar');
            mobileLinks[2].innerHTML = this.t('nav.live');
            mobileLinks[3].innerHTML = this.t('nav.teams');
            mobileLinks[4].innerHTML = this.t('nav.morocco');
            mobileLinks[5].innerHTML = this.t('nav.standings');
            mobileLinks[6].innerHTML = this.t('nav.analytics');
            mobileLinks[7].innerHTML = this.t('nav.stadiums');
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

        // 5. Countdown labels
        const countdownBoxes = document.querySelectorAll('.countdown-box');
        if (countdownBoxes.length === 4) {
            countdownBoxes[0].querySelector('.countdown-label').innerText = this.t('hero.countdown.days');
            countdownBoxes[1].querySelector('.countdown-label').innerText = this.t('hero.countdown.hours');
            countdownBoxes[2].querySelector('.countdown-label').innerText = this.t('hero.countdown.minutes');
            countdownBoxes[3].querySelector('.countdown-label').innerText = this.t('hero.countdown.seconds');
        }

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
            const newLang = e.target.getAttribute('data-lang');
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

                // Recréer le graphe
                this.initChart();
            }
        };

        desktopBtns.forEach(btn => btn.addEventListener('click', switchHandler));
        mobileBtns.forEach(btn => btn.addEventListener('click', switchHandler));

        updateActiveLangButton(this.currentLang);
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                for (let registration of registrations) {
                    registration.unregister();
                }
            }).catch(err => console.warn('SW error:', err));
        }
    }

    initMap(stadiums) {
        if (typeof L === 'undefined' || !document.getElementById('map')) return;

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

        this.chart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: radarLabels,
                datasets: [
                    {
                        label: this.t('analyticsZone.radar.maroc', '🇲🇦 Maroc (Lions de l\'Atlas)'),
                        data: [52, 1.8, 7, 86, 58, 78],
                        backgroundColor: 'rgba(0, 98, 51, 0.25)',
                        borderColor: '#006233',
                        pointBackgroundColor: '#FFD700',
                        pointBorderColor: '#006233',
                        borderWidth: 2
                    },
                    {
                        label: this.t('analyticsZone.radar.brazil', '🇧🇷 Brésil'),
                        data: [48, 2.1, 9, 89, 52, 72],
                        backgroundColor: 'rgba(255, 223, 0, 0.15)',
                        borderColor: '#009c3b',
                        pointBackgroundColor: '#ffdf00',
                        pointBorderColor: '#009c3b',
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
            if (card) {
                console.log("⚽ [App] Carte cliquée :", card.id);
                const matchId = parseInt(card.id.replace('match-', ''), 10);
                this.openMatchDetails(matchId);
            }
        });
    }

    openMatchDetails(matchId) {
        console.log("⚽ [App] Ouverture des détails du match ID :", matchId);
        if (!this.data) return;
        
        const match = this.data.matches.find(m => m.id === matchId);
        if (!match) return;

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
            statusLabel = this.t('modal.live', 'En Direct');
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
                    <span class="date-label"><i class="fa-regular fa-calendar-days"></i> ${match.date.replace("Juin", this.currentLang === 'en' ? "June" : "Juin")}</span>
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
                        <h3 class="modal-section-title"><i class="fa-solid fa-chart-bar"></i> ${this.t('modal.stats', 'Statistiques Attendues')}</h3>
                        <div class="mock-stats-grid">
                            <div class="stat-row">
                                <span class="stat-val" style="font-weight: bold;">${match.status === 'LIVE' ? Math.floor(Math.random() * 20) + 40 : 54}%</span>
                                <span class="stat-name">${this.t('modal.possession', 'Possession')}</span>
                                <span class="stat-val" style="font-weight: bold;">${match.status === 'LIVE' ? 100 - (Math.floor(Math.random() * 20) + 40) : 46}%</span>
                            </div>
                            <div class="stat-bar-container">
                                <div class="stat-bar-fill" style="width: ${match.status === 'LIVE' ? Math.floor(Math.random() * 20) + 40 : 54}%;"></div>
                            </div>
                            
                            <div class="stat-row" style="margin-top: 15px;">
                                <span class="stat-val" style="font-weight: bold;">${match.status === 'LIVE' ? (Math.random() * 1.5 + 0.2).toFixed(2) : '1.45'}</span>
                                <span class="stat-name">${this.t('modal.xg', 'xG (Expected Goals)')}</span>
                                <span class="stat-val" style="font-weight: bold;">${match.status === 'LIVE' ? (Math.random() * 1.5 + 0.2).toFixed(2) : '1.12'}</span>
                            </div>
                            
                            <div class="stat-row" style="margin-top: 15px;">
                                <span class="stat-val" style="font-weight: bold;">${match.homeScore + (match.status === 'LIVE' ? Math.floor(Math.random() * 5) : 8)}</span>
                                <span class="stat-name">${this.t('modal.shots', 'Tirs Totaux')}</span>
                                <span class="stat-val" style="font-weight: bold;">${match.awayScore + (match.status === 'LIVE' ? Math.floor(Math.random() * 5) : 6)}</span>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        const closeBtn = modal.querySelector('#close-match-modal');
        const backdrop = modal.querySelector('.modal-backdrop');
        
        const closeModal = () => {
            console.log("⚽ [App] Fermeture du modal");
            modal.style.display = 'none';
            document.body.style.overflow = '';
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (backdrop) backdrop.addEventListener('click', closeModal);
    }
}

// Lancement de l'application
document.addEventListener('DOMContentLoaded', () => {
    window.App = new WorldCupApp();
});
