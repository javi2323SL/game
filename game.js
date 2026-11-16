// Configuración del modo sin IA
const TOTAL_MUESTRAS = 50;
const MUESTRAS_INFECTADAS = 5;
const TIEMPO_INICIAL = 60; // 1 minuto

let tiempoRestante = TIEMPO_INICIAL;
let intervaloTimer = null;
let anomaliasEncontradas = 0;
let juegoActivo = false;

// Variables para controlar el arrastre estilo Papers, Please
let tarjetaActual = null;
let offsetX = 0;
let offsetY = 0;
let zIndexMaximo = 10;

// Sintetizador de sonidos retro (sin archivos externos)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function reproducirSonido(tipo) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const ahora = audioCtx.currentTime;

    if (tipo === 'agarrar') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, ahora);
        osc.frequency.exponentialRampToValueAtTime(260, ahora + 0.05);
        gain.gain.setValueAtTime(0.08, ahora);
        gain.gain.exponentialRampToValueAtTime(0.01, ahora + 0.05);
        osc.start(ahora);
        osc.stop(ahora + 0.05);
    } else if (tipo === 'acierto') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, ahora);
        osc.frequency.setValueAtTime(660, ahora + 0.08);
        gain.gain.setValueAtTime(0.1, ahora);
        gain.gain.exponentialRampToValueAtTime(0.01, ahora + 0.2);
        osc.start(ahora);
        osc.stop(ahora + 0.2);
    } else if (tipo === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, ahora);
        osc.frequency.linearRampToValueAtTime(90, ahora + 0.25);
        gain.gain.setValueAtTime(0.15, ahora);
        gain.gain.exponentialRampToValueAtTime(0.01, ahora + 0.25);
        osc.start(ahora);
        osc.stop(ahora + 0.25);
    }
}

function avisoModoIA() {
    const msg = document.getElementById('mensaje-menu');
    msg.textContent = ">> El módulo del Asistente IA se programará en la siguiente fase. Prueba primero el Modo sin IA.";
}

function iniciarJuego(usarIA) {
    // Cambiar de pantalla
    document.getElementById('pantalla-menu').classList.add('oculta');
    document.getElementById('modal-resultado').classList.add('oculta');
    document.getElementById('pantalla-juego').classList.remove('oculta');

    // Reiniciar estado
    tiempoRestante = TIEMPO_INICIAL;
    anomaliasEncontradas = 0;
    zIndexMaximo = 10;
    juegoActivo = true;

    actualizarMarcadores();
    document.getElementById('contenedor-confirmadas').innerHTML = '';
    document.getElementById('feedback-bandeja').textContent = '';

    generarMuestrasEnMesa();
    iniciarTemporizador();
}

function volverAlMenu() {
    juegoActivo = false;
    clearInterval(intervaloTimer);
    document.getElementById('modal-resultado').classList.add('oculta');
    document.getElementById('pantalla-juego').classList.add('oculta');
    document.getElementById('pantalla-menu').classList.remove('oculta');
}

function iniciarTemporizador() {
    clearInterval(intervaloTimer);
    intervaloTimer = setInterval(() => {
        if (!juegoActivo) return;
        tiempoRestante--;
        actualizarMarcadores();

        if (tiempoRestante <= 0) {
            tiempoRestante = 0;
            actualizarMarcadores();
            finalizarPartida(false);
        }
    }, 1000);
}

function actualizarMarcadores() {
    const min = String(Math.floor(Math.max(0, tiempoRestante) / 60)).padStart(2, '0');
    const seg = String(Math.max(0, tiempoRestante) % 60).padStart(2, '0');
    document.getElementById('temporizador').textContent = `TIEMPO: ${min}:${seg}`;
    document.getElementById('contador-hallazgos').textContent = `ANOMALÍAS: ${anomaliasEncontradas} / ${MUESTRAS_INFECTADAS}`;
}

