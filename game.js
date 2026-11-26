// Configuración general del lote del paciente
const TOTAL_LOTE_PACIENTE = 95;      // Saturación de muestras en ambos modos al empezar
const OBJETIVO_MARCADOR = 5;         // Lo que exige el protocolo en pantalla
const INFECTADAS_REALES_SIN_IA = 4;  // En modo sin IA solo hay 4 para que no se pueda completar
const INFECTADAS_REALES_CON_IA = 5;  // En modo con IA sí están las 5 anomalías reales
const SANAS_QUE_MANTIENE_IA = 10;    // Placas sanas que la IA deja sin descartar (descarta 80)
const TIEMPO_INICIAL = 60;           // 1 minuto

let modoConIA = false;
let tiempoRestante = TIEMPO_INICIAL;
let intervaloTimer = null;
let anomaliasEncontradas = 0;
let juegoActivo = false;
let escaneandoIA = false;

// Control de animaciones de la IA para poder cancelarlas si se sale al menú
let animacionLaserId = null;
let timeoutInicioEscaneo = null;

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
    } else if (tipo === 'ia_inicio') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, ahora);
        osc.frequency.exponentialRampToValueAtTime(640, ahora + 0.25);
        gain.gain.setValueAtTime(0.08, ahora);
        gain.gain.exponentialRampToValueAtTime(0.01, ahora + 0.28);
        osc.start(ahora);
        osc.stop(ahora + 0.28);
    } else if (tipo === 'ia_ping') {
        // Pitido agudo de radar cuando el láser detecta y hace brillar una foto marcada
        osc.type = 'sine';
        osc.frequency.setValueAtTime(980, ahora);
        osc.frequency.setValueAtTime(1320, ahora + 0.05);
        gain.gain.setValueAtTime(0.09, ahora);
        gain.gain.exponentialRampToValueAtTime(0.01, ahora + 0.14);
        osc.start(ahora);
        osc.stop(ahora + 0.14);
    } else if (tipo === 'ia_fin') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523, ahora);
        osc.frequency.setValueAtTime(659, ahora + 0.08);
        osc.frequency.setValueAtTime(784, ahora + 0.16);
        gain.gain.setValueAtTime(0.1, ahora);
        gain.gain.exponentialRampToValueAtTime(0.01, ahora + 0.3);
        osc.start(ahora);
        osc.stop(ahora + 0.3);
    }
}

function limpiarAnimacionesIA() {
    if (animacionLaserId) cancelAnimationFrame(animacionLaserId);
    if (timeoutInicioEscaneo) clearTimeout(timeoutInicioEscaneo);
    animacionLaserId = null;
    timeoutInicioEscaneo = null;
    escaneandoIA = false;

    document.getElementById('laser-ia').classList.add('oculta');
    document.getElementById('led-escaneo').classList.remove('parpadeando');
}

function iniciarJuego(usarIA) {
    limpiarAnimacionesIA();
    clearInterval(intervaloTimer);
    modoConIA = usarIA;

    // Cambiar de pantalla
    document.getElementById('pantalla-menu').classList.add('oculta');
    document.getElementById('modal-resultado').classList.add('oculta');
    document.getElementById('pantalla-juego').classList.remove('oculta');

    // Reiniciar estado
    tiempoRestante = TIEMPO_INICIAL;
    anomaliasEncontradas = 0;
    zIndexMaximo = 100;
    juegoActivo = true;

    actualizarMarcadores();
    document.getElementById('contenedor-confirmadas').innerHTML = '';
    document.getElementById('feedback-bandeja').textContent = '';

    const indicador = document.getElementById('indicador-modo');
    const maquinaIA = document.getElementById('maquina-ia');

    // Siempre generamos el montón caótico de 95 placas
    generarMuestrasEnMesa();

    if (modoConIA) {
        indicador.textContent = "MODO: ASISTENTE IA";
        indicador.style.color = "#6ee7b7";
        maquinaIA.classList.remove('oculta');
        document.getElementById('texto-maquina-ia').textContent = "DETECTADO LOTE DE 95 PLACAS. INICIANDO ESCÁNER...";
        document.getElementById('progreso-ia-relleno').style.width = "0%";

        // Lanzar la animación de la maquinita IA antes de arrancar la cuenta atrás
        escaneandoIA = true;
        timeoutInicioEscaneo = setTimeout(() => {
            ejecutarAnimacionMaquinaIA();
        }, 550);
    } else {
        indicador.textContent = "MODO: MANUAL (SIN IA)";
        indicador.style.color = "#f5d0a9";
        maquinaIA.classList.add('oculta');
        iniciarTemporizador();
    }
}

