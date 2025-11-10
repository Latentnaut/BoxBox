/**
 * Region Selector Extension - Integrazione nativa con ComfyUI Dialog
 * Mantiene il bottone nel nodo e apre un dialog nativo
 */

import { app } from "../../scripts/app.js";
import { ComfyDialog } from "../../scripts/ui.js";

console.log("[RegionSelectorExt] Loading extension...");

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
    let currentBorderWidth = 0;
    let borderPosition = 'inside';
    let rectangleExists = false;

    // Dimensioni base
    let baseWidth = 0;
    let baseHeight = 0;
    let baseX = 0;
    let baseY = 0;

    const defaultBorderWidth = 3;

    // Carica l'immagine iniziale
    if (imageUrl) {
        backgroundImage.src = imageUrl;
        const filename = imageUrl.split('/').pop();
        imageName.textContent = `Image: ${filename}`;
    }

    // Disabilita drag dell'immagine
    backgroundImage.addEventListener('dragstart', (e) => e.preventDefault());
    backgroundImage.style.userSelect = 'none';
    canvasContainer.style.cursor = 'crosshair';

    // Border slider - removed from UI, using default values
    // currentBorderWidth = defaultBorderWidth (already set to 3)

    // Border position - removed from UI, using default 'inside'
    // borderPosition = 'inside' (already set)

    // Reset button
    resetBtn.addEventListener('click', () => {
        if (confirm('Clear selection and draw a new one?')) {
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

    function resetRectangle() {
        if (currentRectangle) {
            currentRectangle.remove();
        }
        currentRectangle = null;
        rectangleExists = false;
        canvasContainer.classList.remove('drawing-disabled');
        canvasContainer.style.cursor = 'crosshair';
        resetBtn.disabled = true;
        dimensionsInfo.style.display = 'none';
        baseCoordinates.innerHTML = '<p>Click and drag to select</p>';
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

        baseCoordinates.innerHTML = `
            <strong>📍 Coordinates:</strong><br>
            x1 = ${Math.round(baseX1)}px, y1 = ${Math.round(baseY1)}px<br>
            x2 = ${Math.round(baseX2)}px, y2 = ${Math.round(baseY2)}px<br>
            <br>
            <strong>📏 Size:</strong><br>
            Width: ${Math.round(baseWidth)}px<br>
            Height: ${Math.round(baseHeight)}px
        `;
    }

    return {
        getCoordinates: () => {
            const baseX1 = baseX;
            const baseY1 = baseY;
            const baseX2 = baseX + baseWidth;
            const baseY2 = baseY + baseHeight;

            let effectiveX1 = baseX1;
            let effectiveY1 = baseY1;
            let effectiveX2 = baseX2;
            let effectiveY2 = baseY2;

            if (borderPosition === 'outside') {
                effectiveX1 = Math.max(0, baseX1 - currentBorderWidth);
                effectiveY1 = Math.max(0, baseY1 - currentBorderWidth);
                effectiveX2 = baseX2 + currentBorderWidth;
                effectiveY2 = baseY2 + currentBorderWidth;
            } else {
                effectiveX1 = baseX1 + currentBorderWidth;
                effectiveY1 = baseY1 + currentBorderWidth;
                effectiveX2 = Math.max(effectiveX1 + 1, baseX2 - currentBorderWidth);
                effectiveY2 = Math.max(effectiveY1 + 1, baseY2 - currentBorderWidth);
            }

            return {
                x1: Math.round(effectiveX1),
                y1: Math.round(effectiveY1),
                x2: Math.round(effectiveX2),
                y2: Math.round(effectiveY2),
                borderWidth: currentBorderWidth,
                borderPosition: borderPosition,
            };
        },
        getState: () => ({
            exists: rectangleExists,
            baseX, baseY, baseWidth, baseHeight,
            borderWidth: currentBorderWidth,
            borderPosition
        })
    };
}

window.CanvasSelector = { initializeCanvasSelector };

app.registerExtension({
    name: "BoxBox.BoxSelectorExtension",

    async setup(app) {
        console.log("[RegionSelectorExt] Setup called");
    },

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "BoxSelector") return;

        console.log("[RegionSelectorExt] Registering BoxSelector...");

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated?.apply(this, arguments);
            const node = this;

            console.log("[RegionSelectorExt] Node created, adding button...");

            // Aggiungi bottone nativo ComfyUI
            this.addWidget("button", "📦 Select Box", null, () => {
                openRegionDialog(node, app);
            });

            return r;
        };
    },
});

