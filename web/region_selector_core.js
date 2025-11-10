/**
 * Region Selector JavaScript - Logica interazione canvas editor
 */

// ============================================================================
// DOM ELEMENTS
// ============================================================================

const container = document.getElementById('canvas-container');
const backgroundImage = document.getElementById('background-image');
const baseCoordinates = document.getElementById('base-coordinates');
const dimensionsInfo = document.getElementById('dimensions-info');
const currentDimensions = document.getElementById('current-dimensions');
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const zoomValue = document.getElementById('zoom-value');
const borderSlider = document.getElementById('border-slider');
const borderValue = document.getElementById('border-value');
const resetBtn = document.getElementById('reset-btn');
const borderPositionRadios = document.querySelectorAll('input[name="border-position"]');
const imageUpload = document.getElementById('image-upload');
const uploadBtn = document.getElementById('upload-btn');
const imageName = document.getElementById('image-name');
const confirmBtn = document.getElementById('confirm-btn');
const cancelBtn = document.getElementById('cancel-btn');
const closeBtn = document.getElementById('close-btn');

// ============================================================================
// STATE VARIABLES
// ============================================================================

let isDrawing = false;
let isResizing = false;
let resizingEdge = null;
let startX = 0;
let startY = 0;
let rectStartX = 0;
let rectStartY = 0;
let rectStartWidth = 0;
let rectStartHeight = 0;
let currentRectangle = null;
let currentZoom = 1;
let currentBorderWidth = 3;
let borderPosition = 'inside';
let rectangleExists = false;

// Coordinate base (senza zoom e bordi)
let baseWidth = 0;
let baseHeight = 0;
let baseX = 0;
let baseY = 0;

const defaultBorderWidth = 3;
const zoomStep = 0.25;
const minZoom = 0.25;
const maxZoom = 4;

// Callback per comunicazione con il nodo
let onConfirmCallback = null;
let onCancelCallback = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
});

function initializeEventListeners() {
    // Upload button
    uploadBtn.addEventListener('click', handleUploadClick);
    imageUpload.addEventListener('change', handleImageUpload);

    // Zoom buttons
    zoomInBtn.addEventListener('click', handleZoomIn);
    zoomOutBtn.addEventListener('click', handleZoomOut);

    // Border controls
    borderSlider.addEventListener('input', handleBorderChange);
    borderPositionRadios.forEach(radio => {
        radio.addEventListener('change', handleBorderPositionChange);
    });

    // Reset button
    resetBtn.addEventListener('click', handleReset);

    // Canvas drawing
    container.addEventListener('mousedown', handleCanvasMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Action buttons
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    closeBtn.addEventListener('click', handleCancel);

    // Prevent image drag
    backgroundImage.addEventListener('dragstart', (e) => e.preventDefault());
}

// ============================================================================
// FILE UPLOAD
// ============================================================================

function handleUploadClick() {
    imageUpload.click();
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();

        reader.onload = function(event) {
            backgroundImage.src = event.target.result;
            imageName.textContent = `Immagine corrente: ${file.name}`;

            if (currentRectangle) {
                if (confirm('Cambiando immagine il rettangolo verrà cancellato. Continuare?')) {
                    resetRectangle();
                } else {
                    imageUpload.value = '';
                    return;
                }
            }
        };

        reader.readAsDataURL(file);
    }
}

// ============================================================================
// RECTANGLE DRAWING
// ============================================================================