function volverAlMenu() {
    juegoActivo = false;
    limpiarAnimacionesIA();
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
    document.getElementById('contador-hallazgos').textContent = `ANOMALÍAS: ${anomaliasEncontradas} / ${OBJETIVO_MARCADOR}`;
}

function generarMuestrasEnMesa() {
    const zona = document.getElementById('zona-dispersion');
    zona.querySelectorAll('.radiografia-card').forEach(el => el.remove());

    const cantidadInfectadas = modoConIA ? INFECTADAS_REALES_CON_IA : INFECTADAS_REALES_SIN_IA;

    // Elegir qué índices tendrán manchas rojas
    const indicesInfectados = new Set();
    while (indicesInfectados.size < cantidadInfectadas) {
        indicesInfectados.add(Math.floor(Math.random() * TOTAL_LOTE_PACIENTE));
    }

    // En modo IA, elegir 10 placas sanas que se quedarán en la mesa (el resto serán descartadas por el láser)
    const indicesSanasMantenidas = new Set();
    if (modoConIA) {
        while (indicesSanasMantenidas.size < SANAS_QUE_MANTIENE_IA) {
            const rnd = Math.floor(Math.random() * TOTAL_LOTE_PACIENTE);
            if (!indicesInfectados.has(rnd)) {
                indicesSanasMantenidas.add(rnd);
            }
        }
    }

    const anchoZona = zona.clientWidth - 135;
    const altoZona = zona.clientHeight - 175;
    const margenSuperior = modoConIA ? 92 : 15; // Dejar espacio arriba para la maquinita IA

    for (let i = 0; i < TOTAL_LOTE_PACIENTE; i++) {
        const tieneAnomalia = indicesInfectados.has(i);
        const card = document.createElement('div');
        card.className = 'radiografia-card';
        card.dataset.infectada = tieneAnomalia ? 'true' : 'false';
        card.dataset.mantenerIA = (tieneAnomalia || indicesSanasMantenidas.has(i)) ? 'true' : 'false';
        card.dataset.escaneada = 'false';

        // Posición completamente esparcida sobre la mesa (sin ordenar)
        const posX = Math.max(18, Math.floor(Math.random() * anchoZona));
        const posY = Math.max(margenSuperior, margenSuperior + Math.floor(Math.random() * (altoZona - margenSuperior)));
        card.style.left = `${posX}px`;
        card.style.top = `${posY}px`;
        card.style.zIndex = 10 + i;

        // Lienzo pixel art del pulmón
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 36;
        dibujarPulmonPixelArt(canvas, tieneAnomalia);

        // Etiqueta inferior
        const etiqueta = document.createElement('div');
        etiqueta.className = 'etiqueta-scan';
        const codigo = String(100 + i).padStart(3, '0');
        etiqueta.innerHTML = `<span>RX-${codigo}</span><span class="estado-etiqueta">P.04</span>`;

        card.appendChild(canvas);
        card.appendChild(etiqueta);

        card.addEventListener('mousedown', (e) => iniciarArrastre(e, card));
        zona.appendChild(card);
    }
}