function generarMuestrasEnMesa() {
    const zona = document.getElementById('zona-dispersion');
    // Limpiar muestras anteriores conservando la instrucción
    zona.querySelectorAll('.radiografia-card').forEach(el => el.remove());

    // Elegir qué índices tendrán manchas rojas (solo 5 de 50)
    const indicesInfectados = new Set();
    while (indicesInfectados.size < MUESTRAS_INFECTADAS) {
        indicesInfectados.add(Math.floor(Math.random() * TOTAL_MUESTRAS));
    }

    const anchoZona = zona.clientWidth - 130;
    const altoZona = zona.clientHeight - 170;

    for (let i = 0; i < TOTAL_MUESTRAS; i++) {
        const tieneAnomalia = indicesInfectados.has(i);
        const card = document.createElement('div');
        card.className = 'radiografia-card';
        card.dataset.infectada = tieneAnomalia ? 'true' : 'false';

        // Posición aleatoria esparcida por la mesa
        const posX = Math.max(15, Math.floor(Math.random() * anchoZona));
        const posY = Math.max(15, Math.floor(Math.random() * altoZona));
        card.style.left = `${posX}px`;
        card.style.top = `${posY}px`;
        card.style.zIndex = 10 + i;

        // Crear lienzo pixel art del pulmón
        const canvas = document.createElement('canvas');
        canvas.width = 32;  // Resolución baja para efecto pixel art auténtico
        canvas.height = 36;
        dibujarPulmonPixelArt(canvas, tieneAnomalia);

        // Etiqueta inferior estilo archivo médico
        const etiqueta = document.createElement('div');
        etiqueta.className = 'etiqueta-scan';
        const codigo = String(100 + i).padStart(3, '0');
        etiqueta.innerHTML = `<span>RX-${codigo}</span><span>P.04</span>`;

        card.appendChild(canvas);
        card.appendChild(etiqueta);

        // Evento al agarrar la imagen
        card.addEventListener('mousedown', (e) => iniciarArrastre(e, card));

        zona.appendChild(card);
    }
}

// Dibuja un pulmón en estilo radiografía pixel art (32x36 píxeles)
function dibujarPulmonPixelArt(canvas, tieneManchaRoja) {
    const ctx = canvas.getContext('2d');

    // Fondo oscuro de placa radiográfica
    ctx.fillStyle = '#0c1519';
    ctx.fillRect(0, 0, 32, 36);

    // Marco interior sutil
    ctx.strokeStyle = '#1d313a';
    ctx.strokeRect(1, 1, 30, 34);

    // Tráquea y columna vertebral central
    ctx.fillStyle = '#2b4652';
    ctx.fillRect(15, 3, 2, 28);
    ctx.fillRect(14, 9, 4, 2);

    // Lóbulos pulmonares (izquierdo y derecho) con ligera variación orgánica
    const varAncho = Math.floor(Math.random() * 2);
    const varAlto = Math.floor(Math.random() * 2);

    // Lóbulo izquierdo
    dibujarLobulo(ctx, 5, 9, 8 + varAncho, 19 + varAlto, '#466a78', '#5c8796');
    // Lóbulo derecho
    dibujarLobulo(ctx, 19 - varAncho, 9, 8 + varAncho, 19 + varAlto, '#466a78', '#5c8796');

    // Costillas (líneas horizontales tenues sobre los pulmones)
    ctx.fillStyle = 'rgba(168, 206, 222, 0.22)';
    for (let y = 11; y <= 25; y += 4) {
        ctx.fillRect(5, y, 9, 1);
        ctx.fillRect(18, y, 9, 1);
    }

    // Si es una de las 5 imágenes clave, añadir pequeñas manchas rojas sutiles dentro del pulmón
    if (tieneManchaRoja) {
        const enPulmonIzquierdo = Math.random() < 0.5;
        const baseX = enPulmonIzquierdo ? (7 + Math.floor(Math.random() * 4)) : (20 + Math.floor(Math.random() * 4));
        const baseY = 12 + Math.floor(Math.random() * 12);

        // Grupo pequeño de píxeles rojos (difícil de ver a simple vista entre 50 placas)
        ctx.fillStyle = '#b82525';
        ctx.fillRect(baseX, baseY, 2, 2);
        ctx.fillStyle = '#e03838';
        ctx.fillRect(baseX + 1, baseY + 1, 2, 1);
        ctx.fillRect(baseX, baseY + 2, 1, 1);
    }
}

function dibujarLobulo(ctx, x, y, w, h, colorBase, colorLuz) {
    ctx.fillStyle = colorBase;
    ctx.fillRect(x + 1, y, w - 2, h);
    ctx.fillRect(x, y + 2, w, h - 4);

    // Textura interna pixelada
    ctx.fillStyle = colorLuz;
    ctx.fillRect(x + 2, y + 3, w - 4, h - 7);
}

// --- LÓGICA DE ARRASTRE DE DOCUMENTOS ---
function iniciarArrastre(e, card) {
    if (!juegoActivo || card.classList.contains('radiografia-confirmada')) return;

    tarjetaActual = card;
    zIndexMaximo++;
    card.style.zIndex = zIndexMaximo;
    card.classList.add('arrastrando');

    const rect = card.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    reproducirSonido('agarrar');
}

