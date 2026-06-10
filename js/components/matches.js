// js/components/matches.js
import { getFlag } from '../api.js';

function t(path, defaultValue = '') {
    if (!window.App || !window.App.i18n) return defaultValue;
    const parts = path.split('.');
    let current = window.App.i18n;
    for (const part of parts) {
        if (current[part] === undefined) return defaultValue;
        current = current[part];
    }
    return current;
}

function translateTeam(tla, defaultName) {
    return t(`teams.${tla}`, defaultName);
}

function translateGroupDisplay(groupName) {
    if (!groupName) return '';
    const cleanGroup = groupName.replace("Groupe ", "").replace("Group ", "");
    const activeLang = window.App ? window.App.currentLang : 'fr';
    return activeLang === 'en' ? `Group ${cleanGroup}` : `Groupe ${cleanGroup}`;
}

export function renderMatches(matches, containerId = 'calendar-grid') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (matches.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; opacity: 0.6;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.5rem; margin-bottom: 1rem;"></i>
                <p>${t('filters.noMatch', 'Aucun match trouvé pour ces critères.')}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = matches.map(match => {
        const isLive = match.status === 'LIVE';
        const isFinished = match.status === 'FINISHED';
        
        let statusBadge = '';
        if (isLive) {
            statusBadge = `<span class="live-badge" style="padding: 0.2rem 0.6rem; font-size: 0.7rem;"><span class="live-pulse"></span> ${t('modal.live', 'Direct')} ${match.time}</span>`;
        } else if (isFinished) {
            statusBadge = `<span style="font-size: 0.8rem; opacity: 0.6; font-weight: bold;">${t('modal.finished', 'Terminé')}</span>`;
        } else {
            statusBadge = `<span style="font-size: 0.8rem; opacity: 0.8; font-weight: bold; color: var(--or-premium);"><i class="fa-regular fa-clock"></i> ${match.time}</span>`;
        }

        // Traduction dynamique de la date (ex: "11 Juin 2026" en français, ou "June 11, 2026" en anglais)
        let displayDate = match.date;
        if (window.App && window.App.currentLang === 'en') {
            // Mapping de secours pour les mois si nécessaire
            displayDate = displayDate
                .replace("Juin", "June")
                .replace("juin", "June");
        }

        return `
            <div class="premium-card match-card" id="match-${match.id}" style="display: flex; flex-direction: column; justify-content: space-between; min-height: 200px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; font-size: 0.8rem; opacity: 0.7;">
                    <span>${displayDate}</span>
                    <span>${translateGroupDisplay(match.group)}</span>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; gap: 10px;">
                    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; text-align: center;">
                        <span style="font-size: 2rem; margin-bottom: 0.3rem;">${getFlag(match.homeTla)}</span>
                        <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-main);">${translateTeam(match.homeTla, match.homeTeam)}</span>
                    </div>
                    
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span class="font-sport" id="score-home-${match.id}" style="font-size: 2rem; font-weight: 900; min-width: 25px; text-align: center;">${match.homeScore}</span>
                        <span style="opacity: 0.5; font-size: 1.2rem;">-</span>
                        <span class="font-sport" id="score-away-${match.id}" style="font-size: 2rem; font-weight: 900; min-width: 25px; text-align: center;">${match.awayScore}</span>
                    </div>
                    
                    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; text-align: center;">
                        <span style="font-size: 2rem; margin-bottom: 0.3rem;">${getFlag(match.awayTla)}</span>
                        <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-main);">${translateTeam(match.awayTla, match.awayTeam)}</span>
                    </div>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 0.8rem; margin-top: auto;">
                    <span style="font-size: 0.8rem; opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60%;"><i class="fa-solid fa-location-dot" style="margin-right: 5px;"></i>${match.stadium}</span>
                    <span id="status-${match.id}">${statusBadge}</span>
                </div>
            </div>
        `;
    }).join('');
}

export function renderLiveMatches(matches) {
    const liveMatches = matches.filter(m => m.status === 'LIVE');
    renderMatches(liveMatches, 'live-matches-grid');
    
    // Si aucun match n'est en direct, afficher un message d'attente premium
    const liveContainer = document.getElementById('live-matches-grid');
    if (liveContainer && liveMatches.length === 0) {
        liveContainer.innerHTML = `
            <div class="premium-card" style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem;">
                <div class="live-pulse" style="width: 15px; height: 15px; background: var(--or-premium); margin: 0 auto 1.5rem auto;"></div>
                <h3 class="font-sport" style="color: var(--or-premium); margin-bottom: 1rem;">${t('sections.noLiveMatches', 'Aucun match en direct en ce moment')}</h3>
                <p style="font-size: 0.95rem; opacity: 0.7; max-width: 500px; margin: 0 auto;">${t('sections.noLiveMatchesDesc', 'Les scores et statistiques tactiques s\'actualiseront automatiquement en temps réel dès le coup d\'envoi de la prochaine rencontre.')}</p>
            </div>
        `;
    }
}