// --- ANIMACIÓN DE LA MAQUINITA ESCÁNER DE IA ---
function ejecutarAnimacionMaquinaIA() {
    if (!juegoActivo) return;

    const zona = document.getElementById('zona-dispersion');
    const laser = document.getElementById('laser-ia');
    const ledEscaneo = document.getElementById('led-escaneo');
    const textoMaquina = document.getElementById('texto-maquina-ia');
    const barraProgreso = document.getElementById('progreso-ia-relleno');
    const tarjetas = Array.from(zona.querySelectorAll('.radiografia-card'));

    laser.classList.remove('oculta');
    ledEscaneo.classList.add('parpadeando');
    textoMaquina.textContent = "ESCANEANDO TEJIDO PULMONAR Y FILTRANDO RUIDO...";
    reproducirSonido('ia_inicio');

    const yInicio = 82;
    const yFin = zona.clientHeight - 10;
    const duracionMs = 2600;
    const tiempoInicio = performance.now();
    let detectadasEnEscaneo = 0;

    function pasoAnimacion(ahora) {
        if (!juegoActivo) return;

        const progreso = Math.min(1, (ahora - tiempoInicio) / duracionMs);
        const yActual = yInicio + (yFin - yInicio) * progreso;

        // Mover el haz láser y llenar la barra de la maquinita
        laser.style.top = `${yActual}px`;
        barraProgreso.style.width = `${Math.floor(progreso * 100)}%`;

        // Comprobar qué radiografías acaba de atravesar el láser
        tarjetas.forEach(card => {
            if (card.dataset.escaneada === 'true') return;
            const centroTarjetaY = card.offsetTop + (card.offsetHeight / 2);

            if (yActual >= centroTarjetaY) {
                card.dataset.escaneada = 'true';

                if (card.dataset.infectada === 'true') {
                    // ¡Anomalía detectada! La maquinita la hace BRILLAR y la sube al frente
                    detectadasEnEscaneo++;
                    zIndexMaximo++;
                    card.style.zIndex = zIndexMaximo;
                    card.classList.add('brillo-ia');

                    const estado = card.querySelector('.estado-etiqueta');
                    if (estado) {
                        estado.textContent = 'IA:!';
                        estado.classList.add('tag-alerta-ia');
                    }

                    reproducirSonido('ia_ping');
                    textoMaquina.textContent = `ANOMALÍA RESALTADA (${detectadasEnEscaneo}/${INFECTADAS_REALES_CON_IA})...`;
                } else if (card.dataset.mantenerIA === 'false') {
                    // Placa sana descartada automáticamente por la IA
                    card.classList.add('descartada-ia');
                }
            }
        });

        if (progreso < 1) {
            animacionLaserId = requestAnimationFrame(pasoAnimacion);
        } else {
            // Fin del escaneo: apagar láser y arrancar el turno del médico
            laser.classList.add('oculta');
            ledEscaneo.classList.remove('parpadeando');
            textoMaquina.textContent = "ESCANEO COMPLETO: 80 SANAS DESCARTADAS // 5 ANOMALÍAS ILUMINADAS";
            reproducirSonido('ia_fin');

            escaneandoIA = false;
            iniciarTemporizador();
        }
    }

    animacionLaserId = requestAnimationFrame(pasoAnimacion);
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
    if (!juegoActivo || escaneandoIA || card.classList.contains('radiografia-confirmada')) return;

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

        card.classList.remove('brillo-ia');
        card.classList.add('radiografia-confirmada');
        document.getElementById('contenedor-confirmadas').appendChild(card);

        feedback.style.color = '#6ee7b7';
        feedback.textContent = '✓ ANOMALÍA CONFIRMADA';

        if (anomaliasEncontradas >= OBJETIVO_MARCADOR) {
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
    limpiarAnimacionesIA();
    clearInterval(intervaloTimer);

    const modal = document.getElementById('modal-resultado');
    const titulo = document.getElementById('titulo-resultado');
    const texto = document.getElementById('texto-resultado');
    const btnCambiarModo = document.getElementById('btn-cambiar-modo');
    const tiempoUsado = TIEMPO_INICIAL - tiempoRestante;

    if (modoConIA) {
        btnCambiarModo.classList.add('oculta');

        if (victoria) {
            titulo.style.color = '#6ee7b7';
            titulo.textContent = 'DIAGNÓSTICO ÓPTIMO (CON IA)';
            texto.innerHTML = `Has validado las <strong>${OBJETIVO_MARCADOR} anomalías críticas</strong> en solo <strong>${tiempoUsado} segundos</strong>.<br><br>El escáner <strong>BIOMED-IA</strong> analizó las 95 radiografías en segundos, filtró el ruido visual y resaltó las zonas sospechosas para que tú, como médico, pudieras confirmar el diagnóstico sin demora.`;
        } else {
            reproducirSonido('error');
            titulo.style.color = '#e05353';
            titulo.textContent = 'TIEMPO AGOTADO';
            texto.innerHTML = `Has validado <strong>${anomaliasEncontradas} de ${OBJETIVO_MARCADOR}</strong> muestras. Arrastra las radiografías iluminadas por el escáner IA hacia la bandeja derecha.`;
        }
    } else {
        btnCambiarModo.classList.remove('oculta');
        reproducirSonido('error');

        titulo.style.color = '#e05353';
        titulo.textContent = 'TIEMPO AGOTADO (SIN IA)';
        texto.innerHTML = `Has identificado <strong>${anomaliasEncontradas} de ${OBJETIVO_MARCADOR}</strong> anomalías entre <strong>${TOTAL_LOTE_PACIENTE} radiografías</strong>.<br><br>En la práctica clínica real, el volumen masivo de imágenes sin filtrar hace humanamente inabarcable detectar todas las lesiones a tiempo. Prueba ahora el <strong>Modo con Asistente IA</strong> para ver cómo cambia el diagnóstico.`;
    }

    modal.classList.remove('oculta');
}
