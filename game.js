// Configuración general del lote del paciente
const TOTAL_LOTE_PACIENTE = 50;
const MUESTRAS_INFECTADAS = 5;
const MUESTRAS_FILTRADAS_IA = 10; // La IA reduce las 50 muestras a las 10 más sospechosas
const TIEMPO_INICIAL = 60; // 1 minuto

let modoConIA = false;
let tiempoRestante = TIEMPO_INICIAL;
let intervaloTimer = null;
let anomaliasEncontradas = 0;
let juegoActivo = false;

// Variables para controlar el arrastre estilo Papers, Please
let tarjetaActual = null;
let offsetX = 0;
let offsetY = 0;
let zIndexMaximo = 10;

// Sintetizador de sonidos retro
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
    } else if (tipo === 'ia_scan') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, ahora);
        osc.frequency.setValueAtTime(780, ahora + 0.07);
        osc.frequency.setValueAtTime(1040, ahora + 0.14);
        gain.gain.setValueAtTime(0.09, ahora);
        gain.gain.exponentialRampToValueAtTime(0.01, ahora + 0.25);
        osc.start(ahora);
        osc.stop(ahora + 0.25);
    }
}

function iniciarJuego(usarIA) {
    modoConIA = usarIA;

    // Cambiar de pantalla
    document.getElementById('pantalla-menu').classList.add('oculta');
    document.getElementById('modal-resultado').classList.add('oculta');
    document.getElementById('pantalla-juego').classList.remove('oculta');

    // Actualizar interfaz superior según el modo
    const indicador = document.getElementById('indicador-modo');
    const bannerIA = document.getElementById('banner-ia');

    if (modoConIA) {
        indicador.textContent = "MODO: ASISTENTE IA (TRIAJE)";
        indicador.style.color = "#6ee7b7";
        bannerIA.classList.remove('oculta');
        reproducirSonido('ia_scan');
    } else {
        indicador.textContent = "MODO: MANUAL (SIN IA)";
        indicador.style.color = "#f5d0a9";
        bannerIA.classList.add('oculta');
    }

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
    zona.querySelectorAll('.radiografia-card').forEach(el => el.remove());

    // En modo sin IA aparecen las 50 muestras; con IA solo las 10 seleccionadas por el modelo
    const cantidadEnMesa = modoConIA ? MUESTRAS_FILTRADAS_IA : TOTAL_LOTE_PACIENTE;

    // Elegir qué posiciones tendrán las 5 manchas rojas reales
    const indicesInfectados = new Set();
    while (indicesInfectados.size < MUESTRAS_INFECTADAS) {
        indicesInfectados.add(Math.floor(Math.random() * cantidadEnMesa));
    }

    const anchoZona = zona.clientWidth - 135;
    const altoZona = zona.clientHeight - 175;
    const margenSuperior = modoConIA ? 68 : 15; // Dejar espacio libre para el banner de IA

    for (let i = 0; i < cantidadEnMesa; i++) {
        const tieneAnomalia = indicesInfectados.has(i);
        const card = document.createElement('div');
        card.className = 'radiografia-card';
        if (modoConIA) card.classList.add('prioridad-ia');
        card.dataset.infectada = tieneAnomalia ? 'true' : 'false';

        // Posición esparcida sobre la mesa
        const posX = Math.max(18, Math.floor(Math.random() * anchoZona));
        const posY = Math.max(margenSuperior, margenSuperior + Math.floor(Math.random() * (altoZona - margenSuperior)));
        card.style.left = `${posX}px`;
        card.style.top = `${posY}px`;
        card.style.zIndex = 10 + i;

        // Crear lienzo pixel art del pulmón
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 36;
        dibujarPulmonPixelArt(canvas, tieneAnomalia);

        // Etiqueta inferior estilo archivo médico
        const etiqueta = document.createElement('div');
        etiqueta.className = 'etiqueta-scan';
        // En modo IA mostramos códigos salteados del lote original de 50
        const numeroRealLote = modoConIA ? (100 + i * 5 + Math.floor(Math.random() * 4)) : (100 + i);
        const codigo = String(numeroRealLote).padStart(3, '0');

        if (modoConIA) {
            etiqueta.innerHTML = `<span>RX-${codigo}</span><span class="tag-ia">IA:REV</span>`;
        } else {
            etiqueta.innerHTML = `<span>RX-${codigo}</span><span>P.04</span>`;
        }

        card.appendChild(canvas);
        card.appendChild(etiqueta);

        card.addEventListener('mousedown', (e) => iniciarArrastre(e, card));
        zona.appendChild(card);
    }
}