/**
 * Apre il dialog del selettore di regioni
 */
async function openRegionDialog(node, app) {
    console.log("[RegionSelectorExt] Opening dialog...");
    console.log("[RegionSelectorExt] Node inputs:", node.inputs);
    console.log("[RegionSelectorExt] Node widgets:", node.widgets);

    let imageName = null;
    let imageUrl = null;

    // Metodo 1: Se c'è un input collegato
    if (node.inputs && node.inputs[0] && node.inputs[0].link !== undefined && node.inputs[0].link !== null) {
        const imageInput = node.inputs[0];
        const link = app.graph.links[imageInput.link];

        if (link) {
            const sourceNode = app.graph._nodes_by_id[link.origin_id];
            console.log("[RegionSelectorExt] Source node found:", sourceNode);

            // Esegui il nodo sorgente per ottenere l'immagine
            try {
                await executeSourceNode(sourceNode, app);

                // Dopo l'esecuzione, prova a prendere il filename dal nodo sorgente
                if (sourceNode.widgets) {
                    const filenameWidget = sourceNode.widgets.find(w => w.name === "image");
                    if (filenameWidget && filenameWidget.value) {
                        imageName = filenameWidget.value;
                        console.log("[RegionSelectorExt] Image from source node:", imageName);
                    }
                }
            } catch (e) {
                console.error("[RegionSelectorExt] Error executing source node:", e);
            }
        }
    }

    // Metodo 2: Prova a prendere l'immagine dal widget del nodo stesso
    if (!imageName) {
        const imageWidget = node.widgets?.find((w) => w.name === "image");
        if (imageWidget && imageWidget.value) {
            imageName = imageWidget.value;
            console.log("[RegionSelectorExt] Image from widget:", imageName);
        }
    }

    if (!imageName) {
        alert("⚠️ Nessuna immagine collegata al nodo!\n\nCollega un'immagine dal nodo LoadImage.");
        return;
    }

    imageUrl = `/view?filename=${imageName}&type=input`;
    console.log("[RegionSelectorExt] Image URL:", imageUrl);

    // Crea il dialog
    const dialog = new ComfyDialog();
    dialog.element.style.width = "95vw";
    dialog.element.style.height = "95vh";
    dialog.element.style.maxWidth = "none";
    dialog.element.style.maxHeight = "none";

    // Crea il contenitore HTML
    const container = document.createElement("div");
    container.style.cssText = `
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        background: white;
    `;

    // Aggiungi CSS per il rettangolo e i resize handles
    const styleTag = document.createElement("style");
    styleTag.textContent = `
        .rectangle {
            position: absolute;
            background-color: rgba(37, 99, 235, 0.05);
            cursor: move;
            transition: none;
            z-index: 10;
        }

        .rectangle.border-inside {
            border: 3px solid #2563eb;
        }

        .rectangle.border-outside {
            outline: 3px solid #2563eb;
            outline-offset: 0px;
        }

        .rectangle.thick-border {
            box-shadow: 0 0 8px rgba(37, 99, 235, 0.3);
        }

        .resize-handle {
            position: absolute;
            background-color: #2563eb;
            z-index: 20;
            opacity: 0.7;
            transition: opacity 0.2s;
        }

        .resize-handle:hover {
            opacity: 1;
            box-shadow: 0 0 6px rgba(37, 99, 235, 0.8);
        }

        .resize-handle.top,
        .resize-handle.bottom {
            width: 100%;
            height: 8px;
            cursor: ns-resize;
        }

        .resize-handle.top {
            top: -4px;
            left: 0;
        }

        .resize-handle.bottom {
            bottom: -4px;
            left: 0;
        }

        .resize-handle.left,
        .resize-handle.right {
            width: 8px;
            height: 100%;
            cursor: ew-resize;
        }

        .resize-handle.left {
            left: -4px;
            top: 0;
        }

        .resize-handle.right {
            right: -4px;
            top: 0;
        }

        .resize-handle.top-left,
        .resize-handle.bottom-right {
            width: 12px;
            height: 12px;
            cursor: nwse-resize;
        }

        .resize-handle.top-left {
            top: -6px;
            left: -6px;
            border-radius: 50%;
        }

        .resize-handle.bottom-right {
            bottom: -6px;
            right: -6px;
            border-radius: 50%;
        }

        .resize-handle.top-right,
        .resize-handle.bottom-left {
            width: 12px;
            height: 12px;
            cursor: nesw-resize;
        }

        .resize-handle.top-right {
            top: -6px;
            right: -6px;
            border-radius: 50%;
        }

        .resize-handle.bottom-left {
            bottom: -6px;
            left: -6px;
            border-radius: 50%;
        }

        #canvas-container.drawing-disabled {
            cursor: default !important;
        }
    `;
    document.head.appendChild(styleTag);

    // Carica l'HTML del selettore
    const innerHtml = `
        <div class="selector-container" style="height: 100%; display: flex; flex-direction: column;">
            <!-- Header -->
            <div class="selector-header" style="
                position: relative;
                padding: 20px 25px;
                background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
                color: white;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            ">
                <h1 style="font-size: 24px; margin: 0 0 5px 0; font-weight: 700;">📦 Box Selector</h1>
                <p style="font-size: 13px; opacity: 0.9; margin: 0;">Click and drag on the image to select a box</p>
            </div>

            <!-- Main Content -->
            <div class="selector-content" style="display: flex; flex: 1; overflow: hidden;">
                <!-- Control Panel -->
                <div class="control-panel" style="
                    width: 320px;
                    background-color: #ffffff;
                    overflow-y: auto;
                    padding: 20px;
                ">
                    <h3 style="font-size: 16px; margin-bottom: 15px; font-weight: 600;">Controls</h3>

                    <!-- Image info -->
                    <div class="control-group" style="margin-bottom: 20px;">
                        <small id="image-name" style="display: block; font-size: 12px; color: #64748b;">Image: ${imageName}</small>
                    </div>


                    <!-- Reset Button -->
                    <button id="reset-btn" class="btn" disabled style="
                        background-color: #64748b;
                        color: white;
                        border: 1px solid #64748b;
                        width: 100%;
                        padding: 8px 12px;
                        border-radius: 6px;
                        font-size: 13px;
                        font-weight: 500;
                        cursor: pointer;
                        opacity: 0.5;
                        margin-bottom: 20px;
                    ">🔄 Clear Selection</button>

                    <!-- Coordinates Info -->
                    <div id="coordinates-info">
                        <h4 style="font-size: 13px; margin-bottom: 10px; font-weight: 600; text-transform: uppercase;">Selection</h4>
                        <div id="base-coordinates" style="
                            background-color: transparent;
                            padding: 12px;
                            border-radius: 6px;
                            font-family: monospace;
                            font-size: 12px;
                            margin-bottom: 10px;
                        ">
                            <p style="margin: 0;">Click and drag to select</p>
                        </div>
                        <div id="current-dimensions" style="
                            background-color: transparent;
                            padding: 12px;
                            border-radius: 6px;
                            font-family: monospace;
                            font-size: 12px;
                            display: none;
                        "></div>
                    </div>

                    <!-- Dimensions Info -->
                    <div id="dimensions-info" style="display: none; margin-top: 10px;"></div>
                </div>

                <!-- Canvas Area -->
                <div class="canvas-area" style="
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #fafbfc;
                    overflow: hidden;
                    position: relative;
                ">
                    <div id="canvas-container" style="
                        position: relative;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        background-color: white;
                        border-radius: 8px;
                        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
                        overflow: hidden;
                        max-width: 90%;
                        max-height: 90%;
                    ">
                        <img src="${imageUrl}" alt="Region Selector" id="background-image" style="
                            display: block;
                            max-width: 100%;
                            max-height: 100%;
                            user-select: none;
                        ">
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = innerHtml;
    dialog.element.appendChild(container);

    // Aggiungi i pulsanti d'azione
    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = "✅ Confirm";
    confirmBtn.style.cssText = `
        background-color: #16a34a;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        margin-right: 10px;
    `;

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "❌ Cancel";
    cancelBtn.style.cssText = `
        background-color: #dc2626;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
    `;

    // Il confirmBtn.onclick sarà impostato dopo l'inizializzazione del canvas_selector
    confirmBtn.onclick = () => {
        console.log("[RegionSelectorExt] Confirm button clicked but CanvasSelector not ready yet");
        alert("Per favore aspetta che il selettore sia caricato");
    };

    cancelBtn.onclick = () => {
        console.log("[RegionSelectorExt] Dialog cancelled");
        dialog.close();
    };

    dialog.show(confirmBtn, cancelBtn);

    // Inizializza il selettore dopo che il DOM è renderizzato
    setTimeout(() => {
        // Carica canvas_selector.js se non è già caricato
        let attempts = 0;
        const waitForCanvasSelector = setInterval(() => {
            attempts++;
            if (window.CanvasSelector) {
                clearInterval(waitForCanvasSelector);
                const selector = window.CanvasSelector.initializeCanvasSelector(container, imageUrl);

                // Aggiorna il confirm button per usare le coordinate reali
                confirmBtn.onclick = () => {
                    const coords = selector.getCoordinates();

                    // Cerca il widget region_metadata tra i widget del nodo
                    // ComfyUI lo crea automaticamente dal INPUT_TYPES opzionale
                    let metadataWidget = node.widgets?.find((w) => w.name === "region_metadata");

                    if (metadataWidget) {
                        const metadata = JSON.stringify({
                            ...coords,
                            selected: true
                        });
                        metadataWidget.value = metadata;
                        if (metadataWidget.callback) {
                            metadataWidget.callback(metadata);
                        }
                        console.log("[RegionSelectorExt] Metadata widget updated with:", metadata);
                    } else {
                        console.warn("[RegionSelectorExt] region_metadata widget not found. Available widgets:", node.widgets?.map(w => w.name) || []);
                    }

                    console.log("[RegionSelectorExt] Coordinates saved:", coords);
                    dialog.close();
                };
                console.log("[RegionSelectorExt] CanvasSelector initialized successfully");
            } else if (attempts > 50) {
                clearInterval(waitForCanvasSelector);
                console.error("[RegionSelectorExt] CanvasSelector failed to load after 5 seconds");
                alert("Error: Box Selector failed to load. Check browser console for details.");
            }
        }, 100);
    }, 200);
}

/**
 * Esegue il nodo sorgente per ottenere l'immagine
 */
async function executeSourceNode(sourceNode, app) {
    try {
        // Se il nodo sorgente è LoadImage, il widget "image" contiene il filename
        const imageWidget = sourceNode.widgets?.find(w => w.name === "image");
        if (imageWidget && imageWidget.value) {
            console.log("[RegionSelectorExt] Found image in source node:", imageWidget.value);
            return imageWidget.value;
        }
    } catch (e) {
        console.error("[RegionSelectorExt] Error in executeSourceNode:", e);
    }
}

console.log("[RegionSelectorExt] Extension loaded!");
