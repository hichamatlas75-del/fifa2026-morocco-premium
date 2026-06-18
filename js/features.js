import { getFlag } from './api.js';
import { renderMatches } from './components/matches.js';

const TEAM_RATINGS = {
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

let initialized = false;

export function initPremiumFeatures(app) {
    if (!app || !app.data) return;
    refreshPremiumFeatures(app);

    if (initialized) return;
    initialized = true;

    document.addEventListener('click', (event) => {
        const favBtn = event.target.closest('[data-fav-toggle]');
        if (!favBtn) return;
        event.preventDefault();
        event.stopPropagation();
        app.favoriteTeam = favBtn.getAttribute('data-team') || 'MAR';
        localStorage.setItem('favoriteTeam', app.favoriteTeam);
        app.applyInitialRender();
        refreshPremiumFeatures(app);
    });

    document.getElementById('favorite-team-select')?.addEventListener('change', (event) => {
        app.favoriteTeam = event.target.value || 'MAR';
        localStorage.setItem('favoriteTeam', app.favoriteTeam);
        app.applyInitialRender();
        refreshPremiumFeatures(app);
    });

    document.getElementById('compare-team-a')?.addEventListener('change', () => renderComparison(app));
    document.getElementById('compare-team-b')?.addEventListener('change', () => renderComparison(app));
    document.getElementById('analytics-team-a')?.addEventListener('change', () => app.initChart());
    document.getElementById('analytics-team-b')?.addEventListener('change', () => app.initChart());
}

export function refreshPremiumFeatures(app) {
    if (!app || !app.data) return;
    renderDataSource(app);
    populateFeatureSelects(app);
    renderMoroccoDashboard(app);
    renderFavorites(app);
    renderAlerts(app);
    renderNextMatch(app);
    renderComparison(app);
}

function teamName(app, tla, fallback = tla) {
    return app.t(`teams.${tla}`, fallback);
}

function uniqueTeams(app) {
    const teams = new Map();
    app.data.matches.forEach(match => {
        teams.set(match.homeTla, { tla: match.homeTla, name: match.homeTeam });
        teams.set(match.awayTla, { tla: match.awayTla, name: match.awayTeam });
    });
    return Array.from(teams.values()).sort((a, b) => teamName(app, a.tla, a.name).localeCompare(teamName(app, b.tla, b.name)));
}

function populateFeatureSelects(app) {
    const teams = uniqueTeams(app);
    const selectIds = ['favorite-team-select', 'compare-team-a', 'compare-team-b', 'analytics-team-a', 'analytics-team-b'];
    const currentLang = app.currentLang;

    selectIds.forEach((id) => {
        const select = document.getElementById(id);
        if (!select) return;
        
        const currentVal = select.value;
        
        if (select.dataset.ready === '1' && select.dataset.lang === currentLang) return;
        
        select.innerHTML = teams.map(team => `<option value="${team.tla}">${teamName(app, team.tla, team.name)}</option>`).join('');
        select.dataset.ready = '1';
        select.dataset.lang = currentLang;
        
        if (currentVal) select.value = currentVal;
    });

    const favoriteSelect = document.getElementById('favorite-team-select');
    if (favoriteSelect) favoriteSelect.value = app.favoriteTeam || 'MAR';

    const teamA = document.getElementById('compare-team-a');
    const teamB = document.getElementById('compare-team-b');
    if (teamA && !teamA.value) teamA.value = 'MAR';
    if (teamB && (!teamB.value || teamB.value === teamA?.value)) teamB.value = 'BRA';

    const analyticsA = document.getElementById('analytics-team-a');
    const analyticsB = document.getElementById('analytics-team-b');
    if (analyticsA && !analyticsA.value) analyticsA.value = 'MAR';
    if (analyticsB && (!analyticsB.value || analyticsB.value === analyticsA?.value)) analyticsB.value = 'BRA';

    const groupSelect = document.getElementById('simulator-group-select');
    if (groupSelect) {
        const currentVal = groupSelect.value;
        if (groupSelect.dataset.ready === '1' && groupSelect.dataset.lang === currentLang) {
            // Déjà prêt
        } else {
            const groups = [...new Set(app.data.matches.map(match => match.group))].filter(Boolean).sort();
            groupSelect.innerHTML = groups.map(group => `<option value="${group}">${translateGroup(app, group)}</option>`).join('');
            groupSelect.dataset.ready = '1';
            groupSelect.dataset.lang = currentLang;
            if (currentVal) {
                groupSelect.value = currentVal;
            } else {
                groupSelect.value = groups.includes('Groupe C') ? 'Groupe C' : groups[0] || '';
            }
        }
    }
}

function renderDataSource(app) {
    const badge = document.getElementById('data-source-badge');
    if (!badge) return;
    const isApi = app.data.dataSource === 'api';
    badge.className = `data-source-badge ${isApi ? 'is-api' : 'is-fallback'}`;
    badge.innerHTML = `<span></span>`;
    badge.title = isApi ? 'API synchronisée' : 'Données de secours';
}

function translateGroup(app, group) {
    const cleanGroup = (group || '').replace('Groupe ', '').replace('Group ', '');
    return app.currentLang === 'en' ? `Group ${cleanGroup}` : `Groupe ${cleanGroup}`;
}

function moroccoMatches(app) {
    return app.data.matches.filter(match => match.homeTla === 'MAR' || match.awayTla === 'MAR');
}

function renderMoroccoDashboard(app) {
    const container = document.getElementById('morocco-dashboard');
    if (!container) return;

    const matches = moroccoMatches(app);
    const next = matches.find(match => match.status !== 'FINISHED') || matches[0];
    const groupRows = app.data.standings?.groups?.['Groupe C'] || computeStandings(matches);
    const moroccoRank = groupRows.find(row => row.tla === 'MAR');

    container.innerHTML = `
        <div class="premium-card feature-stat-card">
            <span>Prochain match</span>
            <strong>${next ? `${teamName(app, next.homeTla, next.homeTeam)} - ${teamName(app, next.awayTla, next.awayTeam)}` : 'À confirmer'}</strong>
            <small>${next ? `${next.date} · ${next.time} · ${next.stadium}` : 'Calendrier en attente'}</small>
        </div>
        <div class="premium-card feature-stat-card">
            <span>Position Groupe C</span>
            <strong>${moroccoRank ? `${moroccoRank.rank}e · ${moroccoRank.pts} pts` : 'En attente'}</strong>
            <small>Classement recalculé depuis les scores disponibles.</small>
        </div>
        <div class="premium-card feature-stat-card">
            <span>Joueurs clés</span>
            <strong>Bounou · Hakimi · Brahim</strong>
            <small>Base locale enrichie, compatible API gratuite.</small>
        </div>
    `;
}

function renderFavorites(app) {
    const favoriteMatches = app.data.matches.filter(match => match.homeTla === app.favoriteTeam || match.awayTla === app.favoriteTeam);
    renderMatches(favoriteMatches, 'favorites-grid');
}

function renderAlerts(app) {
    const container = document.getElementById('alerts-center');
    if (!container) return;

    const matches = app.data.matches;
    const favMatches = matches.filter(match => match.homeTla === app.favoriteTeam || match.awayTla === app.favoriteTeam);
    const liveCount = matches.filter(match => match.status === 'LIVE').length;
    const nextFavorite = favMatches.find(match => match.status !== 'FINISHED');

    const alerts = [
        liveCount > 0 ? `${liveCount} match en direct à suivre maintenant.` : 'Aucun match en direct pour le moment.',
        nextFavorite ? `Prochain favori : ${teamName(app, nextFavorite.homeTla, nextFavorite.homeTeam)} vs ${teamName(app, nextFavorite.awayTla, nextFavorite.awayTeam)}.` : 'Aucun match favori à venir.',
        app.data.dataSource === 'api' ? 'Les données viennent du proxy API.' : 'Mode secours actif : aucune donnée live forcée.'
    ];

    container.innerHTML = alerts.map(alert => `<div class="alert-item"><i class="fa-solid fa-circle-info"></i><span>${alert}</span></div>`).join('');
}

function renderNextMatch(app) {
    const container = document.getElementById('next-match-card');
    if (!container) return;
    const next = app.data.matches.find(match => match.status !== 'FINISHED');

    if (!next) {
        container.innerHTML = '<p class="muted-text">Aucun match à venir.</p>';
        return;
    }

    container.innerHTML = `
        <div class="next-match-mini">
            <div>${getFlag(next.homeTla)} <strong>${teamName(app, next.homeTla, next.homeTeam)}</strong></div>
            <span>${next.time}</span>
            <div>${getFlag(next.awayTla)} <strong>${teamName(app, next.awayTla, next.awayTeam)}</strong></div>
        </div>
        <p class="muted-text">${next.date} · ${next.stadium}</p>
    `;
}

function renderComparison(app) {
    const container = document.getElementById('comparison-result');
    const teamA = document.getElementById('compare-team-a')?.value || 'MAR';
    const teamB = document.getElementById('compare-team-b')?.value || 'BRA';
    if (!container) return;

    const ratingA = TEAM_RATINGS[teamA] || 70;
    const ratingB = TEAM_RATINGS[teamB] || 70;
    const total = ratingA + ratingB;
    const percentA = Math.round((ratingA / total) * 100);
    const percentB = 100 - percentA;

    container.innerHTML = `
        <div class="comparison-bars">
            <div>
                <span>${getFlag(teamA)} ${teamName(app, teamA)}</span>
                <strong>${percentA}%</strong>
            </div>
            <div class="bar-track"><span style="width:${percentA}%"></span></div>
            <div>
                <span>${getFlag(teamB)} ${teamName(app, teamB)}</span>
                <strong>${percentB}%</strong>
            </div>
            <div class="bar-track away"><span style="width:${percentB}%"></span></div>
        </div>
        <p class="muted-text">${percentA === percentB ? 'Match très équilibré.' : percentA > percentB ? `${teamName(app, teamA)} part avec un léger avantage.` : `${teamName(app, teamB)} part avec un léger avantage.`}</p>
    `;
}



function computeStandings(matches) {
    const teams = new Map();

    // Initialize all teams in the map
    matches.forEach(match => {
        [match.homeTla, match.awayTla].forEach(tla => {
            if (tla && tla !== 'TBD' && !teams.has(tla)) {
                teams.set(tla, { tla, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
            }
        });
    });

    // Only compute stats for matches that are LIVE or FINISHED
    matches.forEach(match => {
        if (match.status === 'LIVE' || match.status === 'FINISHED') {
            const home = teams.get(match.homeTla);
            const away = teams.get(match.awayTla);
            if (home && away) {
                home.p++;
                away.p++;
                home.gf += match.homeScore;
                home.ga += match.awayScore;
                away.gf += match.awayScore;
                away.ga += match.homeScore;

                if (match.homeScore > match.awayScore) {
                    home.w++;
                    home.pts += 3;
                    away.l++;
                } else if (match.homeScore < match.awayScore) {
                    away.w++;
                    away.pts += 3;
                    home.l++;
                } else {
                    home.d++;
                    away.d++;
                    home.pts++;
                    away.pts++;
                }
            }
        }
    });

    return Array.from(teams.values())
        .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.tla.localeCompare(b.tla))
        .map((team, index) => ({ ...team, rank: index + 1 }));
}
