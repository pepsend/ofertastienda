// build.js - Versión corregida con 'import'
import fs from 'fs';
import Papa from 'papaparse';
import fetch from 'node-fetch';

console.log("Iniciando proceso de construcción...");

// --- CONFIGURACIÓN ---
const CSV_FILE_PATH = './OFERTAS_FINAL.csv';
const OUTPUT_JSON_PATH = './juegos.json';
const RAWG_API_KEY = '694d2b80f36148b0a8c04bd0a6f28c33';
const IGDB_CLIENT_ID = '5m5y7vod3ilgxjb5xnsgug8pdps3m9';
const IGDB_ACCESS_TOKEN = 'yij22l487u2wsx0em66xjdfa89r1fu';
const SIMILARITY_THRESHOLD = 0.80;

// ============================================================================
//  FUNCIÓN PRINCIPAL
// ============================================================================
async function build() {
    // Leer y parsear el archivo CSV
    const fileContent = fs.readFileSync(CSV_FILE_PATH, 'utf8');
    const csvData = Papa.parse(fileContent, { header: true, skipEmptyLines: true }).data;
    console.log(`Leídas ${csvData.length} filas del CSV.`);

    let dataCache = {}; // Usamos un caché simple en memoria para esta ejecución
    const finalGameData = [];

    // Procesar cada juego, uno por uno
    for (let i = 0; i < csvData.length; i++) {
        const game = csvData[i];
        if (!game.Nombre) continue;

        console.log(`Procesando ${i + 1}/${csvData.length}: ${game.Nombre}`);
        const details = await getGameDetails(game, dataCache);
        
        // Construir el objeto final para el JSON
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

    // Escribir el archivo JSON final
    fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(finalGameData, null, 2));
    console.log(`\n¡Éxito! Archivo 'juegos.json' creado con ${finalGameData.length} juegos.`);
}

// ============================================================================
//  FUNCIONES AUXILIARES
// ============================================================================

function normalizeName(name, aggressive = false) {
    if (!name) return '';
    let normalized = name.toLowerCase().replace(/\(.*\)|\[.*\]/g, '').replace(/#|®|™|:|'|"|’/g, '');
    if (aggressive) {
        normalized = normalized.replace(/deluxe edition|gold edition|goty|game of the year|ultimate edition|standard edition|remastered|complete edition|definitive edition|bundle|collection/g, '');
    }
    return normalized.trim().replace(/\s+/g, ' ');
}

function getSimilarity(a, b) {
    if (a.length === 0) return b.length === 0 ? 1 : 0;
    if (b.length === 0) return a.length === 0 ? 1 : 0;
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for (let i = 0; i <= a.length; i++) { matrix[0][i] = i; }
    for (let j = 0; j <= b.length; j++) { matrix[j][0] = j; }
    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + cost);
        }
    }
    return 1 - (matrix[b.length][a.length] / Math.max(a.length, b.length));
}

async function fetchFromRawgApi(searchTerm) {
    if (!searchTerm) return null;
    try {
        const response = await fetch(`https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(searchTerm)}&page_size=1`);
        if (response.ok) {
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                const game = data.results[0];
                return { name: game.name, data: { imageUrl: game.background_image, genres: game.genres.map(g => g.name).join(', ') } };
            }
        }
    } catch (error) { console.error("Error en RAWG API:", error.message); }
    return null;
}

async function fetchFromIgdbApi(searchTerm) {
    if (!searchTerm) return null;
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
                return { name: game.name, data: { imageUrl: game.cover ? game.cover.url.replace('t_thumb', 't_cover_big') : null, genres: game.genres ? game.genres.map(g => g.name).join(', ') : null } };
            }
        }
    } catch (error) { console.error("Error en IGDB API:", error.message); }
    return null;
}

async function searchApi(api, originalName) {
    const searchTerms = [originalName, originalName.split(/ \+| -|:| – /)[0].trim(), normalizeName(originalName, true)].filter((v, i, a) => v && a.indexOf(v) === i && v.length > 2);
    for (const term of searchTerms) {
        const result = api === 'igdb' ? await fetchFromIgdbApi(term) : await fetchFromRawgApi(term);
        if (result) {
            const similarity = getSimilarity(normalizeName(originalName, true), normalizeName(result.name, true));
            if (similarity >= SIMILARITY_THRESHOLD) {
                return result.data;
            }
        }
    }
    return null;
}

async function getGameDetails(game, dataCache) {
    const originalName = game.Nombre;
    if (!originalName) return { imageUrl: null, genres: null };
    if (game.PortadaURL && game.PortadaURL.trim().startsWith('http')) {
        return { imageUrl: game.PortadaURL, genres: game.Género };
    }
    const cacheKey = normalizeName(originalName);
    if (dataCache[cacheKey]) return dataCache[cacheKey];

    let apiData = await searchApi('igdb', originalName);
    if (!apiData) {
        apiData = await searchApi('rawg', originalName);
    }
    const finalData = apiData || { imageUrl: null, genres: null };
    dataCache[cacheKey] = finalData;
    return finalData;
}


// --- Iniciar el proceso ---
build();