function dibujarPulmonPixelArt(canvas, tieneManchaRoja) {
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0c1519';
    ctx.fillRect(0, 0, 32, 36);

    ctx.strokeStyle = '#1d313a';
    ctx.strokeRect(1, 1, 30, 34);

    // Tráquea y columna
    ctx.fillStyle = '#2b4652';
    ctx.fillRect(15, 3, 2, 28);
    ctx.fillRect(14, 9, 4, 2);

    const varAncho = Math.floor(Math.random() * 2);
    const varAlto = Math.floor(Math.random() * 2);

    // Lóbulos pulmonares
    dibujarLobulo(ctx, 5, 9, 8 + varAncho, 19 + varAlto, '#466a78', '#5c8796');
    dibujarLobulo(ctx, 19 - varAncho, 9, 8 + varAncho, 19 + varAlto, '#466a78', '#5c8796');

    // Costillas
    ctx.fillStyle = 'rgba(168, 206, 222, 0.22)';
    for (let y = 11; y <= 25; y += 4) {
        ctx.fillRect(5, y, 9, 1);
        ctx.fillRect(18, y, 9, 1);
    }

    // Manchas rojas de patología
    if (tieneManchaRoja) {
        const enPulmonIzquierdo = Math.random() < 0.5;
        const baseX = enPulmonIzquierdo ? (7 + Math.floor(Math.random() * 4)) : (20 + Math.floor(Math.random() * 4));
        const baseY = 12 + Math.floor(Math.random() * 12);

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

    let nuevoX = e.clientX - zonaRect.left - offsetX;
    let nuevoY = e.clientY - zonaRect.top - offsetY;

    const maxX = document.getElementById('mesa-trabajo').clientWidth - tarjetaActual.offsetWidth;
    const maxY = zona.clientHeight - tarjetaActual.offsetHeight;

    nuevoX = Math.max(0, Math.min(nuevoX, maxX));
    nuevoY = Math.max(0, Math.min(nuevoY, maxY));

    tarjetaActual.style.left = `${nuevoX}px`;
    tarjetaActual.style.top = `${nuevoY}px`;

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
        reproducirSonido('error');
        tiempoRestante = Math.max(0, tiempoRestante - 5);
        actualizarMarcadores();

        bandeja.classList.add('error-flash');
        setTimeout(() => bandeja.classList.remove('error-flash'), 350);

        feedback.style.color = '#f87171';
        feedback.textContent = '✗ TEJIDO SANO (-5 SEG)';

        card.style.left = '250px';
    }
}

function finalizarPartida(victoria) {
    juegoActivo = false;
    clearInterval(intervaloTimer);

    const modal = document.getElementById('modal-resultado');
    const titulo = document.getElementById('titulo-resultado');
    const texto = document.getElementById('texto-resultado');
    const btnCambiarModo = document.getElementById('btn-cambiar-modo');
    const tiempoUsado = TIEMPO_INICIAL - tiempoRestante;

    if (modoConIA) {
        // Ocultamos el botón de "Probar con IA" porque ya estamos en ese modo
        btnCambiarModo.classList.add('oculta');

        if (victoria) {
            titulo.style.color = '#6ee7b7';
            titulo.textContent = 'DIAGNÓSTICO ÓPTIMO (CON IA)';
            texto.innerHTML = `Has validado las <strong>${MUESTRAS_INFECTADAS} anomalías críticas</strong> en solo <strong>${tiempoUsado} segundos</strong>.<br><br>Gracias al triaje de la IA, que descartó 40 muestras sanas, pudiste concentrarte en los casos complejos sin fatiga visual y salvar tiempo vital para el paciente.`;
        } else {
            reproducirSonido('error');
            titulo.style.color = '#e05353';
            titulo.textContent = 'TIEMPO AGOTADO';
            texto.innerHTML = `Has encontrado <strong>${anomaliasEncontradas} de ${MUESTRAS_INFECTADAS}</strong> muestras. Revisa con calma las 10 placas preseleccionadas por la IA para detectar las manchas rojas.`;
        }
    } else {
        // En modo sin IA, mostramos el botón directo para probar el modo con IA
        btnCambiarModo.classList.remove('oculta');

        if (victoria) {
            titulo.style.color = '#6ee7b7';
            titulo.textContent = 'DIAGNÓSTICO MANUAL COMPLETADO';
            texto.innerHTML = `¡Impresionante! Has encontrado las <strong>${MUESTRAS_INFECTADAS} muestras críticas</strong> entre las ${TOTAL_LOTE_PACIENTE} radiografías en <strong>${tiempoUsado} segundos</strong>.<br><br>Prueba ahora el <strong>Modo con IA</strong> para comprobar cómo el triaje automatizado agiliza este proceso en biomedicina.`;
        } else {
            reproducirSonido('error');
            titulo.style.color = '#e05353';
            titulo.textContent = 'TIEMPO AGOTADO (SIN IA)';
            texto.innerHTML = `Has identificado <strong>${anomaliasEncontradas} de ${MUESTRAS_INFECTADAS}</strong> muestras con anomalías.<br><br>Inspeccionar manualmente <strong>${TOTAL_LOTE_PACIENTE} radiografías</strong> en 60 segundos provoca sobrecarga cognitiva. Prueba ahora el <strong>Modo con Asistente IA</strong> para ver la diferencia.`;
        }
    }

    modal.classList.remove('oculta');
}
