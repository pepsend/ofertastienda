document.addEventListener('DOMContentLoaded', async () => {
    console.log("PÁGINA CARGADA. Iniciando script v33 (Adaptado a 7 Columnas)...");

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

    let dataCache = JSON.parse(localStorage.getItem('gameDataCache_v33')) || {};

    // ============================================================================
    //  FUNCIÓN PRINCIPAL
    // ============================================================================
    async function main() {
        const initialGames = await loadCsv(csvFilePath);
        if (!initialGames) { loadingMessage.innerHTML = `<p style="color:red;">Error fatal al cargar el archivo CSV.</p>`; return; }

        const allGames = await enrichAllGames(initialGames);
        
        loadingMessage.style.display = 'none';
        renderAllGames(allGames);

        localStorage.setItem('gameDataCache_v33', JSON.stringify(dataCache));
        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase().trim();
            const filteredGames = allGames.filter(g => g.Nombre && g.Nombre.toLowerCase().includes(searchTerm));
            renderAllGames(filteredGames);
        });
    }

    // ============================================================================
    //  FUNCIONES AUXILIARES
    // ============================================================================

    function loadCsv(filePath) {
        console.log("1. Cargando CSV...");
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

    async function enrichAllGames(games) {
        console.log("2. Enriqueciendo datos...");
        let enrichedData = [];
        for (let i = 0; i < games.length; i += BATCH_SIZE) {
            const batch = games.slice(i, i + BATCH_SIZE);
            loadingMessage.innerHTML = `<p>Buscando información: ${Math.min(i + BATCH_SIZE, games.length)} de ${games.length}...</p>`;
            
            const promises = batch.map(async (game) => {
                const details = await getGameDetails(game);
                return { ...game, ...details };
            });
            
            const results = await Promise.all(promises);
            enrichedData.push(...results);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.log("-> Enriquecimiento completado.");
        return enrichedData;
    }

    function renderAllGames(games) {
        console.log(`3. Renderizando ${games.length} juegos.`);
        gameGrid.innerHTML = '';
        noResultsMessage.style.display = (games.length === 0 && searchInput.value) ? 'block' : 'none';
        
        const cardsHTML = games.map(game => {
            if (!game || !game.Nombre) return '';
            
            const cardClasses = ['game-card'];
            if (game.Oferta && game.Oferta.includes('🔥')) cardClasses.push('oferta-destacada');
            
            const imagenHTML = game.imageUrl 
                ? `<img src="${game.imageUrl}" alt="Portada de ${game.Nombre}" class="game-cover" loading="lazy">` 
                : '<div class="game-cover-placeholder"><span class="placeholder-text">Portada no disponible</span></div>';
            
            // AHORA USAMOS LA COLUMNA PLATAFORMA EN EL RENDERIZADO
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

    async function getGameDetails(game) {
        const originalName = game.Nombre;
        if (!originalName) return { imageUrl: null, genres: null };
        
        if (game.PortadaURL && game.PortadaURL.trim().startsWith('http')) {
            return { imageUrl: game.PortadaURL, genres: game.Género };
        }
        
        const cacheKey = normalizeName(originalName);
        if (dataCache[cacheKey]) return dataCache[cacheKey];

        // Prioridad IGDB
        let apiData = await searchApi('igdb', originalName);
        
        // Respaldo RAWG
        if (!apiData) {
            apiData = await searchApi('rawg', originalName);
        }
        
        const finalData = apiData || { imageUrl: null, genres: null };
        dataCache[cacheKey] = finalData;
        return finalData;
    }

    async function searchApi(api, originalName) {
        const searchTerms = [
            originalName,
            originalName.split(/ \+| -|:| – /)[0].trim(),
            normalizeName(originalName, true)
        ].filter((v, i, a) => v && a.indexOf(v) === i && v.length > 2);

        for (const term of searchTerms) {
            const result = api === 'igdb' ? await fetchFromIgdbApi(term) : await fetchFromRawgApi(term);
            if (result) {
                const similarity = getSimilarity(normalizeName(originalName, true), normalizeName(result.name, true));
                if (similarity >= 0.80) {
                    console.log(`[${api.toUpperCase()}] ✅ ACEPTADO para "${term}" vs "${result.name}"`);
                    return result.data;
                }
            }
        }
        return null;
    }
    
    // ... (El resto de funciones como fetchFromIgdbApi, fetchFromRawgApi, getSimilarity, etc., no cambian) ...
    // Pego el código completo para evitar confusiones
    
    function getSimilarity(a, b) { if (a.length === 0) return b.length === 0 ? 1 : 0; if (b.length === 0) return a.length === 0 ? 1 : 0; const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null)); for (let i = 0; i <= a.length; i++) { matrix[0][i] = i; } for (let j = 0; j <= b.length; j++) { matrix[j][0] = j; } for (let j = 1; j <= b.length; j++) { for (let i = 1; i <= a.length; i++) { const cost = a[i - 1] === b[j - 1] ? 0 : 1; matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + cost); } } return 1 - (matrix[b.length][a.length] / Math.max(a.length, b.length)); }
    async function fetchFromRawgApi(searchTerm) { if (!RAWG_API_KEY || RAWG_API_KEY.includes('AQUÍ_VA')) return null; try { const response = await fetch(`https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(searchTerm)}&page_size=1`); if (response.ok) { const data = await response.json(); if (data.results && data.results.length > 0) { const game = data.results[0]; return { name: game.name, data: { imageUrl: game.background_image, genres: game.genres.map(g => g.name).join(', ') } }; } } } catch (error) { /* Ignorar */ } return null; }
    async function fetchFromIgdbApi(searchTerm) { if (!IGDB_CLIENT_ID.includes('AQUÍ_VA')) return null; try { const response = await fetch(`${CORS_PROXY}https://api.igdb.com/v4/games`, { method: 'POST', headers: { 'Accept': 'application/json', 'Client-ID': IGDB_CLIENT_ID, 'Authorization': `Bearer ${IGDB_ACCESS_TOKEN}` }, body: `fields name, cover.url, genres.name; search "${searchTerm.replace(/"/g, '\\"')}"; limit 1;` }); if (response.ok) { const data = await response.json(); if (data && data.length > 0) { const game = data[0]; return { name: game.name, data: { imageUrl: game.cover ? game.cover.url.replace('t_thumb', 't_cover_big') : null, genres: game.genres ? game.genres.map(g => g.name).join(', ') : null } }; } } } catch (error) { /* Ignorar */ } return null; }
    function normalizeName(name, aggressive = false) { if (!name) return ''; let normalized = name.toLowerCase().replace(/\(.*\)|\[.*\]/g, '').replace(/#|®|™|:|'|"|’/g, ''); if (aggressive) { normalized = normalized.replace(/deluxe edition|gold edition|goty|game of the year|ultimate edition|standard edition|remastered|complete edition|definitive edition|bundle|collection/g, ''); } return normalized.trim().replace(/\s+/g, ' '); }
    
    main();
});