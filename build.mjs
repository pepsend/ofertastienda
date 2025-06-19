// build.mjs - v43 (El Catálogo Pre-Construido)
import fs from 'fs';
import Papa from 'papaparse';
import fetch from 'node-fetch';
import pLimit from 'p-limit';

console.log("Iniciando construcción del catálogo...");

// --- CONFIGURACIÓN ---
const CSV_FILE_PATH = './OFERTAS_FINAL.csv';
const OUTPUT_JSON_PATH = './juegos.json';
const CACHE_FILE_PATH = './build_cache.json';

const RAWG_API_KEY = '90e986c719e848fe9bb84eb58e2017ab'; 
const IGDB_CLIENT_ID = '5m5y7vod3ilgxjb5xnsgug8pdps3m9';
const IGDB_ACCESS_TOKEN = 'bpl5dif5pebr1jf4bwc2i2uq5lhssb';
const STEAMGRIDDB_API_KEY = '39eb6f0b2be1dd211c3aba4be117a814';

const CONCURRENCY_LIMIT = 10;

// ============================================================================
//  FUNCIÓN PRINCIPAL
// ============================================================================
async function build() {
    let dataCache = {};
    if (fs.existsSync(CACHE_FILE_PATH)) { dataCache = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf8')); }
    
    const fileContent = fs.readFileSync(CSV_FILE_PATH, 'utf8');
    const csvData = Papa.parse(fileContent, { header: true, skipEmptyLines: true }).data;

    const limit = pLimit(CONCURRENCY_LIMIT);
    let processedCount = 0;

    const promises = csvData.map(game => {
        if (!game.Nombre) return null;
        return limit(async () => {
            const details = await getGameDetails(game, dataCache);
            processedCount++;
            process.stdout.write(`Procesando: ${processedCount}/${csvData.length}\r`);
            return { ...game, ...details };
        });
    });

    const finalGameData = (await Promise.all(promises)).filter(Boolean);

    fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(finalGameData, null, 2));
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(dataCache, null, 2));
    console.log(`\n\n¡Éxito! Archivo 'juegos.json' creado.`);
}

// ============================================================================
//  FUNCIONES AUXILIARES
// ============================================================================

async function getGameDetails(game, dataCache) {
    const originalName = game.Nombre;
    if (!originalName) return { imageUrl: null, genres: null };
    if (game.PortadaURL && game.PortadaURL.trim().startsWith('http')) {
        const manualData = { imageUrl: game.PortadaURL, genres: game.Género };
        dataCache[originalName.toLowerCase()] = manualData;
        return manualData;
    }
    const cacheKey = originalName.toLowerCase();
    if (dataCache[cacheKey]) return dataCache[cacheKey];
    
    let apiData = await searchApi('igdb', originalName);
    if (!apiData) apiData = await searchApi('steamgriddb', originalName);
    if (!apiData) apiData = await searchApi('rawg', originalName);
    
    const finalData = apiData || { imageUrl: null, genres: null };
    dataCache[cacheKey] = finalData;
    return finalData;
}

// ... (El resto de funciones auxiliares son las mismas del script anterior)
async function searchApi(api, originalName) { const searchTerms = [originalName, originalName.split(/ \+| -|:| – /)[0].trim()].filter(Boolean); for (const term of searchTerms) { let result; switch(api) { case 'igdb': result = await fetchFromIgdbApi(term); break; case 'steamgriddb': result = await fetchFromSteamGridDBApi(term); break; case 'rawg': result = await fetchFromRawgApi(term); break; } if (result) { const apiNameClean = result.name.toLowerCase(); const searchTermClean = term.toLowerCase(); if (apiNameClean.startsWith(searchTermClean)) { console.log(`[${api.toUpperCase()}] ✅ ACEPTADO para "${term}": "${result.name}"`); return result.data; } else { console.log(`[${api.toUpperCase()}] ❌ RECHAZADO para "${term}": "${result.name}"`); } } } return null; }
async function fetchFromRawgApi(searchTerm) { if (!RAWG_API_KEY || RAWG_API_KEY.includes('AQUÍ_VA')) return null; try { const response = await fetch(`https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(searchTerm)}&page_size=1`); if (response.ok) { const data = await response.json(); if (data.results && data.results.length > 0) { const game = data.results[0]; return { name: game.name, data: { imageUrl: game.background_image, genres: game.genres ? game.genres.map(g => g.name).join(', ') : '' } }; } } } catch (error) {} return null; }
async function fetchFromIgdbApi(searchTerm) { if (!IGDB_CLIENT_ID || IGDB_CLIENT_ID.includes('AQUÍ_VA')) return null; try { const response = await fetch(`https://api.igdb.com/v4/games`, { method: 'POST', headers: { 'Accept': 'application/json', 'Client-ID': IGDB_CLIENT_ID, 'Authorization': `Bearer ${IGDB_ACCESS_TOKEN}` }, body: `fields name, cover.url, genres.name; search "${searchTerm.replace(/"/g, '\\"')}"; limit 1;` }); if (response.ok) { const data = await response.json(); if (data && data.length > 0) { const game = data[0]; const imageUrl = game.cover ? game.cover.url.replace('t_thumb', 't_cover_big') : null; const genres = game.genres ? game.genres.map(g => g.name).join(', ') : null; return { name: game.name, data: { imageUrl, genres } }; } } } catch (error) {} return null; }
async function fetchFromSteamGridDBApi(searchTerm) { if (!STEAMGRIDDB_API_KEY || STEAMGRIDDB_API_KEY.includes('AQUÍ_VA')) return null; try { const searchResponse = await fetch(`https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(searchTerm)}`, { headers: { 'Authorization': `Bearer ${STEAMGRIDDB_API_KEY}` } }); if (searchResponse.ok) { const searchData = await searchResponse.json(); if (searchData.success && searchData.data.length > 0) { const gameId = searchData.data[0].id; const gridResponse = await fetch(`https://www.steamgriddb.com/api/v2/grids/game/${gameId}?styles=official,white_logo&dimensions=600x900`, { headers: { 'Authorization': `Bearer ${STEAMGRIDDB_API_KEY}` } }); if (gridResponse.ok) { const gridData = await gridResponse.json(); if (gridData.success && gridData.data.length > 0) { return { name: searchData.data[0].name, data: { imageUrl: gridData.data[0].url, genres: null } }; } } } } } catch (error) {} return null; }

build();