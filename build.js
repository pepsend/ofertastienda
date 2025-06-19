// build.mjs - v44 (Con Fusión de Caché Inteligente)
import fs from 'fs';
import Papa from 'papaparse';
import fetch from 'node-fetch';

console.log("Iniciando proceso de construcción (v44)...");

// --- CONFIGURACIÓN ---
const CSV_FILE_PATH = './OFERTAS_FINAL.csv';
const OUTPUT_JSON_PATH = './juegos.json';
const CACHE_FILE_PATH = './build_cache.json';

const RAWG_API_KEY = '90e986c719e848fe9bb84eb58e2017ab'; 
const IGDB_CLIENT_ID = '5m5y7vod3ilgxjb5xnsgug8pdps3m9';
const IGDB_ACCESS_TOKEN = 'bpl5dif5pebr1jf4bwc2i2uq5lhssb';
const STEAMGRIDDB_API_KEY = '39eb6f0b2be1dd211c3aba4be117a814';

// ============================================================================
//  FUNCIÓN PRINCIPAL
// ============================================================================
async function build() {
    // 1. Cargar el caché existente en memoria. Si no existe, es un objeto vacío.
    let dataCache = {};
    if (fs.existsSync(CACHE_FILE_PATH)) {
        dataCache = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf8'));
        console.log(`Caché cargado con ${Object.keys(dataCache).length} entradas.`);
    }

    // 2. Leer el CSV
    const fileContent = fs.readFileSync(CSV_FILE_PATH, 'utf8');
    const csvData = Papa.parse(fileContent, { header: true, skipEmptyLines: true }).data;
    console.log(`Leídas ${csvData.length} filas del CSV.`);

    const finalGameData = [];
    let newEntriesCount = 0;

    // 3. Procesar cada juego del CSV
    for (let i = 0; i < csvData.length; i++) {
        const game = csvData[i];
        if (!game.Nombre) continue;

        const cacheKey = game.Nombre.toLowerCase();
        let details;

        // Si el juego YA ESTÁ EN EL CACHÉ, lo usamos y nos saltamos la API.
        if (dataCache[cacheKey]) {
            details = dataCache[cacheKey];
        } else {
            // Si NO está en el caché, es nuevo. Lo buscamos.
            console.log(`[NUEVO] Buscando datos para: ${game.Nombre}`);
            details = await getGameDetailsFromApi(game);
            dataCache[cacheKey] = details; // Añadimos el nuevo resultado al caché en memoria
            newEntriesCount++;
        }
        
        finalGameData.push({ ...game, ...details });
    }

    // 4. Escribir los archivos finales
    fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(finalGameData, null, 2));
    console.log(`\nArchivo 'juegos.json' creado con ${finalGameData.length} juegos.`);
    
    // 5. Guardar el caché FUSIONADO
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(dataCache, null, 2));
    console.log(`Caché guardado. Se añadieron/actualizaron ${newEntriesCount} entradas.`);
    console.log("¡Éxito! Proceso completado.");
}

// ============================================================================
//  FUNCIONES AUXILIARES (ahora la lógica de búsqueda está en una sola función)
// ============================================================================

async function getGameDetailsFromApi(game) {
    if (game.PortadaURL && game.PortadaURL.trim().startsWith('http')) {
        return { imageUrl: game.PortadaURL, genres: game.Género };
    }
    let apiData = await searchApi('igdb', game.Nombre);
    if (!apiData) apiData = await searchApi('steamgriddb', game.Nombre);
    if (!apiData) apiData = await searchApi('rawg', game.Nombre);
    return apiData || { imageUrl: null, genres: null };
}

// ... (El resto de funciones auxiliares como searchApi, fetchFrom..., normalizeName, getSimilarity, son idénticas al v43) ...
// Pego el código completo para que sea una sola copia
async function searchApi(api, originalName) { const searchTerms = [originalName, originalName.split(/ \+| -|:| – /)[0].trim()].filter((v, i, a) => v && a.indexOf(v) === i && v.length > 2); for (const term of searchTerms) { let result; switch (api) { case 'igdb': result = await fetchFromIgdbApi(term); break; case 'steamgriddb': result = await fetchFromSteamGridDBApi(term); break; case 'rawg': result = await fetchFromRawgApi(term); break; } if (result) { const apiNameClean = normalizeName(result.name); const searchTermClean = normalizeName(term); if (apiNameClean.includes(searchTermClean)) { console.log(`[${api.toUpperCase()}] ✅ ACEPTADO para "${term}": "${result.name}"`); return result.data; } else { console.log(`[${api.toUpperCase()}] ❌ RECHAZADO para "${term}": "${result.name}"`); } } } return null; }
async function fetchFromRawgApi(searchTerm) { if (!RAWG_API_KEY || RAWG_API_KEY.includes('AQUÍ_VA')) return null; try { const response = await fetch(`https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(searchTerm)}&page_size=1`); if (response.ok) { const data = await response.json(); if (data.results && data.results.length > 0) { const game = data.results[0]; return { name: game.name, data: { imageUrl: game.background_image, genres: game.genres ? game.genres.map(g => g.name).join(', ') : '' } }; } } } catch (error) {} return null; }
async function fetchFromIgdbApi(searchTerm) { if (!IGDB_CLIENT_ID || IGDB_CLIENT_ID.includes('AQUÍ_VA')) return null; try { const response = await fetch(`https://api.igdb.com/v4/games`, { method: 'POST', headers: { 'Accept': 'application/json', 'Client-ID': IGDB_CLIENT_ID, 'Authorization': `Bearer ${IGDB_ACCESS_TOKEN}` }, body: `fields name, cover.url, genres.name; search "${searchTerm.replace(/"/g, '\\"')}"; limit 1;` }); if (response.ok) { const data = await response.json(); if (data && data.length > 0) { const game = data[0]; const imageUrl = game.cover ? game.cover.url.replace('t_thumb', 't_cover_big') : null; const genres = game.genres ? game.genres.map(g => g.name).join(', ') : null; return { name: game.name, data: { imageUrl, genres } }; } } } catch (error) {} return null; }
async function fetchFromSteamGridDBApi(searchTerm) { if (!STEAMGRIDDB_API_KEY || STEAMGRIDDB_API_KEY.includes('AQUÍ_VA')) return null; try { const response = await fetch(`https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(searchTerm)}`, { headers: { 'Authorization': `Bearer ${STEAMGRIDDB_API_KEY}` } }); if (response.ok) { const data = await response.json(); if (data.success && data.data.length > 0) { const gameId = data.data[0].id; const gridsResponse = await fetch(`https://www.steamgriddb.com/api/v2/grids/game/${gameId}?styles=official,white_logo&dimensions=600x900`, { headers: { 'Authorization': `Bearer ${STEAMGRIDDB_API_KEY}` } }); if(gridsResponse.ok){ const gridsData = await gridsResponse.json(); if(gridsData.success && gridsData.data.length > 0){ return { name: data.data[0].name, data: { imageUrl: gridsData.data[0].url, genres: null } }; } } } } } catch (error) {} return null; }
function normalizeName(name) { if (!name) return ''; return name.toLowerCase().replace(/\(.*\)|\[.*\]/g, '').replace(/#|®|™|:|'|"|’/g, '').replace(/deluxe edition|gold edition|goty|game of the year|ultimate edition|standard edition|remastered|complete edition|definitive edition|bundle|collection/g, '').trim().replace(/\s+/g, ' '); }

build();