// js/app.js
import '../style.css';
import { initApi, getH2HData } from './api.js';
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
        this.currentLang = 'fr';
        this.data = null;
        this.map = null;
        this.chart = null;
        
        // Exposer la méthode globalement pour l'attribut onclick
        window.openMatchDetails = (matchId) => {
            this.openMatchDetails(matchId);
        };

        this.init();
    }

    async init() {
        // Initialisation des animations AOS si disponibles
        if (typeof AOS !== 'undefined') {
            AOS.init({ once: true, offset: 80 });
        }

        // Configuration PWA
        this.registerServiceWorker();

        // Gestion du thème
        this.setupThemeToggle();
        this.setupMobileMenu();
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

            // Attacher l'écouteur pour les détails de match
            this.setupMatchDetailsListener();

            // Initialiser les sockets (avec fallback simulateur intégré)
            setupWebSockets(this);

            // Initialiser Leaflet
            this.initMap(this.data.stadiums);

            // Initialiser le graphique tactique
            this.initChart();

        } catch (error) {
            console.error('Erreur de chargement des données FIFA:', error);
        }
    }

    applyInitialRender() {
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

        // Groupes uniques
        const groups = [...new Set(this.data.matches.map(m => m.group))].sort();
        if (groupSelect) {
            groups.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g;
                opt.innerText = g;
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
            filtered = filtered.filter(m => 
                m.homeTeam.toLowerCase().includes(query) || 
                m.awayTeam.toLowerCase().includes(query) || 
                m.group.toLowerCase().includes(query) || 
                m.stadium.toLowerCase().includes(query)
            );
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
                const aIsMaroc = a.homeTeam === 'Maroc' || a.awayTeam === 'Maroc';
                const bIsMaroc = b.homeTeam === 'Maroc' || b.awayTeam === 'Maroc';
                if (aIsMaroc && !bIsMaroc) return -1;
                if (!aIsMaroc && bIsMaroc) return 1;
                return a.id - b.id; // Garde l'ordre chrono secondaire
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
                    statusEl.innerHTML = `<span class="live-badge" style="padding: 0.2rem 0.6rem; font-size: 0.7rem;"><span class="live-pulse"></span> Direct ${data.time}</span>`;
                } else if (data.status === 'FINISHED') {
                    statusEl.innerHTML = `<span style="font-size: 0.8rem; opacity: 0.6; font-weight: bold;">Terminé</span>`;
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

        // Synthétiser un coup de sifflet d'arbitre (Audio local sans dépendance fichier externe)
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                const ctx = new AudioContext();
                
                // Premier bip court
                this.playWhistleBeep(ctx, 0, 0.15, 1200);
                // Deuxième bip plus long et modulé
                this.playWhistleBeep(ctx, 0.2, 0.5, 1400);
            }
        } catch (e) {
            console.warn('Le son du sifflet a été bloqué par la politique de sécurité audio:', e);
        }
    }

    playWhistleBeep(ctx, startTime, duration, freq) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
        // Effet vibrato sifflet
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
        } else if (Notification.permission !== 'denied') {
            try {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    new Notification('Coupe du Monde 2026', {
                        body: body,
                        icon: 'https://cdn-icons-png.flaticon.com/512/5323/5323977.png'
                    });
                }
            } catch (e) {
                console.log('Push notification request blocked');
            }
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

    // Langue configurée uniquement en Français (FR)

    async loadTranslations() {
        try {
            const response = await fetch(`./data/locales/${this.currentLang}.json`);
            this.i18n = await response.json();
            this.hydrateTranslations();
        } catch (error) {
            console.error(`Erreur de chargement des traductions (${this.currentLang}):`, error);
        }
    }

    hydrateTranslations() {
        if (!this.i18n) return;

        // Mettre à jour les liens de navigation
        const navLinks = document.querySelectorAll('.nav-links a');
        if (navLinks.length >= 8) {
            navLinks[0].innerHTML = this.i18n.nav.home;
            navLinks[1].innerHTML = this.i18n.nav.calendar;
            navLinks[2].innerHTML = this.i18n.nav.live;
            navLinks[3].innerHTML = this.i18n.nav.teams;
            navLinks[4].innerHTML = this.i18n.nav.morocco;
            navLinks[5].innerHTML = this.i18n.nav.standings;
            navLinks[6].innerHTML = this.i18n.nav.analytics;
            navLinks[7].innerHTML = this.i18n.nav.stadiums;
        }

        // Tagline et Titre du Hero
        const tagline = document.querySelector('.hero-tagline');
        if (tagline) tagline.innerText = this.i18n.hero.tagline;

        const heroTitle = document.querySelector('.hero-title');
        if (heroTitle && this.i18n.hero.title) {
            heroTitle.innerHTML = `${this.i18n.hero.title}<br><span style="color:var(--or-premium)">${this.i18n.hero.subtitle}</span>`;
        }

        // Labels du compte à rebours
        const countdownBoxes = document.querySelectorAll('.countdown-box');
        if (countdownBoxes.length === 4) {
            countdownBoxes[0].querySelector('.countdown-label').innerText = this.i18n.hero.countdown.days;
            countdownBoxes[1].querySelector('.countdown-label').innerText = this.i18n.hero.countdown.hours;
            countdownBoxes[2].querySelector('.countdown-label').innerText = this.i18n.hero.countdown.minutes;
            countdownBoxes[3].querySelector('.countdown-label').innerText = this.i18n.hero.countdown.seconds;
        }

        // Traduction des liens mobiles
        const mobileLinks = document.querySelectorAll('.mobile-nav-links a');
        if (mobileLinks.length >= 8) {
            mobileLinks[0].innerHTML = this.i18n.nav.home;
            mobileLinks[1].innerHTML = this.i18n.nav.calendar;
            mobileLinks[2].innerHTML = this.i18n.nav.live;
            mobileLinks[3].innerHTML = this.i18n.nav.teams;
            mobileLinks[4].innerHTML = this.i18n.nav.morocco;
            mobileLinks[5].innerHTML = this.i18n.nav.standings;
            mobileLinks[6].innerHTML = this.i18n.nav.analytics;
            mobileLinks[7].innerHTML = this.i18n.nav.stadiums;
        }
    }

    registerServiceWorker() {
        // Désenregistrer activement tous les Service Workers existants
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                for (let registration of registrations) {
                    registration.unregister().then(success => {
                        if (success) {
                            console.log('SW: Désenregistré avec succès.');
                        }
                    });
                }
            }).catch(err => console.warn('SW: Erreur lors du désenregistrement:', err));
        }

        // Vider tous les caches stockés dans le navigateur (Cache Storage API)
        if ('caches' in window) {
            caches.keys().then(keys => {
                return Promise.all(keys.map(key => {
                    console.log('SW: Suppression du cache:', key);
                    return caches.delete(key);
                }));
            }).then(() => {
                console.log('SW: Tous les caches ont été nettoyés avec succès.');
            }).catch(err => console.warn('SW: Erreur lors du nettoyage du cache:', err));
        }
    }

    initMap(stadiums) {
        if (typeof L === 'undefined' || !document.getElementById('map')) return;

        // Centrer la carte sur l'Amérique du Nord (USA, Canada, Mexique)
        this.map = L.map('map', {
            scrollWheelZoom: false
        }).setView([38.5, -98.0], 4);

        // Fond de carte sombre personnalisé (CartoDB Dark Matter) pour préserver l'esthétique premium
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(this.map);

        // Icône personnalisée rouge-vert-or premium
        const customIcon = L.divIcon({
            className: 'custom-map-marker',
            html: `<div style="background: var(--red-maroc); border: 2px solid var(--gold-premium); width: 14px; height: 14px; border-radius: 50%; box-shadow: 0 0 10px var(--red-maroc);"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });

        // Ajouter les marqueurs des stades
        stadiums.forEach(stad => {
            const popupContent = `
                <div style="font-family: 'Inter', sans-serif; padding: 5px;">
                    <h4 class="font-sport" style="color: var(--or-premium); margin: 0 0 8px 0; font-size: 1rem; border-bottom: 1px solid rgba(255,215,0,0.2); padding-bottom: 3px;">${stad.name}</h4>
                    <p style="margin: 3px 0; font-size: 0.85rem;"><i class="fa-solid fa-city" style="color: var(--white); width: 15px;"></i> Ville : <strong>${stad.city}</strong></p>
                    <p style="margin: 3px 0; font-size: 0.85rem;"><i class="fa-solid fa-users" style="color: var(--white); width: 15px;"></i> Capacité : <strong>${stad.capacity} places</strong></p>
                    <p style="margin: 3px 0; font-size: 0.85rem;"><i class="fa-solid fa-futbol" style="color: var(--white); width: 15px;"></i> Matchs : <strong>${stad.matchesCount} programmés</strong></p>
                </div>
            `;
            L.marker(stad.coords, { icon: customIcon })
                .addTo(this.map)
                .bindPopup(popupContent);
        });
    }

    initChart() {
        const canvas = document.getElementById('advancedStatsChart');
        if (typeof Chart === 'undefined' || !canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Configuration du radar comparatif Maroc (Lions de l'Atlas) vs Brésil
        this.chart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Possession (%)', 'xG (Buts attendus)', 'Tirs cadrés', 'Précision Passes (%)', 'Duels Gagnés', 'Efficacité Pressing'],
                datasets: [
                    {
                        label: '🇲🇦 Maroc (Lions de l\'Atlas)',
                        data: [52, 1.8, 7, 86, 58, 78],
                        backgroundColor: 'rgba(0, 98, 51, 0.25)',
                        borderColor: '#006233',
                        pointBackgroundColor: '#FFD700',
                        pointBorderColor: '#006233',
                        borderWidth: 2
                    },
                    {
                        label: '🇧🇷 Brésil',
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
                            color: '#FFFFFF',
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
                            color: '#FFFFFF',
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
        console.log("⚽ [App] Enregistrement de l'écouteur de clic sur les cartes de match...");
        // Écouter les clics sur les cartes de match via délégation d'événements
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
        if (!this.data) {
            console.error("⚽ [App] Données de match non disponibles");
            return;
        }
        const match = this.data.matches.find(m => m.id === matchId);
        if (!match) {
            console.error("⚽ [App] Match non trouvé dans la liste pour l'ID :", matchId);
            return;
        }

        // Récupérer l'historique H2H
        const h2h = getH2HData(match.homeTeam, match.awayTeam);
        console.log("⚽ [App] Confrontations H2H récupérées :", h2h);

        // Créer l'élément de modal s'il n'existe pas
        let modal = document.getElementById('match-details-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'match-details-modal';
            modal.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100vh; z-index: 3000; display: none; align-items: center; justify-content: center; padding: 1rem;";
            document.body.appendChild(modal);
        }

        // Remplir le contenu du modal avec une structure premium et responsive
        modal.innerHTML = `
            <div class="modal-backdrop" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);"></div>
            <div class="modal-content premium-card" style="position: relative; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; background: rgba(15, 15, 15, 0.95); border: 1px solid rgba(255, 215, 0, 0.2); box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(255, 215, 0, 0.05); z-index: 3010; padding: 2.5rem; border-radius: 16px;">
                <button class="modal-close-btn" id="close-match-modal" aria-label="Fermer">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                
                <div class="modal-header">
                    <span class="group-label">${match.group}</span>
                    <span class="date-label"><i class="fa-regular fa-calendar-days"></i> ${match.date}</span>
                </div>
                
                <div class="match-score-section">
                    <div class="team-side">
                        <div class="modal-flag-wrapper">${match.homeFlag}</div>
                        <span class="modal-team-name">${match.homeTeam}</span>
                    </div>
                    
                    <div class="score-display">
                        ${match.status === 'SCHEDULED' ? `
                            <span class="kickoff-time">${match.time}</span>
                            <span class="status-badge status-scheduled">Programmé</span>
                        ` : `
                            <span class="live-score" id="modal-score-${match.id}">${match.homeScore} - ${match.awayScore}</span>
                            <span class="status-badge ${match.status === 'LIVE' ? 'status-live' : 'status-finished'}">
                                ${match.status === 'LIVE' ? 'En Direct' : 'Terminé'}
                            </span>
                        `}
                    </div>
                    
                    <div class="team-side">
                        <div class="modal-flag-wrapper">${match.awayFlag}</div>
                        <span class="modal-team-name">${match.awayTeam}</span>
                    </div>
                </div>

                <div class="modal-body">
                    <div class="info-row" style="display: flex; align-items: center; gap: 8px; font-size: 0.95rem; margin-bottom: 1.5rem; opacity: 0.9;">
                        <i class="fa-solid fa-location-dot" style="color: var(--or-premium);"></i> <span>Stade :</span>
                        <strong>${match.stadium}</strong>
                    </div>
                    
                    <div class="modal-divider"></div>
                    
                    <h3 class="modal-section-title"><i class="fa-solid fa-clock-rotate-left"></i> Confrontations Précédentes</h3>
                    <div class="h2h-list">
                        ${h2h.map(game => `
                            <div class="h2h-item">
                                <div class="h2h-meta">
                                    <span class="h2h-date">${game.date}</span>
                                    <span class="h2h-comp" style="color: var(--or-premium); font-weight: 500;">${game.comp}</span>
                                </div>
                                <div class="h2h-result">
                                    <span class="h2h-score" style="font-weight: 700; color: var(--white);">${game.score}</span>
                                    <p class="h2h-details" style="font-size: 0.85rem; opacity: 0.7; margin-top: 5px; line-height: 1.5;">${game.details}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    ${match.status !== 'SCHEDULED' ? `
                        <div class="modal-divider"></div>
                        <h3 class="modal-section-title"><i class="fa-solid fa-chart-bar"></i> Statistiques Attendues</h3>
                        <div class="mock-stats-grid">
                            <div class="stat-row">
                                <span class="stat-val" style="font-weight: bold; color: var(--white);">${match.status === 'LIVE' ? Math.floor(Math.random() * 20) + 40 : 54}%</span>
                                <span class="stat-name">Possession</span>
                                <span class="stat-val" style="font-weight: bold; color: var(--white);">${match.status === 'LIVE' ? 100 - (Math.floor(Math.random() * 20) + 40) : 46}%</span>
                            </div>
                            <div class="stat-bar-container">
                                <div class="stat-bar-fill" style="width: ${match.status === 'LIVE' ? Math.floor(Math.random() * 20) + 40 : 54}%;"></div>
                            </div>
                            
                            <div class="stat-row" style="margin-top: 15px;">
                                <span class="stat-val" style="font-weight: bold; color: var(--white);">${match.status === 'LIVE' ? (Math.random() * 1.5 + 0.2).toFixed(2) : '1.45'}</span>
                                <span class="stat-name">xG (Expected Goals)</span>
                                <span class="stat-val" style="font-weight: bold; color: var(--white);">${match.status === 'LIVE' ? (Math.random() * 1.5 + 0.2).toFixed(2) : '1.12'}</span>
                            </div>
                            
                            <div class="stat-row" style="margin-top: 15px;">
                                <span class="stat-val" style="font-weight: bold; color: var(--white);">${match.homeScore + (match.status === 'LIVE' ? Math.floor(Math.random() * 5) : 8)}</span>
                                <span class="stat-name">Tirs Totaux</span>
                                <span class="stat-val" style="font-weight: bold; color: var(--white);">${match.awayScore + (match.status === 'LIVE' ? Math.floor(Math.random() * 5) : 6)}</span>
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