function handleCanvasMouseDown(e) {
    if (e.button !== 0) return; // Solo left click
    if (!container || !backgroundImage) return;

    const rect = container.getBoundingClientRect();
    const imgRect = backgroundImage.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Coordinate del click relative all'immagine
    const imgX = e.clientX - imgRect.left;
    const imgY = e.clientY - imgRect.top;

    // Se il click è fuori dall'immagine, non fare nulla
    if (imgX < 0 || imgY < 0 || imgX > imgRect.width || imgY > imgRect.height) {
        return;
    }

    // Verifica se stai ridimensionando
    if (currentRectangle) {
        const handleRect = detectResizeHandle(e, currentRectangle);
        if (handleRect) {
            isResizing = true;
            resizingEdge = handleRect;
            startX = e.clientX;
            startY = e.clientY;
            rectStartX = baseX;
            rectStartY = baseY;
            rectStartWidth = baseWidth;
            rectStartHeight = baseHeight;
            currentRectangle.classList.add('resizing');
            return;
        }

        // Verifica se stai spostando il rettangolo
        if (isClickInsideRectangle(e, currentRectangle, imgRect)) {
            isDrawing = true;
            startX = e.clientX;
            startY = e.clientY;
            rectStartX = baseX;
            rectStartY = baseY;
            return;
        }
    }

    // Inizia nuovo rettangolo
    isDrawing = true;
    startX = imgX;
    startY = imgY;
    baseX = imgX;
    baseY = imgY;
    baseWidth = 1;
    baseHeight = 1;

    createNewRectangle(imgX, imgY, 1, 1);
}

function handleMouseMove(e) {
    if (!isDrawing && !isResizing) return;
    if (!container || !backgroundImage) return;

    const imgRect = backgroundImage.getBoundingClientRect();

    if (isResizing && currentRectangle && resizingEdge) {
        handleResizeRectangle(e, imgRect);
    } else if (isDrawing) {
        const imgX = e.clientX - imgRect.left;
        const imgY = e.clientY - imgRect.top;

        const width = Math.max(10, Math.abs(imgX - startX));
        const height = Math.max(10, Math.abs(imgY - startY));
        const x = Math.min(startX, imgX);
        const y = Math.min(startY, imgY);

        baseX = x;
        baseY = y;
        baseWidth = width;
        baseHeight = height;

        updateRectanglePosition(x, y, width, height);
        updateAllDimensions();
    }
}

function handleMouseUp(e) {
    if (isResizing && currentRectangle) {
        currentRectangle.classList.remove('resizing');
    }
    isDrawing = false;
    isResizing = false;
    resizingEdge = null;
}

function createNewRectangle(x, y, width, height) {
    // Rimuovi il vecchio rettangolo se esiste
    if (currentRectangle) {
        currentRectangle.remove();
    }

    const rect = document.createElement('div');
    rect.className = `rectangle border-${borderPosition}`;
    rect.style.left = x + 'px';
    rect.style.top = y + 'px';
    rect.style.width = width + 'px';
    rect.style.height = height + 'px';
    rect.style.borderWidth = currentBorderWidth + 'px';

    // Aggiungi resize handles
    ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach(position => {
        const handle = document.createElement('div');
        handle.className = `resize-handle ${position}`;
        rect.appendChild(handle);
    });

    container.appendChild(rect);
    currentRectangle = rect;
    rectangleExists = true;

    // Abilita bottoni
    enableControls();
    updateAllDimensions();
}

function updateRectanglePosition(x, y, width, height) {
    if (!currentRectangle) return;

    currentRectangle.style.left = x + 'px';
    currentRectangle.style.top = y + 'px';
    currentRectangle.style.width = width + 'px';
    currentRectangle.style.height = height + 'px';
}

function handleResizeRectangle(e, imgRect) {
    if (!currentRectangle) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    let newX = rectStartX;
    let newY = rectStartY;
    let newWidth = rectStartWidth;
    let newHeight = rectStartHeight;

    // Handle diverse per lato di resize
    if (resizingEdge.includes('left')) {
        newX = Math.max(0, rectStartX + deltaX);
        newWidth = rectStartWidth - (newX - rectStartX);
    }
    if (resizingEdge.includes('right')) {
        newWidth = Math.max(10, rectStartWidth + deltaX);
    }
    if (resizingEdge.includes('top')) {
        newY = Math.max(0, rectStartY + deltaY);
        newHeight = rectStartHeight - (newY - rectStartY);
    }
    if (resizingEdge.includes('bottom')) {
        newHeight = Math.max(10, rectStartHeight + deltaY);
    }

    newWidth = Math.max(10, newWidth);
    newHeight = Math.max(10, newHeight);

    baseX = newX;
    baseY = newY;
    baseWidth = newWidth;
    baseHeight = newHeight;

    updateRectanglePosition(newX, newY, newWidth, newHeight);
    updateAllDimensions();
}

