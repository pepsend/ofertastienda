// script.js - Ahora es súper rápido y tonto
document.addEventListener('DOMContentLoaded', () => {
    const gameGrid = document.getElementById('game-grid');
    const searchInput = document.getElementById('searchInput');
    const loadingMessage = document.getElementById('loadingMessage');
    const noResultsMessage = document.getElementById('noResultsMessage');
    
    let allGames = [];

    // Carga el archivo JSON pre-procesado
    fetch('juegos.json')
        .then(response => response.json())
        .then(data => {
            allGames = data;
            renderAllGames(allGames);
            loadingMessage.style.display = 'none';
        })
        .catch(error => {
            console.error("Error al cargar juegos.json:", error);
            loadingMessage.innerHTML = `<p style="color:red;">No se pudieron cargar las ofertas.</p>`;
        });

    function renderAllGames(games) {
        gameGrid.innerHTML = '';
        noResultsMessage.style.display = (games.length === 0 && searchInput.value) ? 'block' : 'none';
        
        const cardsHTML = games.map(game => {
            const cardClasses = ['game-card'];
            if (game.oferta && game.oferta.includes('🔥')) cardClasses.push('oferta-destacada');
            const imagenHTML = game.imageUrl ? `<img src="${game.imageUrl}" alt="Portada de ${game.nombre}" class="game-cover" loading="lazy">` : '<div class="game-cover-placeholder"><span class="placeholder-text">Portada no disponible</span></div>';
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

    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const filteredGames = allGames.filter(g => g.nombre.toLowerCase().includes(searchTerm));
        renderAllGames(filteredGames);
    });
});