export function renderTeams(matches) {
    const container = document.getElementById('teams-grid');
    if (!container) return;

    // Extraire les équipes uniques de la liste des matchs
    const teamsMap = new Map();
    matches.forEach(m => {
        if (!teamsMap.has(m.homeTeam)) teamsMap.set(m.homeTeam, { name: m.homeTeam, flag: m.homeFlag, group: m.group, tla: m.homeTla });
        if (!teamsMap.has(m.awayTeam)) teamsMap.set(m.awayTeam, { name: m.awayTeam, flag: m.awayFlag, group: m.group, tla: m.awayTla });
    });

    const teams = Array.from(teamsMap.values()).sort((a, b) => translateTeam(a.tla, a.name).localeCompare(translateTeam(b.tla, b.name)));

    container.innerHTML = teams.map(team => `
        <div class="premium-card" style="padding: 1.5rem; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 140px;">
            <span style="font-size: 3rem; margin-bottom: 0.5rem; display: block; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.15));">${getFlag(team.tla)}</span>
            <h4 class="font-sport" style="font-size: 1rem; color: var(--text-main); font-weight: 700; margin-bottom: 0.2rem;">${translateTeam(team.tla, team.name)}</h4>
            <p style="font-size: 0.75rem; opacity: 0.6; text-transform: uppercase; letter-spacing: 1px;">${translateGroupDisplay(team.group)}</p>
        </div>
    `).join('');
}

