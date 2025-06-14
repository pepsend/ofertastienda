document.addEventListener('DOMContentLoaded', async () => {
    console.log("PÁGINA CARGADA. Iniciando script v34 (Caché Inteligente)...");

    const gameGrid = document.getElementById('game-grid');
    const searchInput = document.getElementById('searchInput');
    const loadingMessage = document.getElementById('loadingMessage');
    const noResultsMessage = document.getElementById('noResultsMessage');
    
    const csvFilePath = 'OFERTAS_FINAL.csv';
    const RAWG_API_KEY = '694d2b80f36148b0a8c04bd0a6f28c33'; 
    const IGDB_CLIENT_ID = '5m5y7vod3ilgxjb5xnsgug8pdps3m9';
    const IGDB_ACCESS_TOKEN = 'yij22l487u2wsx0em66xjdfa89r1fu';
    const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';
    const BATCH_SIZE = 20;

    // --- EL CACHÉ AHORA TIENE VERSIÓN ---
    const CACHE_VERSION = 'v34';
    const CACHE_KEY = `gameDataCache_${CACHE_VERSION}`;
    let dataCache = JSON.parse(localStorage.getItem(CACHE_KEY)) || {};

    // ============================================================================
    //  FUNCIÓN PRINCIPAL
    // ============================================================================
    async function main() {
        const initialGames = await loadCsv(csvFilePath);
        if (!initialGames) { loadingMessage.innerHTML = `<p style="color:red;">Error fatal al cargar CSV.</p>`; return; }

        const allGames = await enrichAllGames(initialGames);
        
        loadingMessage.style.display = 'none';
        renderAllGames(allGames);

        // Guardamos el caché actualizado
        localStorage.setItem(CACHE_KEY, JSON.stringify(dataCache));
        
        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase().trim();
            const filteredGames = allGames.filter(g => g.Nombre && g.Nombre.toLowerCase().includes(searchTerm));
            renderAllGames(filteredGames);
        });
    }

    // ============================================================================
    //  LÓGICA DE DATOS CON PRIORIDAD MANUAL
    // ============================================================================

    async function getGameDetails(game) {
        const originalName = game.Nombre;
        if (!originalName) return { imageUrl: null, genres: null };

        // CAPA 1: OVERRIDE MANUAL - Si hay URL en el CSV, es ley.
        if (game.PortadaURL && game.PortadaURL.trim().startsWith('http')) {
            console.log(`[MANUAL] Usando URL del CSV para: ${originalName}`);
            // Guardamos este resultado manual en el caché para futuras cargas
            const manualData = { imageUrl: game.PortadaURL, genres: game.Género };
            dataCache[originalName] = manualData;
            return manualData;
        }
        
        // CAPA 2: CACHÉ - Si ya lo hemos buscado, usamos el resultado guardado.
        if (dataCache[originalName]) {
            // console.log(`[CACHE] Usando caché para: ${originalName}`);
            return dataCache[originalName];
        }

        // CAPA 3: BÚSQUEDA EN APIs (si las capas 1 y 2 fallan)
        console.log(`[API] Iniciando búsqueda para: ${originalName}`);
        let apiData = await searchApi('igdb', originalName);
        if (!apiData) {
            apiData = await searchApi('rawg', originalName);
        }
        
        const finalData = apiData || { imageUrl: null, genres: null };
        dataCache[originalName] = finalData; // Guardamos el resultado (o el fallo) en el caché
        return finalData;
    }
    
    // ... (El resto del código: main, loadCsv, enrichAllGames, renderAllGames, etc. no necesita cambios drásticos) ...
    // Pego el código completo para que no haya dudas.

    function loadCsv(filePath) { /* ...código sin cambios... */
        return new Promise(resolve => {
            const games = [];
            Papa.parse(filePath, {
                download: true, header: true, skipEmptyLines: true,
                step: (result) => { if (result.data && result.data.Nombre) games.push(result.data); },
                complete: () => { console.log(`-> CSV cargado. ${games.length} filas encontradas.`); resolve(games); },
                error: (err) => { console.error("Error PapaParse:", err); resolve(null); }
            });
        });
    }

    async function enrichAllGames(games) { /* ...código sin cambios... */
        let enrichedData = [];
        for (let i = 0; i < games.length; i += BATCH_SIZE) {
            const batch = games.slice(i, i + BATCH_SIZE);
            loadingMessage.innerHTML = `<p>Buscando información: ${Math.min(i + BATCH_SIZE, games.length)} de ${games.length}...</p>`;
            const promises = batch.map(async (game) => { const details = await getGameDetails(game); return { ...game, ...details }; });
            const results = await Promise.all(promises);
            enrichedData.push(...results);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return enrichedData;
    }

    function renderAllGames(games) { /* ...código sin cambios... */
        gameGrid.innerHTML = '';
        noResultsMessage.style.display = (games.length === 0 && searchInput.value) ? 'block' : 'none';
        const cardsHTML = games.map(game => {
            if (!game || !game.Nombre) return '';
            const cardClasses = ['game-card'];
            if (game.Oferta && game.Oferta.includes('🔥')) cardClasses.push('oferta-destacada');
            const imagenHTML = game.imageUrl ? `<img src="${game.imageUrl}" alt="Portada de ${game.Nombre}" class="game-cover" loading="lazy">` : '<div class="game-cover-placeholder"><span class="placeholder-text">Portada no disponible</span></div>';
            return `
                <div class="${cardClasses.join(' ')}">
                    ${imagenHTML}
                    <div class="card-content">
                        <h3>${game.Nombre}</h3>
                        <p class="game-price">${game.Precio || 'N/D'}</p>
                        <div class="game-details">
                            <p><span class="label">Edición:</span> <span>${game.Edición || 'Standard'}</span></p>
                            <p><span class="label">Plataforma:</span> <span>${game.Plataforma || 'No especificada'}</span></p>
                            <p><span class="label">Género:</span> <span>${game.genres || game.Género || 'No especificado'}</span></p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        gameGrid.innerHTML = cardsHTML;
    }

    async function searchApi(api, originalName) { /* ...código sin cambios... */
        const searchTerms = [ originalName, originalName.split(/ \+| -|:| – /)[0].trim(), normalizeName(originalName, true) ].filter((v, i, a) => v && a.indexOf(v) === i && v.length > 2);
        for (const term of searchTerms) {
            const result = api === 'igdb' ? await fetchFromIgdbApi(term) : await fetchFromRawgApi(term);
            if (result) {
                const similarity = getSimilarity(normalizeName(originalName, true), normalizeName(result.name, true));
                if (similarity >= 0.80) { return result.data; }
            }
        }
        return null;
    }

    function getSimilarity(a, b) { /* ...código sin cambios... */ if (a.length === 0) return b.length === 0 ? 1 : 0; if (b.length === 0) return a.length === 0 ? 1 : 0; const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null)); for (let i = 0; i <= a.length; i++) { matrix[0][i] = i; } for (let j = 0; j <= b.length; j++) { matrix[j][0] = j; } for (let j = 1; j <= b.length; j++) { for (let i = 1; i <= a.length; i++) { const cost = a[i - 1] === b[j - 1] ? 0 : 1; matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + cost); } } return 1 - (matrix[b.length][a.length] / Math.max(a.length, b.length)); }
    async function fetchFromRawgApi(searchTerm) { /* ...código sin cambios... */ if (!RAWG_API_KEY || RAWG_API_KEY.includes('AQUÍ_VA')) return null; try { const response = await fetch(`https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(searchTerm)}&page_size=1`); if (response.ok) { const data = await response.json(); if (data.results && data.results.length > 0) { const game = data.results[0]; return { name: game.name, data: { imageUrl: game.background_image, genres: game.genres.map(g => g.name).join(', ') } }; } } } catch (error) { } return null; }
    async function fetchFromIgdbApi(searchTerm) { /* ...código sin cambios... */ if (!IGDB_CLIENT_ID.includes('AQUÍ_VA')) return null; try { const response = await fetch(`${CORS_PROXY}https://api.igdb.com/v4/games`, { method: 'POST', headers: { 'Accept': 'application/json', 'Client-ID': IGDB_CLIENT_ID, 'Authorization': `Bearer ${IGDB_ACCESS_TOKEN}` }, body: `fields name, cover.url, genres.name; search "${searchTerm.replace(/"/g, '\\"')}"; limit 1;` }); if (response.ok) { const data = await response.json(); if (data && data.length > 0) { const game = data[0]; return { name: game.name, data: { imageUrl: game.cover ? game.cover.url.replace('t_thumb', 't_cover_big') : null, genres: game.genres ? game.genres.map(g => g.name).join(', ') : null } }; } } } catch (error) { } return null; }
    function normalizeName(name, aggressive = false) { /* ...código sin cambios... */ if (!name) return ''; let normalized = name.toLowerCase().replace(/\(.*\)|\[.*\]/g, '').replace(/#|®|™|:|'|"|’/g, ''); if (aggressive) { normalized = normalized.replace(/deluxe edition|gold edition|goty|game of the year|ultimate edition|standard edition|remastered|complete edition|definitive edition|bundle|collection/g, ''); } return normalized.trim().replace(/\s+/g, ' '); }
    
    main();
});