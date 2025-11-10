/**
 * Canvas Selector - Funzionalità complete di selezione rettangoli
 * Basato sul codice di canva_html
 */

function initializeCanvasSelector(container, imageUrl) {
    console.log("[CanvasSelector] Initializing with image:", imageUrl);

    // Riferimenti agli elementi DOM (cercati dentro il container)
    const canvasContainer = container.querySelector('#canvas-container');
    const backgroundImage = container.querySelector('#background-image');
    const baseCoordinates = container.querySelector('#base-coordinates');
    const dimensionsInfo = container.querySelector('#dimensions-info');
    const currentDimensions = container.querySelector('#current-dimensions');
    const zoomInBtn = container.querySelector('#zoom-in-btn');
    const zoomOutBtn = container.querySelector('#zoom-out-btn');
    const zoomValue = container.querySelector('#zoom-value');
    const borderSlider = container.querySelector('#border-slider');
    const borderValue = container.querySelector('#border-value');
    const resetBtn = container.querySelector('#reset-btn');
    const borderPositionRadios = container.querySelectorAll('input[name="border-position"]');
    const imageUpload = container.querySelector('#image-upload');
    const uploadBtn = container.querySelector('#upload-btn');
    const imageName = container.querySelector('#image-name');

    // Variabili di stato
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
    let currentBorderWidth = 0;
    let borderPosition = 'inside';
    let rectangleExists = false;

    // Dimensioni base
    let baseWidth = 0;
    let baseHeight = 0;
    let baseX = 0;
    let baseY = 0;

    const defaultBorderWidth = 3;
    const zoomStep = 0.25;
    const minZoom = 0.25;
    const maxZoom = 4;

    // Carica l'immagine iniziale
    if (imageUrl) {
        backgroundImage.src = imageUrl;
        const filename = imageUrl.split('/').pop();
        imageName.textContent = `Immagine: ${filename}`;
    }

    // ========== EVENT LISTENERS ==========

    // Upload button
    uploadBtn.addEventListener('click', () => imageUpload.click());

    imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                backgroundImage.src = event.target.result;
                imageName.textContent = `Immagine: ${file.name}`;
                if (currentRectangle && confirm('Cambiando immagine il rettangolo verrà cancellato. Continuare?')) {
                    resetRectangle();
                }
            };
            reader.readAsDataURL(file);
        }
    });

    // Zoom buttons
    zoomInBtn.addEventListener('click', () => {
        if (currentRectangle) {
            currentZoom = Math.min(currentZoom + zoomStep, maxZoom);
            updateZoom();
            updateAllDimensions();
        }
    });

    zoomOutBtn.addEventListener('click', () => {
        if (currentRectangle) {
            currentZoom = Math.max(currentZoom - zoomStep, minZoom);
            updateZoom();
            updateAllDimensions();
        }
    });

    // Border slider
    borderSlider.addEventListener('input', (e) => {
        currentBorderWidth = parseInt(e.target.value);
        borderValue.textContent = currentBorderWidth + 'px';

        if (currentRectangle) {
            if (currentRectangle.classList.contains('border-outside')) {
                currentRectangle.style.outlineWidth = currentBorderWidth + 'px';
            } else {
                currentRectangle.style.borderWidth = currentBorderWidth + 'px';
            }

            if (currentBorderWidth > defaultBorderWidth) {
                currentRectangle.classList.add('thick-border');
            } else {
                currentRectangle.classList.remove('thick-border');
            }

            updateAllDimensions();
        }
    });

    // Border position radios
    borderPositionRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            borderPosition = e.target.value;

            if (currentRectangle) {
                if (borderPosition === 'outside') {
                    currentRectangle.classList.remove('border-inside');
                    currentRectangle.classList.add('border-outside');
                    currentRectangle.style.outlineWidth = currentBorderWidth + 'px';
                    currentRectangle.style.borderWidth = '0px';
                } else {
                    currentRectangle.classList.remove('border-outside');
                    currentRectangle.classList.add('border-inside');
                    currentRectangle.style.borderWidth = currentBorderWidth + 'px';
                    currentRectangle.style.outlineWidth = '0px';
                }

                updateAllDimensions();
            }
        });
    });

    // Reset button
    resetBtn.addEventListener('click', () => {
        if (confirm('Vuoi cancellare il rettangolo e disegnarne uno nuovo?')) {
            resetRectangle();
        }
    });

    // Mouse down - inizio disegno
    canvasContainer.addEventListener('mousedown', (e) => {
        if (rectangleExists) return;
        if (e.target.classList.contains('resize-handle')) return;

        const rect = canvasContainer.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;

        isDrawing = true;

        currentRectangle = document.createElement('div');
        currentRectangle.className = 'rectangle';

        if (borderPosition === 'outside') {
            currentRectangle.classList.add('border-outside');
            currentRectangle.style.outlineWidth = currentBorderWidth + 'px';
            currentRectangle.style.outlineStyle = 'solid';
            currentRectangle.style.borderWidth = '0px';
        } else {
            currentRectangle.classList.add('border-inside');
            currentRectangle.style.borderWidth = currentBorderWidth + 'px';
        }

        currentRectangle.style.left = startX + 'px';
        currentRectangle.style.top = startY + 'px';
        currentRectangle.style.width = '0px';
        currentRectangle.style.height = '0px';

        if (currentBorderWidth > defaultBorderWidth) {
            currentRectangle.classList.add('thick-border');
        }

        canvasContainer.appendChild(currentRectangle);
    });

    // Mouse move
    document.addEventListener('mousemove', (e) => {
        if (isDrawing) {
            const rect = canvasContainer.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;

            const width = currentX - startX;
            const height = currentY - startY;

            if (width < 0) {
                currentRectangle.style.left = currentX + 'px';
                currentRectangle.style.width = Math.abs(width) + 'px';
            } else {
                currentRectangle.style.width = width + 'px';
            }

            if (height < 0) {
                currentRectangle.style.top = currentY + 'px';
                currentRectangle.style.height = Math.abs(height) + 'px';
            } else {
                currentRectangle.style.height = height + 'px';
            }
        }

        if (isResizing && currentRectangle) {
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            switch(resizingEdge) {
                case 'top':
                    const newTop = rectStartY + deltaY;
                    const newHeight = rectStartHeight - deltaY;
                    if (newHeight > 0) {
                        currentRectangle.style.top = newTop + 'px';
                        currentRectangle.style.height = newHeight + 'px';
                    }
                    break;

                case 'bottom':
                    const bottomHeight = rectStartHeight + deltaY;
                    if (bottomHeight > 0) {
                        currentRectangle.style.height = bottomHeight + 'px';
                    }
                    break;

                case 'left':
                    const newLeft = rectStartX + deltaX;
                    const newWidth = rectStartWidth - deltaX;
                    if (newWidth > 0) {
                        currentRectangle.style.left = newLeft + 'px';
                        currentRectangle.style.width = newWidth + 'px';
                    }
                    break;

                case 'right':
                    const rightWidth = rectStartWidth + deltaX;
                    if (rightWidth > 0) {
                        currentRectangle.style.width = rightWidth + 'px';
                    }
                    break;

                case 'top-left':
                    const tlNewTop = rectStartY + deltaY;
                    const tlNewLeft = rectStartX + deltaX;
                    const tlNewHeight = rectStartHeight - deltaY;
                    const tlNewWidth = rectStartWidth - deltaX;
                    if (tlNewHeight > 0 && tlNewWidth > 0) {
                        currentRectangle.style.top = tlNewTop + 'px';
                        currentRectangle.style.left = tlNewLeft + 'px';
                        currentRectangle.style.height = tlNewHeight + 'px';
                        currentRectangle.style.width = tlNewWidth + 'px';
                    }
                    break;

                case 'top-right':
                    const trNewTop = rectStartY + deltaY;
                    const trNewHeight = rectStartHeight - deltaY;
                    const trNewWidth = rectStartWidth + deltaX;
                    if (trNewHeight > 0 && trNewWidth > 0) {
                        currentRectangle.style.top = trNewTop + 'px';
                        currentRectangle.style.height = trNewHeight + 'px';
                        currentRectangle.style.width = trNewWidth + 'px';
                    }
                    break;

                case 'bottom-left':
                    const blNewLeft = rectStartX + deltaX;
                    const blNewHeight = rectStartHeight + deltaY;
                    const blNewWidth = rectStartWidth - deltaX;
                    if (blNewHeight > 0 && blNewWidth > 0) {
                        currentRectangle.style.left = blNewLeft + 'px';
                        currentRectangle.style.height = blNewHeight + 'px';
                        currentRectangle.style.width = blNewWidth + 'px';
                    }
                    break;

                case 'bottom-right':
                    const brNewWidth = rectStartWidth + deltaX;
                    const brNewHeight = rectStartHeight + deltaY;
                    if (brNewHeight > 0 && brNewWidth > 0) {
                        currentRectangle.style.width = brNewWidth + 'px';
                        currentRectangle.style.height = brNewHeight + 'px';
                    }
                    break;
            }

            baseX = parseFloat(currentRectangle.style.left);
            baseY = parseFloat(currentRectangle.style.top);
            baseWidth = parseFloat(currentRectangle.style.width);
            baseHeight = parseFloat(currentRectangle.style.height);

            updateAllDimensions();
        }
    });

    // Mouse up
    document.addEventListener('mouseup', (e) => {
        if (isDrawing) {
            const rect = canvasContainer.getBoundingClientRect();
            const endX = e.clientX - rect.left;
            const endY = e.clientY - rect.top;

            const x1 = Math.min(startX, endX);
            const y1 = Math.min(startY, endY);
            const x2 = Math.max(startX, endX);
            const y2 = Math.max(startY, endY);

            baseX = x1;
            baseY = y1;
            baseWidth = x2 - x1;
            baseHeight = y2 - y1;

            rectangleExists = true;
            currentRectangle.classList.add('complete');

            canvasContainer.classList.add('drawing-disabled');
            canvasContainer.style.cursor = 'default';

            resetBtn.disabled = false;
            zoomInBtn.disabled = currentZoom >= maxZoom;
            zoomOutBtn.disabled = currentZoom <= minZoom;

            dimensionsInfo.style.display = 'block';

            addResizeHandles();
            updateAllDimensions();

            isDrawing = false;
        }

        if (isResizing) {
            isResizing = false;
            resizingEdge = null;
            canvasContainer.style.cursor = 'default';
        }
    });

    // ========== FUNZIONI HELPER ==========

    function resetRectangle() {
        if (currentRectangle) {
            currentRectangle.remove();
        }
        currentRectangle = null;
        rectangleExists = false;
        currentZoom = 1;
        updateZoom();
        canvasContainer.classList.remove('drawing-disabled');
        canvasContainer.style.cursor = 'crosshair';
        resetBtn.disabled = true;
        zoomInBtn.disabled = true;
        zoomOutBtn.disabled = true;
        dimensionsInfo.style.display = 'none';
        baseCoordinates.innerHTML = '<p>Clicca e trascina sull\'immagine per disegnare un rettangolo</p>';
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

    function addResizeHandles() {
        const handles = ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
        handles.forEach(position => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${position}`;
            handle.dataset.edge = position;
            currentRectangle.appendChild(handle);

            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                isResizing = true;
                resizingEdge = position;
                startX = e.clientX;
                startY = e.clientY;

                rectStartX = parseFloat(currentRectangle.style.left);
                rectStartY = parseFloat(currentRectangle.style.top);
                rectStartWidth = parseFloat(currentRectangle.style.width);
                rectStartHeight = parseFloat(currentRectangle.style.height);

                canvasContainer.style.cursor = getComputedStyle(handle).cursor;
            });
        });
    }

    function updateAllDimensions() {
        if (!currentRectangle) return;

        const baseX1 = baseX;
        const baseY1 = baseY;
        const baseX2 = baseX + baseWidth;
        const baseY2 = baseY + baseHeight;

        const centerX = baseX + (baseWidth / 2);
        const centerY = baseY + (baseHeight / 2);

        const zoomedWidth = baseWidth * currentZoom;
        const zoomedHeight = baseHeight * currentZoom;

        const zoomedX1 = centerX - (zoomedWidth / 2);
        const zoomedY1 = centerY - (zoomedHeight / 2);
        const zoomedX2 = centerX + (zoomedWidth / 2);
        const zoomedY2 = centerY + (zoomedHeight / 2);

        let effectiveX1, effectiveY1, effectiveX2, effectiveY2;
        let effectiveWidth, effectiveHeight;

        if (borderPosition === 'inside') {
            effectiveX1 = zoomedX1;
            effectiveY1 = zoomedY1;
            effectiveX2 = zoomedX2;
            effectiveY2 = zoomedY2;
            effectiveWidth = zoomedWidth;
            effectiveHeight = zoomedHeight;
        } else {
            effectiveX1 = zoomedX1 - currentBorderWidth;
            effectiveY1 = zoomedY1 - currentBorderWidth;
            effectiveX2 = zoomedX2 + currentBorderWidth;
            effectiveY2 = zoomedY2 + currentBorderWidth;
            effectiveWidth = zoomedWidth + (currentBorderWidth * 2);
            effectiveHeight = zoomedHeight + (currentBorderWidth * 2);
        }

        baseCoordinates.innerHTML = `
            <strong>📍 Coordinate Base:</strong><br>
            x1 = ${Math.round(baseX1)}px, y1 = ${Math.round(baseY1)}px<br>
            x2 = ${Math.round(baseX2)}px, y2 = ${Math.round(baseY2)}px<br>
            <br>
            <strong>📏 Dimensioni Base:</strong><br>
            Larghezza: ${Math.round(baseWidth)}px<br>
            Altezza: ${Math.round(baseHeight)}px
        `;

        currentDimensions.innerHTML = `
            <strong>🔍 Con Zoom (${Math.round(currentZoom * 100)}%):</strong><br>
            Larghezza: ${Math.round(zoomedWidth)}px<br>
            Altezza: ${Math.round(zoomedHeight)}px<br>
            <br>
            <strong>🎨 Bordo ${borderPosition === 'inside' ? 'Interno' : 'Esterno'} (${currentBorderWidth}px):</strong><br>
            Larghezza Totale: ${Math.round(effectiveWidth)}px<br>
            Altezza Totale: ${Math.round(effectiveHeight)}px
        `;
    }

    // Esporta la funzione per ottenere le coordinate
    return {
        getCoordinates: () => {
            // Calcola le coordinate dei lati (x1, x2, y1, y2) con zoom
            const baseX1 = baseX;
            const baseY1 = baseY;
            const baseX2 = baseX + baseWidth;
            const baseY2 = baseY + baseHeight;

            // Applica lo zoom mantenendo il centro
            const centerX = baseX + (baseWidth / 2);
            const centerY = baseY + (baseHeight / 2);
            const zoomedWidth = baseWidth * currentZoom;
            const zoomedHeight = baseHeight * currentZoom;
            const zoomedX1 = centerX - (zoomedWidth / 2);
            const zoomedY1 = centerY - (zoomedHeight / 2);
            const zoomedX2 = centerX + (zoomedWidth / 2);
            const zoomedY2 = centerY + (zoomedHeight / 2);

            // Applica il bordo
            let effectiveX1 = zoomedX1;
            let effectiveY1 = zoomedY1;
            let effectiveX2 = zoomedX2;
            let effectiveY2 = zoomedY2;

            if (borderPosition === 'outside') {
                // Se il bordo è esterno, espandi le coordinate
                effectiveX1 = Math.max(0, zoomedX1 - currentBorderWidth);
                effectiveY1 = Math.max(0, zoomedY1 - currentBorderWidth);
                effectiveX2 = zoomedX2 + currentBorderWidth;
                effectiveY2 = zoomedY2 + currentBorderWidth;
            } else {
                // Se il bordo è interno, restringe le coordinate
                effectiveX1 = zoomedX1 + currentBorderWidth;
                effectiveY1 = zoomedY1 + currentBorderWidth;
                effectiveX2 = Math.max(effectiveX1 + 1, zoomedX2 - currentBorderWidth);
                effectiveY2 = Math.max(effectiveY1 + 1, zoomedY2 - currentBorderWidth);
            }

            return {
                x1: Math.round(effectiveX1),
                y1: Math.round(effectiveY1),
                x2: Math.round(effectiveX2),
                y2: Math.round(effectiveY2),
                zoom: currentZoom,
                borderWidth: currentBorderWidth,
                borderPosition: borderPosition,
            };
        },
        getState: () => ({
            exists: rectangleExists,
            baseX, baseY, baseWidth, baseHeight,
            zoom: currentZoom,
            borderWidth: currentBorderWidth,
            borderPosition
        })
    };
}

window.CanvasSelector = { initializeCanvasSelector };