export function renderMoroccoSquad(squad) {
    const container = document.getElementById('maroc-squad');
    if (!container) return;

    // Regrouper par position
    const positions = ['Gardiens', 'Défenseurs', 'Milieux', 'Attaquants'];
    const activeLang = window.App ? window.App.currentLang : 'fr';
    
    // Traduction simple des positions de secours
    const posTranslations = activeLang === 'en' ? {
        'Gardiens': 'Goalkeepers',
        'Défenseurs': 'Defenders',
        'Milieux': 'Midfielders',
        'Attaquants': 'Forwards'
    } : {
        'Gardiens': 'Gardiens',
        'Défenseurs': 'Défenseurs',
        'Milieux': 'Milieux',
        'Attaquants': 'Attaquants'
    };

    container.innerHTML = positions.map(pos => {
        const players = squad.filter(p => p.pos === pos);
        return `
            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: var(--vert-maroc); font-size: 0.85rem; font-weight: 700; text-transform: uppercase; border-bottom: 1px solid rgba(0,98,51,0.2); padding-bottom: 4px; margin-bottom: 0.8rem; letter-spacing: 1px;">
                    ${posTranslations[pos] || pos}
                </h4>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${players.map(p => `
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; padding: 8px 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px; transition: var(--transition-smooth);">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="font-weight: 900; color: var(--or-premium); font-size: 0.95rem; width: 20px;">${p.num}</span>
                                <span style="font-weight: 500; color: var(--text-main);">${p.name}</span>
                            </div>
                            <span style="opacity: 0.6; font-size: 0.75rem; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">${p.club}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

export function renderStandings(standings) {
    // 1. Groupes
    const groupsContainer = document.getElementById('groups-container');
    if (groupsContainer) {
        groupsContainer.innerHTML = Object.entries(standings.groups).map(([groupName, rows]) => `
            <div style="margin-bottom: 1rem;">
                <h4 style="color: var(--or-premium); border-bottom: 1px solid rgba(255,215,0,0.15); padding-bottom: 4px; margin-bottom: 0.8rem; font-size: 0.9rem; font-weight: 600;">${translateGroupDisplay(groupName)}</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border-color); opacity: 0.7; font-size: 0.75rem; text-transform: uppercase;">
                            <th style="padding: 6px 4px; width: 25px;">${t('standingsTable.pos', 'Pos')}</th>
                            <th style="padding: 6px 4px;">${t('standingsTable.team', 'Équipe')}</th>
                            <th style="padding: 6px 4px; text-align: center; width: 30px;">${t('standingsTable.played', 'MJ')}</th>
                            <th style="padding: 6px 4px; text-align: center; width: 30px;">${t('standingsTable.pts', 'Pts')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(r => `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.02); background: ${r.tla === 'MAR' ? 'rgba(0, 98, 51, 0.05)' : 'transparent'};">
                                <td style="padding: 8px 4px; font-weight: bold; color: ${r.rank <= 2 ? 'var(--or-premium)' : 'inherit'};">${r.rank}</td>
                                <td style="padding: 8px 4px; display: flex; align-items: center; gap: 8px;">
                                    <span style="font-size: 1.1rem;">${getFlag(r.tla)}</span>
                                    <span style="font-weight: ${r.tla === 'MAR' ? '700' : '400'}; color: var(--text-main);">${translateTeam(r.tla, r.tla)}</span>
                                </td>
                                <td style="padding: 8px 4px; text-align: center; opacity: 0.8;">${r.p}</td>
                                <td style="padding: 8px 4px; text-align: center; font-weight: bold; color: var(--text-main);">${r.pts}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `).join('');
    }

    // 2. Buteurs
    const scorersContainer = document.getElementById('top-scorers');
    if (scorersContainer) {
        scorersContainer.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
                <tbody>
                    ${standings.scorers.map(s => {
                        const tla = s.team === 'Brésil' ? 'BRA' : s.team === 'Maroc' ? 'MAR' : s.team === 'Mexique' ? 'MEX' : s.team === 'États-Unis' ? 'USA' : '';
                        return `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                                <td style="padding: 8px 4px; font-weight: bold; color: var(--or-premium); width: 25px;">${s.rank}</td>
                                <td style="padding: 8px 4px;">
                                    <div style="font-weight: 600; color: var(--text-main);">${s.player}</div>
                                    <div style="font-size: 0.75rem; opacity: 0.6; display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                                        <span>${getFlag(tla)}</span> <span>${translateTeam(tla, s.team)}</span>
                                    </div>
                                </td>
                                <td style="padding: 8px 4px; text-align: right; font-weight: bold; color: var(--text-main); font-size: 0.95rem;">${s.goals} ${t('standingsTable.goals', 'Buts')}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    // 3. Passeurs
    const assistsContainer = document.getElementById('top-assists');
    if (assistsContainer) {
        assistsContainer.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
                <tbody>
                    ${standings.assists.map(s => {
                        const tla = s.team === 'Brésil' ? 'BRA' : s.team === 'Maroc' ? 'MAR' : s.team === 'Mexique' ? 'MEX' : s.team === 'États-Unis' ? 'USA' : '';
                        return `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                                <td style="padding: 8px 4px; font-weight: bold; color: var(--or-premium); width: 25px;">${s.rank}</td>
                                <td style="padding: 8px 4px;">
                                    <div style="font-weight: 600; color: var(--text-main);">${s.player}</div>
                                    <div style="font-size: 0.75rem; opacity: 0.6; display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                                        <span>${getFlag(tla)}</span> <span>${translateTeam(tla, s.team)}</span>
                                    </div>
                                </td>
                                <td style="padding: 8px 4px; text-align: right; font-weight: bold; color: var(--text-main); font-size: 0.95rem;">${s.assists} ${t('standingsTable.assistsAbbr', 'Ass.')}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }
}

export function renderNews(news) {
    const container = document.getElementById('news-grid');
    if (!container) return;

    const activeLang = window.App ? window.App.currentLang : 'fr';

    container.innerHTML = news.map(item => {
        // Simple traduction à la volée des titres d'actualités si l'anglais est actif
        let displayTitle = item.title;
        let displaySummary = item.summary;
        let displayDate = item.date;

        if (activeLang === 'en') {
            displayDate = displayDate.replace("Juin", "June");
            if (item.id === 1) {
                displayTitle = "Opening Match Mexico vs South Africa Tomorrow at 20:00 (Moroccan Time)";
                displaySummary = "The kickoff of the FIFA World Cup 2026 will be given in the historic temple of Mexican football, the Azteca.";
            } else if (item.id === 2) {
                displayTitle = "Morocco Faces Brazilian Giants at New York New Jersey Stadium on June 13";
                displaySummary = "Scheduled at 23:00 Moroccan time, Walid Regragui prepares an ultra-compact tactical plan to confront the Seleção.";
            } else if (item.id === 3) {
                displayTitle = "Atlas Lions Train in New York in Front of Thousands of Fans";
                displaySummary = "A warm atmosphere and unwavering support from the Moroccan community in America.";
            }
        }

        return `
            <div class="premium-card news-card" style="padding: 0; overflow: hidden; display: flex; flex-direction: column; min-height: 380px;">
                <div style="height: 180px; overflow: hidden; position: relative;">
                    <img src="${item.image}" alt="${displayTitle}" style="width: 100%; height: 100%; object-fit: cover; transition: var(--transition-smooth);" class="news-img">
                    <span style="position: absolute; bottom: 10px; right: 10px; background: rgba(11, 11, 11, 0.85); backdrop-filter: blur(5px); border: 1px solid var(--border-color); font-size: 0.75rem; padding: 4px 10px; border-radius: 20px; font-weight: 500; color: #FFFFFF;">${displayDate}</span>
                </div>
                <div style="padding: 1.5rem; display: flex; flex-direction: column; flex: 1;">
                    <h4 style="margin-bottom: 0.8rem; font-size: 1.1rem; line-height: 1.4; color: var(--text-main); font-weight: 700;">${displayTitle}</h4>
                    <p style="font-size: 0.85rem; opacity: 0.75; line-height: 1.6; margin-bottom: 1.5rem; flex-grow: 1;">${displaySummary}</p>
                    <a href="#" style="color: var(--or-premium); text-decoration: none; font-size: 0.85rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; transition: var(--transition-smooth);" class="news-link">
                        ${t('news.readAnalysis', 'Lire l\'analyse tactique')} <i class="fa-solid fa-arrow-right-long"></i>
                    </a>
                </div>
            </div>
        `;
    }).join('');
}
