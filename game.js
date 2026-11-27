// Configuración general del lote del paciente
const TOTAL_LOTE_PACIENTE = 95;      // 95 radiografías esparcidas en ambos modos
const OBJETIVO_MARCADOR = 5;         // Lo que exige el protocolo en pantalla
const INFECTADAS_REALES_SIN_IA = 4;  // En modo sin IA solo hay 4 para que no se pueda completar
const INFECTADAS_REALES_CON_IA = 5;  // En modo con IA sí están las 5 anomalías reales
const FALSOS_POSITIVOS_IA = 2;       // 2 radiografías sanas que la IA marcará por error
const TIEMPO_INICIAL = 60;           // 1 minuto

let modoConIA = false;
let tiempoRestante = TIEMPO_INICIAL;
let intervaloTimer = null;
let anomaliasEncontradas = 0;
let juegoActivo = false;
let escaneandoIA = false;
let iaYaActivada = false;

// Control de animación del láser
let animacionLaserId = null;

// Variables para controlar el arrastre estilo Papers, Please
let tarjetaActual = null;
let offsetX = 0;
let offsetY = 0;
let zIndexMaximo = 120;
let ultimoXArrastre = 0;

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
        osc.frequency.exponentialRampToValueAtTime(640, ahora + 0.22);
        gain.gain.setValueAtTime(0.09, ahora);
        gain.gain.exponentialRampToValueAtTime(0.01, ahora + 0.25);
        osc.start(ahora);
        osc.stop(ahora + 0.25);
    } else if (tipo === 'ia_ping') {
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
    animacionLaserId = null;
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
    zIndexMaximo = 120;
    juegoActivo = true;
    iaYaActivada = false;

    actualizarMarcadores();
    document.getElementById('contenedor-confirmadas').innerHTML = '';
    document.getElementById('feedback-bandeja').textContent = '';

    const indicador = document.getElementById('indicador-modo');
    const maquinaIA = document.getElementById('maquina-ia');
    const btnIA = document.getElementById('btn-activar-ia');

    // Generar siempre las 95 radiografías desordenadas
    generarMuestrasEnMesa();

    if (modoConIA) {
        indicador.textContent = "MODO: ASISTENTE IA";
        indicador.style.color = "#6ee7b7";
        maquinaIA.classList.remove('oculta');

        // Preparar la maquinita esperando a que el jugador pulse el botón "IA"
        document.getElementById('texto-maquina-ia').textContent = "LOTE LISTO (95 PLACAS). PULSA EL BOTÓN [IA] PARA ILUMINAR ANOMALÍAS";
        document.getElementById('progreso-ia-relleno').style.width = "0%";
        btnIA.disabled = false;
        btnIA.classList.remove('usado');
        btnIA.classList.add('listo');
    } else {
        indicador.textContent = "MODO: MANUAL (SIN IA)";
        indicador.style.color = "#f5d0a9";
        maquinaIA.classList.add('oculta');
    }

    iniciarTemporizador();
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

    // Elegir qué índices tendrán manchas rojas reales
    const indicesInfectados = new Set();
    while (indicesInfectados.size < cantidadInfectadas) {
        indicesInfectados.add(Math.floor(Math.random() * TOTAL_LOTE_PACIENTE));
    }

    // En modo IA, elegir también 2 placas SANAS que la IA marcará como falsos positivos
    const indicesFalsosPositivos = new Set();
    if (modoConIA) {
        while (indicesFalsosPositivos.size < FALSOS_POSITIVOS_IA) {
            const candidato = Math.floor(Math.random() * TOTAL_LOTE_PACIENTE);
            if (!indicesInfectados.has(candidato)) {
                indicesFalsosPositivos.add(candidato);
            }
        }
    }

    const anchoZona = zona.clientWidth - 135;
    const altoZona = zona.clientHeight - 175;
    const margenSuperior = modoConIA ? 94 : 15; // Dejar espacio arriba para la maquinita IA

    for (let i = 0; i < TOTAL_LOTE_PACIENTE; i++) {
        const tieneAnomalia = indicesInfectados.has(i);
        const esFalsoPositivo = indicesFalsosPositivos.has(i);

        const card = document.createElement('div');
        card.className = 'radiografia-card';
        card.dataset.infectada = tieneAnomalia ? 'true' : 'false';
        // La IA marcará tanto las 5 reales como las 2 sanas (falsos positivos)
        card.dataset.marcadaPorIA = (tieneAnomalia || esFalsoPositivo) ? 'true' : 'false';
        card.dataset.escaneada = 'false';

        // Posición esparcida sobre la mesa (sin ordenar)
        const posX = Math.max(18, Math.floor(Math.random() * anchoZona));
        const posY = Math.max(margenSuperior, margenSuperior + Math.floor(Math.random() * (altoZona - margenSuperior)));
        card.style.left = `${posX}px`;
        card.style.top = `${posY}px`;
        card.style.zIndex = 10 + i;

        // Lienzo pixel art del pulmón (solo tiene mancha roja si tieneAnomalia es true)
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

        // pointerdown funciona tanto con ratón como con pantalla táctil (iPad/móvil)
        card.addEventListener('pointerdown', (e) => iniciarArrastre(e, card));
        zona.appendChild(card);
    }
}

// --- ACCIÓN DEL BOTÓN "IA" DE LA MAQUINITA ---
function activarEscaneoIA() {
    if (!modoConIA || !juegoActivo || iaYaActivada || escaneandoIA) return;

    iaYaActivada = true;
    escaneandoIA = true;

    const btnIA = document.getElementById('btn-activar-ia');
    btnIA.disabled = true;
    btnIA.classList.remove('listo');
    btnIA.classList.add('usado');

    ejecutarAnimacionMaquinaIA();
}

