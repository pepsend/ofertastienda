// script.js - v39 (El Script Tonto y Rápido)

document.addEventListener('DOMContentLoaded', function() {
    console.log("PÁGINA CARGADA. Iniciando script v39...");

    const gameGrid = document.getElementById('game-grid');
    const searchInput = document.getElementById('searchInput');
    const loadingMessage = document.getElementById('loadingMessage');
    const noResultsMessage = document.getElementById('noResultsMessage');
    
    let allGames = []; // Aquí guardaremos todos los juegos una vez cargados

    // La única tarea de este script: cargar el archivo JSON pre-procesado
    fetch('juegos.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error de red: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log(`-> JSON cargado con ${data.length} juegos.`);
            allGames = data;
            renderAllGames(allGames);
            loadingMessage.style.display = 'none';
        })
        .catch(error => {
            console.error("Error fatal al cargar juegos.json:", error);
            loadingMessage.innerHTML = `<p style="color:red;">No se pudieron cargar las ofertas. Asegúrate de haber ejecutado el build script.</p>`;
        });

    // Función para renderizar los juegos en la pantalla
    function renderAllGames(games) {
        gameGrid.innerHTML = '';
        noResultsMessage.style.display = (games.length === 0 && searchInput.value) ? 'block' : 'none';
        
        const cardsHTML = games.map(game => {
            if (!game || !game.nombre) return '';
            
            const cardClasses = ['game-card'];
            if (game.oferta && game.oferta.includes('🔥')) {
                cardClasses.push('oferta-destacada');
            }
            
            const imagenHTML = game.imageUrl 
                ? `<img src="${game.imageUrl}" alt="Portada de ${game.nombre}" class="game-cover" loading="lazy">` 
                : '<div class="game-cover-placeholder"><span class="placeholder-text">Portada no disponible</span></div>';
            
            return `
                <div class="${cardClasses.join(' ')}">
                    ${imagenHTML}
                    <div class="card-content">
                        <h3>${game.nombre}</h3>
                        <p class="game-price">${game.precio || 'N/D'}</p>
                        <div class="game-details">
                            <p><span class="label">Edición:</span> <span>${game.edicion || 'Standard'}</span></p>
                            <p><span class="label">Plataforma:</span> <span>${game.plataforma || 'No especificada'}</span></p>
                            <p><span class="label">Género:</span> <span>${game.genres || 'No especificado'}</span></p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        gameGrid.innerHTML = cardsHTML;
    }

    // Función de búsqueda simple
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const filteredGames = allGames.filter(g => g.nombre.toLowerCase().includes(searchTerm));
        renderAllGames(filteredGames);
    });
});