function isClickInsideRectangle(e, rect, imgRect) {
    const rectBounds = rect.getBoundingClientRect();
    return e.clientX >= rectBounds.left &&
           e.clientX <= rectBounds.right &&
           e.clientY >= rectBounds.top &&
           e.clientY <= rectBounds.bottom;
}

function detectResizeHandle(e, rect) {
    const handles = rect.querySelectorAll('.resize-handle');
    for (let handle of handles) {
        const handleRect = handle.getBoundingClientRect();
        const distance = Math.sqrt(
            Math.pow(e.clientX - (handleRect.left + handleRect.width / 2), 2) +
            Math.pow(e.clientY - (handleRect.top + handleRect.height / 2), 2)
        );
        if (distance < 12) {
            return handle.className.split(' ').find(c => c !== 'resize-handle');
        }
    }
    return null;
}

// ============================================================================
// ZOOM CONTROLS
// ============================================================================

function handleZoomIn() {
    if (currentRectangle) {
        currentZoom = Math.min(currentZoom + zoomStep, maxZoom);
        updateZoom();
        updateAllDimensions();
    }
}

function handleZoomOut() {
    if (currentRectangle) {
        currentZoom = Math.max(currentZoom - zoomStep, minZoom);
        updateZoom();
        updateAllDimensions();
    }
}

function updateZoom() {
    const zoomPercent = Math.round(currentZoom * 100);
    zoomValue.textContent = zoomPercent + '%';
    if (currentRectangle) {
        currentRectangle.style.transform = `scale(${currentZoom})`;
    }

    zoomInBtn.disabled = currentZoom >= maxZoom;
    zoomOutBtn.disabled = currentZoom <= minZoom;
}

// ============================================================================
// BORDER CONTROLS
// ============================================================================

function handleBorderChange(e) {
    currentBorderWidth = parseInt(e.target.value);
    borderValue.textContent = currentBorderWidth + 'px';

    if (currentRectangle) {
        currentRectangle.style.borderWidth = currentBorderWidth + 'px';
        updateAllDimensions();
    }
}

function handleBorderPositionChange(e) {
    borderPosition = e.target.value;

    if (currentRectangle) {
        currentRectangle.classList.remove('border-inside', 'border-outside');
        currentRectangle.classList.add(`border-${borderPosition}`);
        updateAllDimensions();
    }
}

// ============================================================================
// RESET AND CLEAR
// ============================================================================

function handleReset() {
    resetRectangle();
}

function resetRectangle() {
    if (currentRectangle) {
        currentRectangle.remove();
        currentRectangle = null;
    }

    rectangleExists = false;
    currentZoom = 1;
    baseWidth = 0;
    baseHeight = 0;
    baseX = 0;
    baseY = 0;

    baseCoordinates.innerHTML = '<p>Clicca e trascina sull\'immagine per disegnare un rettangolo</p>';
    dimensionsInfo.style.display = 'none';

    disableControls();
}

// ============================================================================
// UPDATE DISPLAY
// ============================================================================

function updateAllDimensions() {
    if (!rectangleExists) return;

    // Coordinate base (senza zoom e bordi)
    const baseInfo = `
        <strong>X:</strong> ${Math.round(baseX)} px<br>
        <strong>Y:</strong> ${Math.round(baseY)} px<br>
        <strong>Larghezza:</strong> ${Math.round(baseWidth)} px<br>
        <strong>Altezza:</strong> ${Math.round(baseHeight)} px<br>
        <br>
        <strong>Percentuali:</strong><br>
        <strong>X%:</strong> ${((baseX / backgroundImage.width) * 100).toFixed(2)}%<br>
        <strong>Y%:</strong> ${((baseY / backgroundImage.height) * 100).toFixed(2)}%<br>
        <strong>W%:</strong> ${((baseWidth / backgroundImage.width) * 100).toFixed(2)}%<br>
        <strong>H%:</strong> ${((baseHeight / backgroundImage.height) * 100).toFixed(2)}%
    `;

    baseCoordinates.innerHTML = baseInfo;

    // Mostra info zoom e bordi se zoom > 1 o bordo > 0
    if (currentZoom > 1 || currentBorderWidth > 0) {
        const zoomedWidth = baseWidth * currentZoom;
        const zoomedHeight = baseHeight * currentZoom;

        const dimensionsHTML = `
            <strong>Con Zoom ${Math.round(currentZoom * 100)}%:</strong><br>
            <strong>Larghezza:</strong> ${Math.round(zoomedWidth)} px<br>
            <strong>Altezza:</strong> ${Math.round(zoomedHeight)} px<br>
            <br>
            <strong>Bordo:</strong> ${currentBorderWidth}px (${borderPosition})<br>
        `;

        currentDimensions.innerHTML = dimensionsHTML;
        dimensionsInfo.style.display = 'block';
    } else {
        dimensionsInfo.style.display = 'none';
    }
}

