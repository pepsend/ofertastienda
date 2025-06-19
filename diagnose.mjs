// diagnose.mjs - Nuestra herramienta de espionaje
import fetch from 'node-fetch';

// --- CONFIGURACIÓN ---
const RAWG_API_KEY = 'AQUÍ_VA_TU_CLAVE_API_DE_RAWG'; 
const IGDB_CLIENT_ID = 'AQUÍ_VA_TU_CLIENT_ID_DE_TWITCH';
const IGDB_ACCESS_TOKEN = 'AQUÍ_VA_TU_ACCESS_TOKEN_DE_TWITCH';

// ============================================================================

async function diagnose(gameName) {
    if (!gameName) {
        console.error("Por favor, proporciona un nombre de juego para diagnosticar.");
        return;
    }

    console.log(`\n--- DIAGNÓSTICO PARA: "${gameName}" ---\n`);

    // --- Diagnóstico de RAWG ---
    console.log("1. Consultando RAWG...");
    try {
        const rawgResponse = await fetch(`https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(gameName)}&page_size=1`);
        if (rawgResponse.ok) {
            const rawgData = await rawgResponse.json();
            console.log("   Respuesta de RAWG (primer resultado):");
            console.log(rawgData.results[0] || "   -> No se encontraron resultados.");
        } else {
            console.log(`   -> Error de RAWG: ${rawgResponse.status} ${rawgResponse.statusText}`);
        }
    } catch (error) {
        console.error("   -> Fallo catastrófico al contactar RAWG:", error.message);
    }

    // --- Diagnóstico de IGDB ---
    console.log("\n2. Consultando IGDB...");
    try {
        const igdbResponse = await fetch(`https://api.igdb.com/v4/games`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Client-ID': IGDB_CLIENT_ID,
                'Authorization': `Bearer ${IGDB_ACCESS_TOKEN}`
            },
            body: `fields name, cover.url, genres.name; search "${gameName.replace(/"/g, '\\"')}"; limit 1;`
        });
        if (igdbResponse.ok) {
            const igdbData = await igdbResponse.json();
            console.log("   Respuesta de IGDB (primer resultado):");
            console.log(igdbData[0] || "   -> No se encontraron resultados.");
        } else {
            console.log(`   -> Error de IGDB: ${igdbResponse.status} ${igdbResponse.statusText}`);
        }
    } catch (error) {
        console.error("   -> Fallo catastrófico al contactar IGDB:", error.message);
    }

    console.log("\n--- FIN DEL DIAGNÓSTICO ---");
}

// Tomamos el nombre del juego desde la línea de comandos
const gameToDiagnose = process.argv[2];
diagnose(gameToDiagnose);