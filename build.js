// build.mjs - v42 (El Triunvirato de APIs)
import fs from 'fs';
import Papa from 'papaparse';
import fetch from 'node-fetch';

console.log("Iniciando proceso de construcción (v42)...");

// --- CONFIGURACIÓN ---
const CSV_FILE_PATH = 'OFERTAS_FINAL.csv';
const OUTPUT_JSON_PATH = './juegos.json';
const CACHE_FILE_PATH = './build_cache.json';

// --- CLAVES DE API (¡Pega las 3 nuevas y correctas aquí!) ---
const RAWG_API_KEY = '90e986c719e848fe9bb84eb58e2017ab';
const IGDB_CLIENT_ID = '5m5y7vod3ilgxjb5xnsgug8pdps3m9';
const IGDB_ACCESS_TOKEN = 'bpl5dif5pebr1jf4bwc2i2uq5lhssb';
const STEAMGRIDDB_API_KEY = '39eb6f0b2be1dd211c3aba4be117a814';

const SIMILARITY_THRESHOLD = 0.85;

// ============================================================================
//  FUNCIÓN PRINCIPAL
// ============================================================================
async function build() {
    let dataCache = {};
    if (fs.existsSync(CACHE_FILE_PATH)) { dataCache = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf8')); }
    
    const fileContent = fs.readFileSync(CSV_FILE_PATH, 'utf8');
    const csvData = Papa.parse(fileContent, { header: true, skipEmptyLines: true }).data;

    const finalGameData = [];
    for (let i = 0; i < csvData.length; i++) {
        const game = csvData[i];
        if (!game.Nombre) continue;

        console.log(`Procesando ${i + 1}/${csvData.length}: ${game.Nombre}`);
        const details = await getGameDetails(game, dataCache);
        
        finalGameData.push({
            nombre: game.Nombre,
            precio: game.Precio,
            edicion: game.Edición,
            plataforma: game.Plataforma,
            oferta: game.Oferta,
            imageUrl: details.imageUrl,
            genres: details.genres
        });
    }

    fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(finalGameData, null, 2));
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(dataCache, null, 2));
    console.log(`\n¡Éxito! Proceso completado.`);
}

// ============================================================================
//  LÓGICA DE BÚSQUEDA Y VERIFICACIÓN
// ============================================================================

async function getGameDetails(game, dataCache) {
    const originalName = game.Nombre;
    if (!originalName) return { imageUrl: null, genres: null };
    if (game.PortadaURL && game.PortadaURL.trim().startsWith('http')) return { imageUrl: game.PortadaURL, genres: game.Género };
    
    const cacheKey = originalName.toLowerCase();
    if (dataCache[cacheKey]) return dataCache[cacheKey];

    // --- CASCADA DE APIS ---
    let apiData = await searchApi('igdb', originalName);
    if (!apiData) {
        console.log(`IGDB falló para "${originalName}". Probando con SteamGridDB...`);
        apiData = await searchApi('steamgriddb', originalName);
    }
    if (!apiData) {
        console.log(`SteamGridDB falló para "${originalName}". Probando con RAWG...`);
        apiData = await searchApi('rawg', originalName);
    }
    
    const finalData = apiData || { imageUrl: null, genres: null };
    dataCache[cacheKey] = finalData;
    return finalData;
}

async function searchApi(api, originalName) {
    const searchTerms = [ originalName, originalName.split(/ \+| -|:| – /)[0].trim() ]
        .filter((v, i, a) => v && a.indexOf(v) === i && v.length > 2);

    for (const term of searchTerms) {
        let result;
        switch (api) {
            case 'igdb': result = await fetchFromIgdbApi(term); break;
            case 'steamgriddb': result = await fetchFromSteamGridDBApi(term); break;
            case 'rawg': result = await fetchFromRawgApi(term); break;
        }

        if (result) {
            const apiNameClean = normalizeName(result.name);
            const searchTermClean = normalizeName(term);
            if (apiNameClean.includes(searchTermClean)) {
                console.log(`[${api.toUpperCase()}] ✅ ACEPTADO para "${term}": "${result.name}"`);
                return result.data;
            } else {
                console.log(`[${api.toUpperCase()}] ❌ RECHAZADO para "${term}": "${result.name}"`);
            }
        }
    }
    return null;
}

async function fetchFromRawgApi(searchTerm) { /* ...código sin cambios... */
    if (!RAWG_API_KEY || RAWG_API_KEY.includes('AQUÍ_VA')) return null;
    try {
        const response = await fetch(`https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(searchTerm)}&page_size=1`);
        if (response.ok) {
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                const game = data.results[0];
                return { name: game.name, data: { imageUrl: game.background_image, genres: game.genres ? game.genres.map(g => g.name).join(', ') : '' } };
            }
        }
    } catch (error) {}
    return null;
}

async function fetchFromIgdbApi(searchTerm) { /* ...código sin cambios... */
    if (!IGDB_CLIENT_ID || IGDB_CLIENT_ID.includes('AQUÍ_VA')) return null;
    try {
        const response = await fetch(`https://api.igdb.com/v4/games`, {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Client-ID': IGDB_CLIENT_ID, 'Authorization': `Bearer ${IGDB_ACCESS_TOKEN}` },
            body: `fields name, cover.url, genres.name; search "${searchTerm.replace(/"/g, '\\"')}"; limit 1;`
        });
        if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
                const game = data[0];
                const imageUrl = game.cover ? game.cover.url.replace('t_thumb', 't_cover_big') : null;
                const genres = game.genres ? game.genres.map(g => g.name).join(', ') : null;
                return { name: game.name, data: { imageUrl, genres } };
            }
        }
    } catch (error) {}
    return null;
}

// --- NUEVA FUNCIÓN PARA STEAMGRIDDB ---
async function fetchFromSteamGridDBApi(searchTerm) {
    if (!STEAMGRIDDB_API_KEY || STEAMGRIDDB_API_KEY.includes('AQUÍ_VA')) return null;
    try {
        const response = await fetch(`https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(searchTerm)}`, {
            headers: { 'Authorization': `Bearer ${STEAMGRIDDB_API_KEY}` }
        });
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data.length > 0) {
                const gameId = data.data[0].id; // Tomamos el ID del primer resultado
                // Ahora pedimos las imágenes para ese ID
                const gridsResponse = await fetch(`https://www.steamgriddb.com/api/v2/grids/game/${gameId}?styles=official,white_logo&dimensions=600x900`, {
                     headers: { 'Authorization': `Bearer ${STEAMGRIDDB_API_KEY}` }
                });
                if(gridsResponse.ok){
                    const gridsData = await gridsResponse.json();
                    if(gridsData.success && gridsData.data.length > 0){
                        // Devolvemos el nombre del juego original y la URL de la primera imagen encontrada
                        return { name: data.data[0].name, data: { imageUrl: gridsData.data[0].url, genres: null } };
                    }
                }
            }
        }
    } catch (error) {}
    return null;
}


function normalizeName(name) {
    if (!name) return '';
    return name.toLowerCase()
        .replace(/\(.*\)|\[.*\]/g, '')
        .replace(/#|®|™|:|'|"|’/g, '')
        .replace(/deluxe edition|gold edition|goty|game of the year|ultimate edition|standard edition|remastered|complete edition|definitive edition|bundle|collection/g, '')
        .trim().replace(/\s+/g, ' ');
}

build();