// build.js - v41 (La Lógica Correcta)
import fs from 'fs';
import Papa from 'papaparse';
import fetch from 'node-fetch';

console.log("Iniciando proceso de construcción (v41)...");

// --- CONFIGURACIÓN ---
const CSV_FILE_PATH = './OFERTAS_FINAL.csv';
const OUTPUT_JSON_PATH = './juegos.json';
const CACHE_FILE_PATH = './build_cache.json';

const RAWG_API_KEY = '694d2b80f36148b0a8c04bd0a6f28c33'; 
const IGDB_CLIENT_ID = '5m5y7vod3ilgxjb5xnsgug8pdps3m9';
const IGDB_ACCESS_TOKEN = 'yij22l487u2wsx0em66xjdfa89r1fu';

// ============================================================================
//  FUNCIÓN PRINCIPAL
// ============================================================================
async function build() {
    let dataCache = {};
    if (fs.existsSync(CACHE_FILE_PATH)) {
        dataCache = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf8'));
    }
    
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

    let apiData = await searchApi('igdb', originalName);
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
    ].filter((v, i, a) => v && a.indexOf(v) === i && v.length > 2);

    for (const term of searchTerms) {
        const result = api === 'igdb' ? await fetchFromIgdbApi(term) : await fetchFromRawgApi(term);
        if (result) {
            // --- VERIFICACIÓN FINAL Y DEFINITIVA ---
            const apiNameClean = normalizeName(result.name, true);
            const searchTermClean = normalizeName(term, true);
            
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

async function fetchFromRawgApi(searchTerm) {
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

async function fetchFromIgdbApi(searchTerm) {
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

function normalizeName(name, aggressive = false) {
    if (!name) return '';
    let normalized = name.toLowerCase()
        .replace(/\(.*\)|\[.*\]/g, '')
        .replace(/#|®|™|:|'|"|’/g, '');
        
    if (aggressive) {
        normalized = normalized.replace(/deluxe edition|gold edition|goty|game of the year|ultimate edition|standard edition|remastered|complete edition|definitive edition|bundle|collection/g, '');
    }
    
    return normalized.trim().replace(/\s+/g, ' ');
}

build();