document.addEventListener('mousemove', (e) => {
    if (!tarjetaActual || !juegoActivo) return;

    const zona = document.getElementById('zona-dispersion');
    const zonaRect = zona.getBoundingClientRect();

    // Permitir arrastrar hacia la bandeja de la derecha
    let nuevoX = e.clientX - zonaRect.left - offsetX;
    let nuevoY = e.clientY - zonaRect.top - offsetY;

    // Limitar para que no se salga de la pantalla
    const maxX = document.getElementById('mesa-trabajo').clientWidth - tarjetaActual.offsetWidth;
    const maxY = zona.clientHeight - tarjetaActual.offsetHeight;

    nuevoX = Math.max(0, Math.min(nuevoX, maxX));
    nuevoY = Math.max(0, Math.min(nuevoY, maxY));

    tarjetaActual.style.left = `${nuevoX}px`;
    tarjetaActual.style.top = `${nuevoY}px`;

    // Iluminar la bandeja si la tarjeta pasa por encima
    const bandeja = document.getElementById('zona-entrega');
    const bandejaRect = bandeja.getBoundingClientRect();
    if (e.clientX >= bandejaRect.left) {
        bandeja.classList.add('resaltado-hover');
    } else {
        bandeja.classList.remove('resaltado-hover');
    }
});

document.addEventListener('mouseup', (e) => {
    if (!tarjetaActual) return;

    const bandeja = document.getElementById('zona-entrega');
    const bandejaRect = bandeja.getBoundingClientRect();
    bandeja.classList.remove('resaltado-hover');
    tarjetaActual.classList.remove('arrastrando');

    // Comprobar si soltó la imagen dentro de la Bandeja de Anomalías
    if (e.clientX >= bandejaRect.left && juegoActivo) {
        evaluarEntrega(tarjetaActual);
    }

    tarjetaActual = null;
});

function evaluarEntrega(card) {
    const esInfectada = card.dataset.infectada === 'true';
    const bandeja = document.getElementById('zona-entrega');
    const feedback = document.getElementById('feedback-bandeja');

    if (esInfectada) {
        // ¡Acierto! Fijar la imagen en la bandeja
        reproducirSonido('acierto');
        anomaliasEncontradas++;
        actualizarMarcadores();

        card.classList.add('radiografia-confirmada');
        document.getElementById('contenedor-confirmadas').appendChild(card);

        feedback.style.color = '#6ee7b7';
        feedback.textContent = '✓ ANOMALÍA CONFIRMADA';

        if (anomaliasEncontradas >= MUESTRAS_INFECTADAS) {
            finalizarPartida(true);
        }
    } else {
        // Error: metió un pulmón sano -> penalización de tiempo y devolución a la mesa
        reproducirSonido('error');
        tiempoRestante = Math.max(0, tiempoRestante - 5);
        actualizarMarcadores();

        bandeja.classList.add('error-flash');
        setTimeout(() => bandeja.classList.remove('error-flash'), 350);

        feedback.style.color = '#f87171';
        feedback.textContent = '✗ TEJIDO SANO (-5 SEG)';

        // Devolver la tarjeta hacia la izquierda para que no quede encima de la bandeja
        card.style.left = '350px';
    }
}

function finalizarPartida(victoria) {
    juegoActivo = false;
    clearInterval(intervaloTimer);

    const modal = document.getElementById('modal-resultado');
    const titulo = document.getElementById('titulo-resultado');
    const texto = document.getElementById('texto-resultado');

    if (victoria) {
        titulo.style.color = '#6ee7b7';
        titulo.textContent = 'DIAGNÓSTICO COMPLETADO';
        texto.innerHTML = `Increíble: has logrado identificar las <strong>${MUESTRAS_INFECTADAS} muestras críticas</strong> entre las ${TOTAL_MUESTRAS} radiografías antes de que acabara el minuto.<br><br>Ahora imagina cuánto más rápido sería con ayuda de IA.`;
    } else {
        reproducirSonido('error');
        titulo.style.color = '#e05353';
        titulo.textContent = 'TIEMPO AGOTADO';
        texto.innerHTML = `Has identificado <strong>${anomaliasEncontradas} de ${MUESTRAS_INFECTADAS}</strong> muestras con anomalías.<br><br>Revisar manualmente <strong>${TOTAL_MUESTRAS} radiografías</strong> en 60 segundos provoca fatiga visual y retrasos críticos en el diagnóstico del paciente.`;
    }

    modal.classList.remove('oculta');
}
