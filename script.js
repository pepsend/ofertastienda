// script.js - v42 (El que no se rinde, CON STEAMGRIDDB)
document.addEventListener('DOMContentLoaded', async () => {
    console.log("PÁGINA CARGADA. Iniciando script v42...");

    const gameGrid = document.getElementById('game-grid');
    const searchInput = document.getElementById('searchInput');
    const loadingMessage = document.getElementById('loadingMessage');
    const noResultsMessage = document.getElementById('noResultsMessage');
    
    // Apuntamos al CSV, la única fuente de la verdad
    const csvFilePath = 'OFERTAS_FINAL.csv';
    const RAWG_API_KEY = '90e986c719e848fe9bb84eb58e2017ab'; 
    const IGDB_CLIENT_ID = '5m5y7vod3ilgxjb5xnsgug8pdps3m9';
    const IGDB_ACCESS_TOKEN = 'bpl5dif5pebr1jf4bwc2i2uq5lhssb';
    const STEAMGRIDDB_API_KEY = '39eb6f0b2be1dd211c3aba4be117a814';
    
    let allGames = [];

    try {
        // --- 1. Cargar el CSV ---
        loadingMessage.innerHTML = `<p>Cargando ofertas...</p>`;
        const gamesFromCsv = await new Promise((resolve, reject) => {
            Papa.parse(csvFilePath, {
                download: true,
                header: true,
                skipEmptyLines: true,
                complete: results => resolve(results.data),
                error: err => reject(err)
            });
        });

        if (!gamesFromCsv || gamesFromCsv.length === 0) {
            throw new Error("El archivo CSV está vacío o no se pudo leer.");
        }
        allGames = gamesFromCsv;

        // --- 2. Renderizar INMEDIATAMENTE con los datos del CSV ---
        renderAllGames(allGames, true); // true = modo de carga
        loadingMessage.style.display = 'none';

        // --- 3. Buscar portadas y géneros EN SEGUNDO PLANO ---
        // Usamos Promise.all para ejecutar todas las búsquedas en paralelo
        const enrichedPromises = allGames.map(game => getGameDetails(game));
        const enrichedGames = await Promise.all(enrichedPromises);

        // --- 4. Volver a renderizar TODO con la información completa ---
        allGames = enrichedGames;
        renderAllGames(allGames, false); // false = modo final

        console.log("¡Proceso completado!");
        
        // Activar la búsqueda
        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase().trim();
            const filteredGames = allGames.filter(g => g.Nombre.toLowerCase().includes(searchTerm));
            renderAllGames(filteredGames, false);
        });

    } catch (error) {
        console.error("----------- ERROR FATAL -----------");
        console.error(error);
        loadingMessage.innerHTML = `<p style="color:red;">Error catastrófico: ${error.message}</p>`;
    }

    // ============================================================================
    //  FUNCIONES AUXILIARES
    // ============================================================================
    
    function renderAllGames(games, isLoading) {
        gameGrid.innerHTML = '';
        noResultsMessage.style.display = (games.length === 0 && searchInput.value) ? 'block' : 'none';
        
        const cardsHTML = games.map(game => {
            if (!game || !game.Nombre) return '';
            
            const cardClasses = ['game-card'];
            if (game.Oferta && game.Oferta.includes('🔥')) cardClasses.push('oferta-destacada');
            
            const imagenHTML = isLoading
                ? '<div class="game-cover-placeholder"></div>'
                : game.imageUrl ? `<img src="${game.imageUrl}" alt="Portada de ${game.Nombre}" class="game-cover" loading="lazy">` : '<div class="game-cover-placeholder"><span class="placeholder-text">Portada no disponible</span></div>';
            
            const generoHTML = isLoading
                ? 'Buscando...'
                : game.genres || game.Género || 'No especificado';

            return `
                <div class="${cardClasses.join(' ')}">
                    ${imagenHTML}
                    <div class="card-content">
                        <h3>${game.Nombre}</h3>
                        <p class="game-price">${game.Precio || 'N/D'}</p>
                        <div class="game-details">
                            <p><span class="label">Edición:</span> <span>${game.Edición || 'Standard'}</span></p>
                            <p><span class="label">Plataforma:</span> <span>${game.Plataforma || 'No especificada'}</span></p>
                            <p><span class="label">Género:</span> <span>${generoHTML}</span></p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        gameGrid.innerHTML = cardsHTML;
    }
    
    async function getGameDetails(game) {
        if (game.PortadaURL && game.PortadaURL.trim().startsWith('http')) {
            return { ...game, imageUrl: game.PortadaURL, genres: game.Género };
        }
        
        // --- CASCADA DE APIS ---
        let apiData = await searchApi('igdb', game.Nombre);
        if (!apiData) apiData = await searchApi('steamgriddb', game.Nombre);
        if (!apiData) apiData = await searchApi('rawg', game.Nombre);
        
        // Devolvemos el juego original fusionado con los datos encontrados (o nulos si no se encontró nada)
        return { ...game, ...(apiData || { imageUrl: null, genres: null }) };
    }

    async function searchApi(api, originalName) {
        const searchTerms = [originalName, originalName.split(/ \+| -|:| – /)[0].trim()].filter(Boolean);
        for (const term of searchTerms) {
            let result;
            switch(api) {
                case 'igdb': result = await fetchFromIgdbApi(term); break;
                case 'steamgriddb': result = await fetchFromSteamGridDBApi(term); break;
                case 'rawg': result = await fetchFromRawgApi(term); break;
            }
            
            if (result) {
                const apiNameClean = result.name.toLowerCase();
                const searchTermClean = term.toLowerCase();
                if (apiNameClean.startsWith(searchTermClean)) {
                    console.log(`[${api.toUpperCase()}] ✅ ACEPTADO para "${term}": "${result.name}"`);
                    return result.data;
                } else {
                     console.log(`[${api.toUpperCase()}] ❌ RECHAZADO para "${term}": "${result.name}"`);
                }
            }
        }
        return null;
    }

    // --- FUNCIONES DE FETCH PARA CADA API ---
    async function fetchFromRawgApi(searchTerm) { /* ...código sin cambios... */ if (!RAWG_API_KEY || RAWG_API_KEY.includes('AQUÍ_VA')) return null; try { const response = await fetch(`https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(searchTerm)}&page_size=1`); if (response.ok) { const data = await response.json(); if (data.results && data.results.length > 0) { const game = data.results[0]; return { name: game.name, data: { imageUrl: game.background_image, genres: game.genres ? game.genres.map(g => g.name).join(', ') : '' } }; } } } catch (error) {} return null; }
    async function fetchFromIgdbApi(searchTerm) { const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/'; if (!IGDB_CLIENT_ID || IGDB_CLIENT_ID.includes('AQUÍ_VA')) return null; try { const response = await fetch(`${CORS_PROXY}https://api.igdb.com/v4/games`, { method: 'POST', headers: { 'Accept': 'application/json', 'Client-ID': IGDB_CLIENT_ID, 'Authorization': `Bearer ${IGDB_ACCESS_TOKEN}` }, body: `fields name, cover.url, genres.name; search "${searchTerm.replace(/"/g, '\\"')}"; limit 1;` }); if (response.ok) { const data = await response.json(); if (data && data.length > 0) { const game = data[0]; const imageUrl = game.cover ? game.cover.url.replace('t_thumb', 't_cover_big') : null; const genres = game.genres ? game.genres.map(g => g.name).join(', ') : null; return { name: game.name, data: { imageUrl, genres } }; } } } catch (error) {} return null; }
    async function fetchFromSteamGridDBApi(searchTerm) { const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/'; if (!STEAMGRIDDB_API_KEY || STEAMGRIDDB_API_KEY.includes('AQUÍ_VA')) return null; try { const searchResponse = await fetch(`${CORS_PROXY}https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(searchTerm)}`, { headers: { 'Authorization': `Bearer ${STEAMGRIDDB_API_KEY}` } }); if (searchResponse.ok) { const searchData = await searchResponse.json(); if (searchData.success && searchData.data.length > 0) { const gameId = searchData.data[0].id; const gridResponse = await fetch(`${CORS_PROXY}https://www.steamgriddb.com/api/v2/grids/game/${gameId}?styles=official,white_logo&dimensions=600x900`, { headers: { 'Authorization': `Bearer ${STEAMGRIDDB_API_KEY}` } }); if (gridResponse.ok) { const gridData = await gridResponse.json(); if (gridData.success && gridData.data.length > 0) { return { name: searchData.data[0].name, data: { imageUrl: gridData.data[0].url, genres: null } }; } } } } } catch (error) {} return null; }
});