// ============================================================================
// BUTTON STATES
// ============================================================================

function enableControls() {
    zoomInBtn.disabled = false;
    zoomOutBtn.disabled = false;
    resetBtn.disabled = false;
    confirmBtn.disabled = false;
}

function disableControls() {
    zoomInBtn.disabled = true;
    zoomOutBtn.disabled = true;
    resetBtn.disabled = true;
    confirmBtn.disabled = true;
}

// ============================================================================
// COORDINATE EXPORT
// ============================================================================

function getCoordinates() {
    if (!rectangleExists) {
        return {};
    }

    return {
        x: Math.round(baseX),
        y: Math.round(baseY),
        width: Math.round(baseWidth),
        height: Math.round(baseHeight),
        zoom: currentZoom,
        borderWidth: currentBorderWidth,
        borderPosition: borderPosition,
    };
}

// ============================================================================
// ACTION BUTTONS
// ============================================================================

function handleConfirm() {
    const coordinates = getCoordinates();

    if (!rectangleExists) {
        alert('Nessuna selezione effettuata');
        return;
    }

    // Invia coordinate al callback
    if (onConfirmCallback) {
        onConfirmCallback(coordinates);
    }

    // Log per debug
    console.log('Coordinates confirmed:', coordinates);
}

function handleCancel() {
    if (onCancelCallback) {
        onCancelCallback();
    }
    // Non chiudere la finestra - il callback si occuperà di chiudere il modal
}

// ============================================================================
// PUBLIC API (per integrazione ComfyUI)
// ============================================================================

window.RegionSelector = {
    /**
     * Inizializza il selettore di regioni con callback personalizzati
     * @param {Function} onConfirm - Callback quando l'utente conferma (riceve coordinates)
     * @param {Function} onCancel - Callback quando l'utente annulla
     */
    init: function(onConfirm, onCancel) {
        onConfirmCallback = onConfirm;
        onCancelCallback = onCancel;
    },

    /**
     * Ottieni le coordinate attuali della selezione
     * @returns {Object} Oggetto con x, y, width, height, zoom, borderWidth, borderPosition
     */
    getCoordinates: function() {
        return getCoordinates();
    },

    /**
     * Imposta un'immagine da URL
     * @param {String} imageUrl - URL dell'immagine
     */
    setImage: function(imageUrl) {
        if (currentRectangle) {
            if (confirm('Cambiando immagine il rettangolo verrà cancellato. Continuare?')) {
                resetRectangle();
            } else {
                return;
            }
        }
        backgroundImage.src = imageUrl;
        imageName.textContent = 'Immagine caricata';
    },

    /**
     * Carica una selezione precedente
     * @param {Object} coordinates - Oggetto coordinate
     */
    loadCoordinates: function(coordinates) {
        if (!coordinates || !coordinates.x) return;

        baseX = coordinates.x || 0;
        baseY = coordinates.y || 0;
        baseWidth = coordinates.width || 100;
        baseHeight = coordinates.height || 100;
        currentZoom = coordinates.zoom || 1;
        currentBorderWidth = coordinates.borderWidth || 3;
        borderPosition = coordinates.borderPosition || 'inside';

        // Aggiorna UI
        borderSlider.value = currentBorderWidth;
        borderValue.textContent = currentBorderWidth + 'px';
        document.querySelector(`input[value="${borderPosition}"]`).checked = true;
        updateZoom();

        // Ridisegna
        createNewRectangle(baseX, baseY, baseWidth, baseHeight);
    }
};
