// Variable para saber en qué modo estamos jugando
let modoConIA = false;

function iniciarJuego(usarIA) {
    modoConIA = usarIA;

    // Ocultar menú y mostrar pantalla de juego
    document.getElementById('pantalla-menu').classList.add('oculta');
    document.getElementById('pantalla-juego').classList.remove('oculta');

    // Actualizar texto superior según el modo elegido
    const indicador = document.getElementById('indicador-modo');
    if (modoConIA) {
        indicador.textContent = "MODO: ASISTENTE IA ACTIVO";
        indicador.style.color = "#6ee7b7";
    } else {
        indicador.textContent = "MODO: REVISIÓN MANUAL (SIN IA)";
        indicador.style.color = "#f5d0a9";
    }
}

function volverAlMenu() {
    document.getElementById('pantalla-juego').classList.add('oculta');
    document.getElementById('pantalla-menu').classList.remove('oculta');
}