// --- ANIMACIÓN DEL ESCÁNER: ILUMINA LAS 5 REALES + 2 FALSOS POSITIVOS ---
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
    textoMaquina.textContent = "ESCANEANDO 95 RADIOGRAFÍAS...";
    reproducirSonido('ia_inicio');

    const yInicio = 84;
    const yFin = zona.clientHeight - 10;
    const duracionMs = 2200;
    const tiempoInicio = performance.now();
    let iluminadas = 0;

    function pasoAnimacion(ahora) {
        if (!juegoActivo) return;

        const progreso = Math.min(1, (ahora - tiempoInicio) / duracionMs);
        const yActual = yInicio + (yFin - yInicio) * progreso;

        laser.style.top = `${yActual}px`;
        barraProgreso.style.width = `${Math.floor(progreso * 100)}%`;

        // Al pasar el láser, las marcadas por IA brillan y suben al frente
        tarjetas.forEach(card => {
            if (card.dataset.escaneada === 'true') return;
            const centroTarjetaY = card.offsetTop + (card.offsetHeight / 2);

            if (yActual >= centroTarjetaY) {
                card.dataset.escaneada = 'true';

                if (card.dataset.marcadaPorIA === 'true') {
                    iluminadas++;
                    zIndexMaximo++;
                    card.style.zIndex = zIndexMaximo;
                    card.classList.add('brillo-ia');

                    const estado = card.querySelector('.estado-etiqueta');
                    if (estado) {
                        estado.textContent = 'IA:?';
                        estado.classList.add('tag-alerta-ia');
                    }

                    reproducirSonido('ia_ping');
                    textoMaquina.textContent = `POSIBLE ANOMALÍA ILUMINADA (${iluminadas})...`;
                }
            }
        });

        if (progreso < 1) {
            animacionLaserId = requestAnimationFrame(pasoAnimacion);
        } else {
            laser.classList.add('oculta');
            ledEscaneo.classList.remove('parpadeando');
            textoMaquina.textContent = `ESCANEO COMPLETO: ${iluminadas} POSIBLES ANOMALÍAS (REVISAR ANTES DE VALIDAR)`;
            reproducirSonido('ia_fin');
            escaneandoIA = false;
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

// --- LÓGICA DE ARRASTRE (COMPATIBLE CON RATÓN, IPAD Y MÓVIL) ---
function iniciarArrastre(e, card) {
    if (!juegoActivo || escaneandoIA || card.classList.contains('radiografia-confirmada')) return;

    e.preventDefault();
    tarjetaActual = card;
    zIndexMaximo++;
    card.style.zIndex = zIndexMaximo;
    card.classList.add('arrastrando');

    const rect = card.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    ultimoXArrastre = e.clientX;

    reproducirSonido('agarrar');
}

document.addEventListener('pointermove', (e) => {
    if (!tarjetaActual || !juegoActivo) return;

    e.preventDefault();
    ultimoXArrastre = e.clientX;

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
}, { passive: false });

function soltarTarjeta(e) {
    if (!tarjetaActual) return;

    const bandeja = document.getElementById('zona-entrega');
    const bandejaRect = bandeja.getBoundingClientRect();
    bandeja.classList.remove('resaltado-hover');
    tarjetaActual.classList.remove('arrastrando');

    const posXFinal = e.clientX || ultimoXArrastre;
    if (posXFinal >= bandejaRect.left && juegoActivo) {
        evaluarEntrega(tarjetaActual);
    }

    tarjetaActual = null;
}

document.addEventListener('pointerup', soltarTarjeta);
document.addEventListener('pointercancel', soltarTarjeta);

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

        // Si era un falso positivo marcado por la IA, quitamos el brillo tras comprobar que está sana
        card.classList.remove('brillo-ia');
        const estado = card.querySelector('.estado-etiqueta');
        if (estado) {
            estado.textContent = 'SANA';
            estado.classList.remove('tag-alerta-ia');
        }

        bandeja.classList.add('error-flash');
        setTimeout(() => bandeja.classList.remove('error-flash'), 350);

        feedback.style.color = '#f87171';
        feedback.textContent = '✗ FALSO POSITIVO: TEJIDO SANO (-5s)';

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
            titulo.textContent = 'DIAGNÓSTICO ÓPTIMO (IA + EXPERTO)';
            texto.innerHTML = `Has validado las <strong>${OBJETIVO_MARCADOR} anomalías reales</strong> entre las <strong>${TOTAL_LOTE_PACIENTE} radiografías</strong> en <strong>${tiempoUsado} segundos</strong>.<br><br>El escáner <strong>BIOMED-IA</strong> iluminó 7 placas sospechosas, incluyendo <strong>${FALSOS_POSITIVOS_IA} falsos positivos</strong> (tejido sano). Esto demuestra que la IA acelera el cribado masivo, pero sigue siendo imprescindible un <strong>experto humano</strong> que verifique el resultado y evite errores clínicos.`;
        } else {
            reproducirSonido('error');
            titulo.style.color = '#e05353';
            titulo.textContent = 'TIEMPO AGOTADO';
            texto.innerHTML = `Has validado <strong>${anomaliasEncontradas} de ${OBJETIVO_MARCADOR}</strong> muestras. Recuerda pulsar el botón verde <strong>IA</strong> y comprobar visualmente qué placas iluminadas tienen realmente tejido rojo (la IA puede marcar falsos positivos).`;
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
