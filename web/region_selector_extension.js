// BoxBox Extension - Modern ComfyUI v1.0 / v0.12.2+
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

console.log("[BoxBox] Loading extension (Modern API)...");

/**
 * Canvas Selector - Funzionalità complete di selezione rettangoli
 * Basato sul codice di canva_html
 */

function initializeCanvasSelector(container, imageUrl, previousMetadata = null) {
    console.log("[CanvasSelector] Initializing with image:", imageUrl);
    console.log("[CanvasSelector] Previous metadata:", previousMetadata);

    // DOM element references (searched within container)
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

    // State variables
    let isDrawing = false;
    let isResizing = false;
    let isDragging = false;
    let resizingEdge = null;
    let startX = 0;
    let startY = 0;
    let rectStartX = 0;
    let rectStartY = 0;
    let rectStartWidth = 0;
    let rectStartHeight = 0;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let currentRectangle = null;
    let currentBorderWidth = 0;
    let borderPosition = 'inside';
    let rectangleExists = false;

    // Base dimensions
    let baseWidth = 0;
    let baseHeight = 0;
    let baseX = 0;
    let baseY = 0;

    // Aspect Ratio Mode
    let aspectRatioMode = "free";        // "free" or specific ratio (e.g. "16:9")
    let aspectRatioValue = null;         // Numeric value (e.g. 16/9 = 1.777)

    // Fix Image Size - state tracking
    let displayScaleFactor = 1.0;  // Scale factor applied to preview
    let isImageFixed = false;       // True when image has been "fixed"

    const defaultBorderWidth = 3;

    // ========================================================
    // Backend image scaling for images > 1024px
    // ========================================================
    if (imageUrl) {
        // Parse URL parameters
        try {
            // Create a dummy base URL to handle relative URLs comfortably
            const checkUrl = new URL(imageUrl, document.baseURI);
            const params = new URLSearchParams(checkUrl.search);

            const filename = params.get("filename");
            const type = params.get("type") || "input";
            const subfolder = params.get("subfolder") || "";

            if (filename) {
                console.log(`[BoxBox] Requesting scale for: ${filename} (type: ${type}, subfolder: ${subfolder})`);

                // Use direct fetch with robust configuration
                fetch("/region_selector/scale", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify({
                        filename: String(filename),
                        type: String(type),
                        subfolder: String(subfolder)
                    })
                })
                    .then(async res => {
                        if (!res.ok) {
                            const errText = await res.text();
                            throw new Error(`Server returned ${res.status}: ${errText}`);
                        }
                        return res.json();
                    })
                    .then(data => {
                        if (data.path) {
                            let scaledPath = data.path;
                            // Ensure path is correctly converted for ComfyUI API
                            if (window.comfyAPI && window.comfyAPI.api) {
                                try {
                                    scaledPath = window.comfyAPI.api.api.apiURL(data.path);
                                } catch (e) { }
                            }

                            backgroundImage.src = scaledPath;
                            backgroundImage.dataset.scaleFactor = data.scale || 1;
                            backgroundImage.dataset.scaled = data.scaled || false;
                            console.log(`[BoxBox] Image loaded - Scale: ${data.scale || 1}`);
                        } else if (data.error) {
                            console.warn(`[BoxBox] Scale error: ${data.error}, using original`);
                            backgroundImage.src = imageUrl;
                        }
                        imageName.textContent = `Image: ${filename}`;
                    })
                    .catch(e => {
                        console.error("[BoxBox] Error in scale fetch:", e);
                        backgroundImage.src = imageUrl;
                        imageName.textContent = `Image: ${filename}`;
                    });
            } else {
                // Fallback for when filename param is missing
                console.log("[RegionSelectorExt] No filename param, using imageUrl directly");
                backgroundImage.src = imageUrl;
            }
        } catch (e) {
            console.error("[RegionSelectorExt] URL parsing error:", e);
            backgroundImage.src = imageUrl;
        }
    }

    // Disable image drag
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

    // Aspect Ratio Mode Selector
    const aspectRatioSelect = container.querySelector('#aspect-ratio-select');
    const aspectRatioHint = container.querySelector('#aspect-ratio-hint');

    // Load saved aspect ratio from localStorage
    const savedAspectRatio = localStorage.getItem('boxSelector_aspectRatio');
    if (savedAspectRatio && aspectRatioSelect) {
        aspectRatioSelect.value = savedAspectRatio;
        aspectRatioMode = savedAspectRatio;
        console.log(`[RegionSelectorExt] Loaded saved aspect ratio: ${savedAspectRatio}`);
    }

    if (aspectRatioSelect) {
        aspectRatioSelect.addEventListener('change', (e) => {
            aspectRatioMode = e.target.value;

            // Save to localStorage
            localStorage.setItem('boxSelector_aspectRatio', aspectRatioMode);
            console.log(`[RegionSelectorExt] Saved aspect ratio: ${aspectRatioMode}`);

            // Calculate numeric value
            const ratioMap = {
                "free": null,
                "1:1": 1 / 1,
                "3:4": 3 / 4,
                "5:8": 5 / 8,
                "9:16": 9 / 16,
                "9:21": 9 / 21,
                "4:3": 4 / 3,
                "3:2": 3 / 2,
                "16:9": 16 / 9,
                "21:9": 21 / 9,
            };

            aspectRatioValue = ratioMap[aspectRatioMode];

            // Update hint
            if (aspectRatioMode === "free") {
                aspectRatioHint.textContent = "Free draw — ratio calculated after";
                aspectRatioHint.style.color = "#6b7280";
                aspectRatioHint.style.fontWeight = "normal";
            } else {
                aspectRatioHint.textContent = `Constrained to ${aspectRatioMode}`;
                aspectRatioHint.style.color = "#818cf8";
                aspectRatioHint.style.fontWeight = "600";
            }

            console.log(`[AspectRatio] Mode: ${aspectRatioMode}, Value: ${aspectRatioValue}`);

            // If a rectangle exists and we switch to constrained mode, adjust it
            if (rectangleExists && aspectRatioValue !== null) {
                adjustRectangleToAspectRatio();
            }
        });

        // Initialize aspectRatioValue and hint based on loaded or default value
        const ratioMap = {
            "free": null,
            "1:1": 1 / 1,
            "3:4": 3 / 4,
            "5:8": 5 / 8,
            "9:16": 9 / 16,
            "9:21": 9 / 21,
            "4:3": 4 / 3,
            "3:2": 3 / 2,
            "16:9": 16 / 9,
            "21:9": 21 / 9,
        };
        aspectRatioValue = ratioMap[aspectRatioMode];

        if (aspectRatioMode === "free") {
            aspectRatioHint.textContent = "Disegno libero - il ratio verrà calcolato";
            aspectRatioHint.style.color = "#64748b";
            aspectRatioHint.style.fontWeight = "normal";
        } else {
            aspectRatioHint.textContent = `Rettangolo vincolato a ${aspectRatioMode}`;
            aspectRatioHint.style.color = "#16a34a";
            aspectRatioHint.style.fontWeight = "600";
        }
        console.log(`[AspectRatio] Initialized - Mode: ${aspectRatioMode}, Value: ${aspectRatioValue}`);
    }

    // ========================================================
    // FIX IMAGE SIZE - DYNAMIC BUTTON
    // ========================================================
    function createFixImageButton() {
        // Button removed - scale is applied automatically
        // Nothing to do here
        console.log('[FixImage] Scale auto-applied, no button needed');
    }

    function fixImageScale() {
        const naturalW = backgroundImage.naturalWidth;
        const naturalH = backgroundImage.naturalHeight;
        const maxDim = 1024;

        const maxCurrent = Math.max(naturalW, naturalH);

        if (maxCurrent <= maxDim) {
            console.log("[FixImage] Image is already small enough, no scaling needed");
            return;
        }

        displayScaleFactor = maxDim / maxCurrent;
        const newW = Math.round(naturalW * displayScaleFactor);
        const newH = Math.round(naturalH * displayScaleFactor);

        console.log(`[FixImage] Scaling ${naturalW}x${naturalH} → ${newW}x${newH}`);

        backgroundImage.style.width = `${newW}px`;
        backgroundImage.style.height = `${newH}px`;
        backgroundImage.style.maxWidth = 'none';
        backgroundImage.style.maxHeight = 'none';

        isImageFixed = true;
        const fixImageBtn = container.querySelector('#fix-image-btn');
        if (fixImageBtn) {
            fixImageBtn.textContent = "🔄 Reset Scale";
            fixImageBtn.classList.remove('btn-primary');
            fixImageBtn.classList.add('btn-warning');
        }

        const scaleInfo = container.querySelector('#scale-info');
        if (scaleInfo) {
            const scalePercent = (displayScaleFactor * 100).toFixed(1);
            scaleInfo.innerHTML = `
                <p><strong>📊 Preview Scale:</strong> ${scalePercent}%</p>
                <p><strong>🖼️ Display Size:</strong> ${newW} × ${newH} px</p>
                <p><strong>📐 Original Size:</strong> ${naturalW} × ${naturalH} px</p>
                <p style="color: #16a34a; font-weight: 600; margin-top: 8px;">✓ Selezione fluida attiva</p>
            `;
            scaleInfo.style.display = 'block';
        }
    }

    function resetImageScale() {
        displayScaleFactor = 1.0;
        console.log("[FixImage] Resetting to original scale");

        backgroundImage.style.width = 'auto';
        backgroundImage.style.height = 'auto';
        backgroundImage.style.maxWidth = '100%';
        backgroundImage.style.maxHeight = '100%';

        isImageFixed = false;
        const fixImageBtn = container.querySelector('#fix-image-btn');
        if (fixImageBtn) {
            fixImageBtn.textContent = "⚡ Fix Image Size";
            fixImageBtn.classList.remove('btn-warning');
            fixImageBtn.classList.add('btn-primary');
        }

        const scaleInfo = container.querySelector('#scale-info');
        if (scaleInfo) {
            scaleInfo.style.display = 'none';
        }
    }

    // Auto-fix image if large (> 1024px)
    setTimeout(() => {
        const naturalW = backgroundImage.naturalWidth;
        const naturalH = backgroundImage.naturalHeight;
        const maxDim = Math.max(naturalW, naturalH);

        console.log(`[FixImage] Image size: ${naturalW}x${naturalH}, max: ${maxDim}`);

        if (maxDim > 1024) {
            console.log('[FixImage] Large image detected, creating button and auto-fixing scale...');
            createFixImageButton();
            // Apply scale automatically
            setTimeout(() => {
                fixImageScale();
            }, 100);
        }
    }, 500);

    // Restore previous selection if metadata exists
    if (previousMetadata) {
        setTimeout(() => {
            try {
                const metadata = JSON.parse(previousMetadata);
                const scaleFactor = parseFloat(backgroundImage.dataset.scaleFactor || "1");

                // Check if we have valid coordinates
                if (metadata.x1 !== undefined && metadata.y1 !== undefined &&
                    metadata.x2 !== undefined && metadata.y2 !== undefined &&
                    metadata.selected) {

                    console.log("[CanvasSelector] Restoring previous selection:", metadata);

                    // Coordinates in metadata are in display space, use them directly
                    const x1 = metadata.x1;
                    const y1 = metadata.y1;
                    const x2 = metadata.x2;
                    const y2 = metadata.y2;

                    // Calculate base position and size
                    baseX = Math.min(x1, x2);
                    baseY = Math.min(y1, y2);
                    baseWidth = Math.abs(x2 - x1);
                    baseHeight = Math.abs(y2 - y1);

                    // Create the rectangle
                    currentRectangle = document.createElement('div');
                    currentRectangle.className = 'rectangle complete';

                    if (borderPosition === 'outside') {
                        currentRectangle.classList.add('border-outside');
                        currentRectangle.style.outlineWidth = currentBorderWidth + 'px';
                        currentRectangle.style.outlineStyle = 'solid';
                        currentRectangle.style.borderWidth = '0px';
                    } else {
                        currentRectangle.classList.add('border-inside');
                        currentRectangle.style.borderWidth = currentBorderWidth + 'px';
                    }

                    currentRectangle.style.left = baseX + 'px';
                    currentRectangle.style.top = baseY + 'px';
                    currentRectangle.style.width = baseWidth + 'px';
                    currentRectangle.style.height = baseHeight + 'px';

                    canvasContainer.appendChild(currentRectangle);
                    rectangleExists = true;
                    canvasContainer.classList.add('drawing-disabled');
                    canvasContainer.style.cursor = 'default';
                    resetBtn.disabled = false;
                    dimensionsInfo.style.display = 'block';

                    addResizeHandles();
                    updateAllDimensions();

                    console.log("[CanvasSelector] Previous selection restored successfully");
                }
            } catch (e) {
                console.warn("[CanvasSelector] Failed to restore previous selection:", e);
            }
        }, 600); // Wait a bit longer than the auto-fix to ensure everything is ready
    }

    // Mouse down - start drawing or dragging
    canvasContainer.addEventListener('mousedown', (e) => {
        // If rectangle exists and clicked on it (not a handle), start drag
        if (rectangleExists && e.target === currentRectangle) {
            isDragging = true;
            const rect = canvasContainer.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            dragOffsetX = mouseX - parseFloat(currentRectangle.style.left);
            dragOffsetY = mouseY - parseFloat(currentRectangle.style.top);
            canvasContainer.style.cursor = 'grab';
            return;
        }

        if (rectangleExists) return;
        if (e.target.classList.contains('resize-handle')) return;

        const rect = canvasContainer.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;

        isDrawing = true;

        currentRectangle = document.createElement('div');
        currentRectangle.className = 'rectangle';

        // Keep the aspect ratio locked if it was set
        // (removed auto-reset to 'free' mode so it remembers user preference)


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
        // Rectangle drag
        if (isDragging && currentRectangle) {
            const rect = canvasContainer.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            let newLeft = mouseX - dragOffsetX;
            let newTop = mouseY - dragOffsetY;

            // Constrain rectangle within canvas
            const maxLeft = rect.width - parseFloat(currentRectangle.style.width);
            const maxTop = rect.height - parseFloat(currentRectangle.style.height);

            newLeft = Math.max(0, Math.min(newLeft, maxLeft));
            newTop = Math.max(0, Math.min(newTop, maxTop));

            currentRectangle.style.left = newLeft + 'px';
            currentRectangle.style.top = newTop + 'px';

            baseX = newLeft;
            baseY = newTop;

            updateAllDimensions();
            canvasContainer.style.cursor = 'grabbing';
            return;
        }

        if (isDrawing) {
            const rect = canvasContainer.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;

            let width = currentX - startX;
            let height = currentY - startY;

            // ⚙️ APPLICA VINCOLO SE NECESSARIO
            if (aspectRatioValue !== null) {
                // Constrained mode: force aspect ratio
                if (Math.abs(width) / aspectRatioValue > Math.abs(height)) {
                    height = (Math.abs(width) / aspectRatioValue) * (height < 0 ? -1 : 1);
                } else {
                    width = (Math.abs(height) * aspectRatioValue) * (width < 0 ? -1 : 1);
                }
            }

            baseWidth = Math.abs(width);
            baseHeight = Math.abs(height);

            if (width < 0) {
                currentRectangle.style.left = (currentX + width) + 'px';
                currentRectangle.style.width = Math.abs(width) + 'px';
            } else {
                currentRectangle.style.width = width + 'px';
            }

            if (height < 0) {
                currentRectangle.style.top = (currentY + height) + 'px';
                currentRectangle.style.height = Math.abs(height) + 'px';
            } else {
                currentRectangle.style.height = height + 'px';
            }

            updateAllDimensions();
        }

        if (isResizing && currentRectangle) {
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            switch (resizingEdge) {
                case 'bottom-right':
                    let brNewWidth = rectStartWidth + deltaX;
                    let brNewHeight = rectStartHeight + deltaY;

                    // ⚙️ APPLICA VINCOLO SE NECESSARIO
                    if (aspectRatioValue !== null) {
                        if (brNewWidth / aspectRatioValue > brNewHeight) {
                            brNewHeight = brNewWidth / aspectRatioValue;
                        } else {
                            brNewWidth = brNewHeight * aspectRatioValue;
                        }
                    }

                    if (brNewHeight > 0 && brNewWidth > 0) {
                        currentRectangle.style.width = brNewWidth + 'px';
                        currentRectangle.style.height = brNewHeight + 'px';
                        baseWidth = brNewWidth;
                        baseHeight = brNewHeight;
                    }
                    break;

                case 'bottom-left':
                    let blNewLeft = rectStartX + deltaX;
                    let blNewHeight = rectStartHeight + deltaY;
                    let blNewWidth = rectStartWidth - deltaX;

                    // ⚙️ APPLICA VINCOLO SE NECESSARIO
                    if (aspectRatioValue !== null) {
                        if (blNewWidth / aspectRatioValue > blNewHeight) {
                            blNewHeight = blNewWidth / aspectRatioValue;
                        } else {
                            blNewWidth = blNewHeight * aspectRatioValue;
                            blNewLeft = rectStartX + (rectStartWidth - blNewWidth);
                        }
                    }

                    if (blNewHeight > 0 && blNewWidth > 0) {
                        currentRectangle.style.left = blNewLeft + 'px';
                        currentRectangle.style.height = blNewHeight + 'px';
                        currentRectangle.style.width = blNewWidth + 'px';
                        baseX = blNewLeft;
                        baseWidth = blNewWidth;
                        baseHeight = blNewHeight;
                    }
                    break;

                case 'top-right':
                    let trNewTop = rectStartY + deltaY;
                    let trNewHeight = rectStartHeight - deltaY;
                    let trNewWidth = rectStartWidth + deltaX;

                    // ⚙️ APPLICA VINCOLO SE NECESSARIO
                    if (aspectRatioValue !== null) {
                        if (trNewWidth / aspectRatioValue > trNewHeight) {
                            trNewHeight = trNewWidth / aspectRatioValue;
                            trNewTop = rectStartY + (rectStartHeight - trNewHeight);
                        } else {
                            trNewWidth = trNewHeight * aspectRatioValue;
                        }
                    }

                    if (trNewHeight > 0 && trNewWidth > 0) {
                        currentRectangle.style.top = trNewTop + 'px';
                        currentRectangle.style.height = trNewHeight + 'px';
                        currentRectangle.style.width = trNewWidth + 'px';
                        baseY = trNewTop;
                        baseWidth = trNewWidth;
                        baseHeight = trNewHeight;
                    }
                    break;

                case 'top-left':
                    let tlNewTop = rectStartY + deltaY;
                    let tlNewLeft = rectStartX + deltaX;
                    let tlNewHeight = rectStartHeight - deltaY;
                    let tlNewWidth = rectStartWidth - deltaX;

                    // ⚙️ APPLICA VINCOLO SE NECESSARIO
                    if (aspectRatioValue !== null) {
                        if (tlNewWidth / aspectRatioValue > tlNewHeight) {
                            tlNewHeight = tlNewWidth / aspectRatioValue;
                            tlNewTop = rectStartY + (rectStartHeight - tlNewHeight);
                        } else {
                            tlNewWidth = tlNewHeight * aspectRatioValue;
                            tlNewLeft = rectStartX + (rectStartWidth - tlNewWidth);
                        }
                    }

                    if (tlNewHeight > 0 && tlNewWidth > 0) {
                        currentRectangle.style.top = tlNewTop + 'px';
                        currentRectangle.style.left = tlNewLeft + 'px';
                        currentRectangle.style.height = tlNewHeight + 'px';
                        currentRectangle.style.width = tlNewWidth + 'px';
                        baseX = tlNewLeft;
                        baseY = tlNewTop;
                        baseWidth = tlNewWidth;
                        baseHeight = tlNewHeight;
                    }
                    break;

                case 'right':
                    let rightWidth = rectStartWidth + deltaX;
                    let rightHeight = rightWidth / aspectRatioValue || rectStartHeight;

                    // ⚙️ APPLICA VINCOLO SE NECESSARIO
                    if (aspectRatioValue !== null) {
                        rightHeight = rightWidth / aspectRatioValue;
                    }

                    if (rightWidth > 0) {
                        currentRectangle.style.width = rightWidth + 'px';
                        if (aspectRatioValue !== null && rightHeight > 0) {
                            currentRectangle.style.height = rightHeight + 'px';
                            baseWidth = rightWidth;
                            baseHeight = rightHeight;
                        }
                    }
                    break;

                case 'left':
                    let newLeft = rectStartX + deltaX;
                    let newWidth = rectStartWidth - deltaX;
                    let newHeight = newWidth / aspectRatioValue || rectStartHeight;

                    // ⚙️ APPLICA VINCOLO SE NECESSARIO
                    if (aspectRatioValue !== null) {
                        newHeight = newWidth / aspectRatioValue;
                    }

                    if (newWidth > 0) {
                        currentRectangle.style.left = newLeft + 'px';
                        currentRectangle.style.width = newWidth + 'px';
                        if (aspectRatioValue !== null && newHeight > 0) {
                            currentRectangle.style.height = newHeight + 'px';
                            baseX = newLeft;
                            baseWidth = newWidth;
                            baseHeight = newHeight;
                        }
                    }
                    break;

                case 'bottom':
                    let bottomHeight = rectStartHeight + deltaY;
                    let bottomWidth = bottomHeight * aspectRatioValue || rectStartWidth;

                    // ⚙️ APPLICA VINCOLO SE NECESSARIO
                    if (aspectRatioValue !== null) {
                        bottomWidth = bottomHeight * aspectRatioValue;
                    }

                    if (bottomHeight > 0) {
                        currentRectangle.style.height = bottomHeight + 'px';
                        if (aspectRatioValue !== null && bottomWidth > 0) {
                            currentRectangle.style.width = bottomWidth + 'px';
                            baseWidth = bottomWidth;
                            baseHeight = bottomHeight;
                        }
                    }
                    break;

                case 'top':
                    let newTop = rectStartY + deltaY;
                    let topNewHeight = rectStartHeight - deltaY;
                    let topNewWidth = topNewHeight * aspectRatioValue || rectStartWidth;

                    // ⚙️ APPLICA VINCOLO SE NECESSARIO
                    if (aspectRatioValue !== null) {
                        topNewWidth = topNewHeight * aspectRatioValue;
                    }

                    if (topNewHeight > 0) {
                        currentRectangle.style.top = newTop + 'px';
                        currentRectangle.style.height = topNewHeight + 'px';
                        if (aspectRatioValue !== null && topNewWidth > 0) {
                            currentRectangle.style.width = topNewWidth + 'px';
                            baseY = newTop;
                            baseWidth = topNewWidth;
                            baseHeight = topNewHeight;
                        }
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

        if (isDragging) {
            isDragging = false;
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

    function adjustRectangleToAspectRatio() {
        if (!aspectRatioValue || !rectangleExists || !currentRectangle) return;

        // Keep width, adjust height to ratio
        baseHeight = baseWidth / aspectRatioValue;

        // Update display
        currentRectangle.style.width = baseWidth + 'px';
        currentRectangle.style.height = baseHeight + 'px';

        updateAllDimensions();

        console.log(`[AspectRatio] Adjusted to ${aspectRatioMode}: ${Math.round(baseWidth)}x${Math.round(baseHeight)}`);
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

        const w = Math.round(baseWidth);
        const h = Math.round(baseHeight);
        const ratio = w / h;

        // 🎯 MODALITÀ CUSTOM: Calcola approssimazione
        let aspectRatioDisplay;

        if (aspectRatioMode === "free") {
            // Standard aspect ratio list
            const standardRatios = [
                { value: 21 / 9, label: "21:9 Landscape", display: "21:9" },
                { value: 16 / 9, label: "16:9 Landscape", display: "16:9" },
                { value: 3 / 2, label: "3:2 Landscape", display: "3:2" },
                { value: 4 / 3, label: "4:3 Landscape", display: "4:3" },
                { value: 1 / 1, label: "1:1 Square", display: "1:1" },
                { value: 3 / 4, label: "3:4 Portrait", display: "3:4" },
                { value: 5 / 8, label: "5:8 Portrait", display: "5:8" },
                { value: 9 / 16, label: "9:16 Portrait", display: "9:16" },
                { value: 9 / 21, label: "9:21 Portrait", display: "9:21" },
            ];

            // Trova il più vicino
            let closestRatio = standardRatios[0];
            let minDiff = Math.abs(ratio - standardRatios[0].value);

            for (const r of standardRatios) {
                const diff = Math.abs(ratio - r.value);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestRatio = r;
                }
            }

            const diffPercent = (minDiff / ratio) * 100;

            // Display format based on proximity
            if (diffPercent < 3) {
                // Very close - show as exact
                aspectRatioDisplay = `<span style="color: #4ade80; font-weight: 600;">✓ ${closestRatio.label}</span>`;
            } else if (diffPercent < 8) {
                // Reasonably close - show approximate
                aspectRatioDisplay = `<span style="color: #fb923c; font-weight: 600;">~ ${closestRatio.label}</span> <span style="opacity: 0.5; font-size: 10px;">(${ratio.toFixed(2)}:1)</span>`;
            } else {
                // Too different - show custom + nearest
                aspectRatioDisplay = `<span style="color: #818cf8; font-weight: 600;">${ratio.toFixed(2)}:1</span> <span style="opacity: 0.45; font-size: 10px;">(≈ ${closestRatio.display})</span>`;
            }
        } else {
            // 🔒 MODALITÀ VINCOLATA: Mostra il vincolo attivo
            aspectRatioDisplay = `<span style="color: #4ade80; font-weight: 600;">🔒 ${aspectRatioMode}</span> <span style="opacity: 0.5; font-size: 10px;">(${ratio.toFixed(2)}:1)</span>`;
        }

        baseCoordinates.innerHTML = `
            <strong style="color: #a5b4fc;">📍 Coordinates</strong><br>
            x1 = ${Math.round(baseX1)}, y1 = ${Math.round(baseY1)}<br>
            x2 = ${Math.round(baseX2)}, y2 = ${Math.round(baseY2)}<br>
            <br>
            <strong style="color: #a5b4fc;">📏 Size</strong><br>
            ${w} × ${h} px<br>
            <br>
            <strong style="color: #a5b4fc;">✨ Ratio</strong> ${aspectRatioDisplay}
        `;
    }

    return {
        getCoordinates: () => {
            // Calcola il fattore di scala combinato (Backend + Browser CSS)
            const serverScale = parseFloat(backgroundImage.dataset.scaleFactor || "1");
            const browserScale = backgroundImage.offsetWidth / (backgroundImage.naturalWidth || backgroundImage.offsetWidth);
            const totalScale = serverScale * browserScale;

            console.log(`[BoxBox] Getting coordinates - ServerScale: ${serverScale}, BrowserScale: ${browserScale.toFixed(3)}, Total: ${totalScale.toFixed(3)}`);

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

            // Convert coordinates from scaled space back to original image space
            // REMOVED: BoxCrop backend already handles this conversion
            // Return display coordinates as-is, BoxCrop will divide by displayScaleFactor

            console.log(`[BoxBox] Final coordinates: (${Math.round(effectiveX1)}, ${Math.round(effectiveY1)}) to (${Math.round(effectiveX2)}, ${Math.round(effectiveY2)})`);

            return {
                x1: Math.round(effectiveX1),
                y1: Math.round(effectiveY1),
                x2: Math.round(effectiveX2),
                y2: Math.round(effectiveY2),
                borderWidth: currentBorderWidth,
                borderPosition: borderPosition,
                displayScaleFactor: totalScale,
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

console.log("[BoxBox] Preparing to register extension...");

app.registerExtension({
    name: "BoxBox.BoxSelectorExtension",

    async setup(app) {
        console.log("[BoxBox] Setup extension called");
    },

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // Log every node to see what's happening
        if (nodeData.name && nodeData.name.includes("Box")) {
            console.log(`[BoxBox] Checking node: ${nodeData.name}`);
        }

        if (nodeData.name !== "BoxSelector") return;

        console.log("[BoxBox] Found BoxSelector node! Adding button...");

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated?.apply(this, arguments);
            const node = this;

            console.log("[BoxBox] Node instance created, attaching button widgets...");

            // Button 1: Image Cache — executes only the BoxSelector subgraph
            // and shows a preview image on the node (like PreviewBridge)
            this.addWidget("button", "🖼️ Image Cache", null, async () => {
                console.log("[BoxBox] Image Cache clicked, auto-executing subgraph...");
                const success = await autoExecuteForPreview(node, app);
                if (!success) {
                    alert("⚠️ Could not generate preview.\n\nMake sure an image source is connected.");
                }
            });

            // Button 2: Select Box — opens the region selector dialog
            this.addWidget("button", "📦 Select Box", null, () => {
                console.log("[BoxBox] Select Box clicked!");
                openRegionDialog(node, app);
            });

            return r;
        };
    },
});

/**
 * Recursively searches for image metadata by traversing the node chain backwards
 * @returns {Object|null} - Image metadata {filename, type, subfolder} if found, null otherwise
 */
function findImageInChain(node, app, depth = 0, maxDepth = 20) {
    if (depth > maxDepth) return null;

    console.log(`[RegionSelectorExt] Searching at depth ${depth}, node type: ${node.type} (${node.comfyClass})`);

    // 1. Check if the node has preview images (standard ComfyUI way)
    if (node.imgs && node.imgs.length > 0) {
        const img = node.imgs[0];
        // Ensure it's a real image and not just a placeholder from some nodes
        if (img.filename && !img.filename.startsWith("$")) {
            console.log(`[RegionSelectorExt] ✅ Found image in node.imgs at depth ${depth}:`, img);
            return {
                filename: img.filename,
                type: img.type || "temp",
                subfolder: img.subfolder || ""
            };
        }
    }

    // 2. Check for common widgets that hold image names
    if (node.widgets) {
        // Look for any widget that might contain a filename
        const imageWidget = node.widgets.find(w => w.name === "image" || w.name === "image_name");
        if (imageWidget && imageWidget.value && typeof imageWidget.value === "string") {
            // Check if it looks like a real filename (has extension) or a special ID
            if (imageWidget.value.includes(".") || imageWidget.value.startsWith("$")) {
                console.log(`[RegionSelectorExt] ✅ Found image widget at depth ${depth}:`, imageWidget.name, "=", imageWidget.value);
                return {
                    filename: imageWidget.value,
                    type: "input", // Fallback, will be corrected for $ IDs later
                    subfolder: ""
                };
            }
        }
    }

    // 3. Traverse backwards through IMAGE inputs
    if (node.inputs && node.inputs.length > 0) {
        for (const input of node.inputs) {
            if (input.type === "IMAGE" && input.link !== undefined && input.link !== null) {
                const link = app.graph.links[input.link];
                if (link) {
                    const sourceNode = app.graph._nodes_by_id[link.origin_id];
                    if (sourceNode) {
                        const result = findImageInChain(sourceNode, app, depth + 1, maxDepth);
                        if (result) return result;
                    }
                }
            }
        }
    }

    return null;
}

/**
 * Apre il dialog del selettore di regioni
 */
/**
 * Recursively collects a node and all its input dependencies from the serialized prompt.
 * Used to build a minimal prompt that only executes the BoxSelector subgraph.
 */
function recursiveAddNodes(nodeId, oldOutput, newOutput) {
    const currentId = String(nodeId);
    const currentNode = oldOutput[currentId];
    if (!currentNode || newOutput[currentId] != null) return newOutput;

    newOutput[currentId] = currentNode;
    for (const inputValue of Object.values(currentNode.inputs || {})) {
        if (Array.isArray(inputValue) && inputValue.length >= 2) {
            recursiveAddNodes(inputValue[0], oldOutput, newOutput);
        }
    }
    return newOutput;
}

/**
 * Auto-executes the BoxSelector node and its upstream dependencies,
 * then waits for the execution to complete.
 * Returns true if execution succeeded, false otherwise.
 */
async function autoExecuteForPreview(node, app) {
    console.log("[BoxBox] Auto-executing node", node.id, "to generate preview...");

    return new Promise(async (resolve) => {
        let resolved = false;
        const targetNodeId = String(node.id);

        function cleanup() {
            api.removeEventListener("executed", onExecuted);
            api.removeEventListener("status", onStatus);
            api.removeEventListener("execution_error", onError);
        }

        // Track if our queue has started executing (to avoid false positives from
        // an already-empty queue status event before execution begins)
        let executionStarted = false;
        let ourNodeExecuted = false;

        // Listen for per-node completion — mark that our node has finished
        const onExecuted = (event) => {
            const eventNodeId = String(event.detail?.node ?? "");
            console.log(`[BoxBox] 'executed' event for node ${eventNodeId} (waiting for ${targetNodeId})`);
            executionStarted = true;
            if (eventNodeId === targetNodeId) {
                ourNodeExecuted = true;
                // Resolve immediately — our node is done
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    console.log("[BoxBox] ✅ Node", targetNodeId, "executed (via 'executed' event)");
                    resolve(true);
                }
            }
        };

        // Listen for queue drain — reliable backup signal
        const onStatus = (event) => {
            const queueRemaining = event.detail?.exec_info?.queue_remaining
                ?? event.detail?.status?.exec_info?.queue_remaining;
            if (queueRemaining === 0 && executionStarted && !resolved) {
                resolved = true;
                cleanup();
                console.log("[BoxBox] ✅ Queue drained (via 'status' event), node executed:", ourNodeExecuted);
                resolve(true);
            }
        };

        const onError = (event) => {
            // Only treat it as our error if execution had started
            if (executionStarted && !resolved) {
                resolved = true;
                cleanup();
                console.error("[BoxBox] ❌ Execution error", event.detail);
                resolve(false);
            }
        };

        // Safety timeout (30 seconds)
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                cleanup();
                console.warn("[BoxBox] ⏱️ Auto-execute timed out after 30s");
                resolve(false);
            }
        }, 30000);

        api.addEventListener("executed", onExecuted);
        api.addEventListener("status", onStatus);
        api.addEventListener("execution_error", onError);

        try {
            // Serialize the full graph
            const prompt = await app.graphToPrompt();

            if (!prompt?.output?.[targetNodeId]) {
                console.error("[BoxBox] Node", targetNodeId, "not found in serialized prompt. Is it connected?");
                resolved = true;
                cleanup();
                resolve(false);
                return;
            }

            // Prune prompt to only include BoxSelector and its upstream dependencies
            const prunedOutput = recursiveAddNodes(targetNodeId, prompt.output, {});
            prompt.output = prunedOutput;

            console.log("[BoxBox] Queuing partial execution with", Object.keys(prunedOutput).length, "nodes");

            // Queue the pruned prompt
            await api.queuePrompt(0, prompt);
        } catch (e) {
            console.error("[BoxBox] Failed to queue auto-execute:", e);
            if (!resolved) {
                resolved = true;
                cleanup();
                resolve(false);
            }
        }
    });
}

async function openRegionDialog(node, app) {
    console.log("[RegionSelectorExt] Opening dialog...");

    let imageInfo = null;
    const nodeId = node.id;

    // === PRIMARY: Try backend preview (set by Image Cache or previous execution) ===
    try {
        const previewRes = await fetch(`/region_selector/preview?node_id=${nodeId}`);
        if (previewRes.ok) {
            const previewData = await previewRes.json();
            if (previewData.found) {
                imageInfo = {
                    filename: previewData.filename,
                    type: previewData.type || "temp",
                    subfolder: previewData.subfolder || ""
                };
                console.log("[RegionSelectorExt] ✅ Got image from backend preview cache:", imageInfo);
            }
        }
    } catch (e) {
        console.warn("[RegionSelectorExt] Backend preview fetch failed:", e);
    }

    // === FALLBACK: Traverse node chain (works for LoadImage, PreviewBridge) ===
    if (!imageInfo) {
        if (node.inputs && node.inputs[0]?.link != null) {
            const link = app.graph.links[node.inputs[0].link];
            if (link) {
                const sourceNode = app.graph._nodes_by_id[link.origin_id];
                imageInfo = findImageInChain(sourceNode, app);
            }
        }
        if (!imageInfo) {
            imageInfo = findImageInChain(node, app);
        }
    }

    if (!imageInfo || !imageInfo.filename) {
        alert("⚠️ No image found!\n\nClick '🖼️ Image Cache' first to generate the preview.");
        return;
    }

    // SPECIAL HANDLING: Impact Pack PreviewBridge IDs ($...)
    if (imageInfo.filename.startsWith("$")) {
        console.log("[RegionSelectorExt] Detected PreviewBridge ID, attempting to resolve:", imageInfo.filename);
        try {
            const response = await fetch(`/impact/get/pb_id_image?id=${encodeURIComponent(imageInfo.filename)}`);
            if (response.ok) {
                const pbInfo = await response.json();
                console.log("[RegionSelectorExt] Resolved PreviewBridge ID:", pbInfo);
                imageInfo = {
                    filename: pbInfo.filename,
                    type: pbInfo.type || "temp",
                    subfolder: pbInfo.subfolder || ""
                };
            } else {
                console.warn("[RegionSelectorExt] Failed to resolve PreviewBridge ID via API");
            }
        } catch (e) {
            console.error("[RegionSelectorExt] Error resolving PreviewBridge ID via API:", e);
        }
    }

    // Construct URL - use direct path /view to avoid /api/view ambiguity
    const params = new URLSearchParams();
    params.append("filename", imageInfo.filename);
    params.append("type", imageInfo.type || "input");
    if (imageInfo.subfolder) params.append("subfolder", imageInfo.subfolder);

    // Use ROOT /view as standard ComfyUI does
    const imageUrl = `/view?${params.toString()}`;
    console.log("[RegionSelectorExt] Final Image URL:", imageUrl);

    // Crea il dialog usando la API moderna o il fallback sicuro
    let dialog;
    try {
        if (window.comfyAPI && window.comfyAPI.ui && window.comfyAPI.ui.ComfyDialog) {
            dialog = new window.comfyAPI.ui.ComfyDialog();
        } else {
            // Fallback se siamo su una versione vecchia o il bus bridge è attivo
            const { ComfyDialog } = await import("../../scripts/ui.js");
            dialog = new ComfyDialog();
        }
    } catch (e) {
        console.error("[BoxBox] Failed to create dialog via modern API, trying fallback:", e);
        // Fallback estremo: molti nodi usano app.ui.dialog o simili
        if (app.ui && app.ui.dialog) {
            dialog = app.ui.dialog;
        } else {
            alert("Error: ComfyUI Dialog system not available. Please check console (F12).");
            return;
        }
    }

    dialog.element.style.width = "96vw";
    dialog.element.style.height = "96vh";
    dialog.element.style.maxWidth = "none";
    dialog.element.style.maxHeight = "none";
    dialog.element.style.borderRadius = "16px";
    dialog.element.style.overflow = "hidden";
    dialog.element.style.border = "1px solid rgba(255,255,255,0.06)";
    dialog.element.style.boxShadow = "0 32px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)";

    // Create main container
    const container = document.createElement("div");
    container.style.cssText = `
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        background: #0f0f1a;
        font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
        color: #e0e4ec;
    `;

    // Inject modern styles
    const styleTag = document.createElement("style");
    styleTag.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        /* ═══ Selection Rectangle ═══ */
        .rectangle {
            position: absolute;
            background-color: rgba(99, 102, 241, 0.08);
            cursor: move;
            transition: none;
            z-index: 10;
        }
        .rectangle.border-inside {
            border: 2px solid #818cf8;
            box-shadow: 0 0 0 1px rgba(129, 140, 248, 0.15), inset 0 0 20px rgba(99, 102, 241, 0.06);
        }
        .rectangle.border-outside {
            outline: 2px solid #818cf8;
            outline-offset: 0px;
        }
        .rectangle.thick-border {
            box-shadow: 0 0 16px rgba(99, 102, 241, 0.25), 0 0 0 1px rgba(129, 140, 248, 0.2);
        }

        /* ═══ Resize Handles ═══ */
        .resize-handle {
            position: absolute;
            background: #818cf8;
            z-index: 20;
            opacity: 0.85;
            transition: all 0.15s ease;
            border-radius: 2px;
        }
        .resize-handle:hover {
            opacity: 1;
            background: #a5b4fc;
            box-shadow: 0 0 10px rgba(129, 140, 248, 0.7);
            transform: scale(1.2);
        }

        /* Edge handles */
        .resize-handle.top, .resize-handle.bottom {
            width: 100%; height: 6px; cursor: ns-resize;
            border-radius: 0;
            opacity: 0;
        }
        .resize-handle.top:hover, .resize-handle.bottom:hover { opacity: 0.6; transform: scaleY(1.5); }
        .resize-handle.top { top: -3px; left: 0; }
        .resize-handle.bottom { bottom: -3px; left: 0; }

        .resize-handle.left, .resize-handle.right {
            width: 6px; height: 100%; cursor: ew-resize;
            border-radius: 0;
            opacity: 0;
        }
        .resize-handle.left:hover, .resize-handle.right:hover { opacity: 0.6; transform: scaleX(1.5); }
        .resize-handle.left { left: -3px; top: 0; }
        .resize-handle.right { right: -3px; top: 0; }

        /* Corner handles */
        .resize-handle.top-left, .resize-handle.top-right,
        .resize-handle.bottom-left, .resize-handle.bottom-right {
            width: 14px; height: 14px;
            border-radius: 50%;
            border: 2px solid #0f0f1a;
            box-shadow: 0 0 0 1px rgba(129,140,248,0.3);
        }
        .resize-handle.top-left:hover, .resize-handle.top-right:hover,
        .resize-handle.bottom-left:hover, .resize-handle.bottom-right:hover {
            box-shadow: 0 0 12px rgba(129, 140, 248, 0.8), 0 0 0 1px rgba(129,140,248,0.5);
        }
        .resize-handle.top-left, .resize-handle.bottom-right { cursor: nwse-resize; }
        .resize-handle.top-right, .resize-handle.bottom-left { cursor: nesw-resize; }
        .resize-handle.top-left { top: -7px; left: -7px; }
        .resize-handle.top-right { top: -7px; right: -7px; }
        .resize-handle.bottom-left { bottom: -7px; left: -7px; }
        .resize-handle.bottom-right { bottom: -7px; right: -7px; }

        #canvas-container.drawing-disabled { cursor: default !important; }

        /* ═══ Scrollbar ═══ */
        .bs-control-panel::-webkit-scrollbar { width: 4px; }
        .bs-control-panel::-webkit-scrollbar-track { background: transparent; }
        .bs-control-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .bs-control-panel::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

        /* ═══ Checkerboard bg ═══ */
        .bs-canvas-area {
            background-color: #0d1117;
            background-image:
                linear-gradient(45deg, #161b22 25%, transparent 25%),
                linear-gradient(-45deg, #161b22 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #161b22 75%),
                linear-gradient(-45deg, transparent 75%, #161b22 75%);
            background-size: 20px 20px;
            background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
        }
    `;
    document.head.appendChild(styleTag);

    // Build dialog HTML — single sidebar + canvas, no header
    const innerHtml = `
        <div style="height: 100%; display: flex; overflow: hidden;">
            <!-- ─── Single Left Column ─── -->
            <div class="bs-control-panel" style="
                width: 260px;
                min-width: 260px;
                background: rgba(18, 18, 30, 0.92);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                overflow-y: auto;
                padding: 20px 18px;
                border-right: 1px solid rgba(255,255,255,0.05);
                display: flex;
                flex-direction: column;
                gap: 4px;
            ">
                <!-- Title -->
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                    <span style="font-size: 20px;">📦</span>
                    <div>
                        <h1 style="font-size: 15px; margin: 0; font-weight: 700; letter-spacing: -0.01em; color: #f0f2f5;">Box Selector</h1>
                        <p style="font-size: 10px; margin: 2px 0 0 0; color: #6b7280;">Click and drag to define region</p>
                    </div>
                </div>

                <!-- Filename -->
                <div id="image-name" style="
                    font-size: 10px;
                    color: #4b5563;
                    background: rgba(255,255,255,0.03);
                    padding: 5px 10px;
                    border-radius: 6px;
                    font-family: 'JetBrains Mono', monospace;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    margin-bottom: 4px;
                ">${imageInfo.filename}</div>

                <!-- Divider -->
                <div style="height: 1px; background: rgba(255,255,255,0.05); margin: 6px 0;"></div>

                <!-- Aspect Ratio -->
                <div style="margin-bottom: 4px;">
                    <label style="
                        display: block;
                        font-size: 10px;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.08em;
                        color: #8b95a5;
                        margin-bottom: 8px;
                    ">Aspect Ratio</label>
                    <select id="aspect-ratio-select" style="
                        width: 100%;
                        padding: 9px 12px;
                        border: 1px solid rgba(255,255,255,0.08);
                        border-radius: 8px;
                        font-size: 13px;
                        font-family: inherit;
                        background: rgba(255,255,255,0.04);
                        color: #e0e4ec;
                        cursor: pointer;
                        outline: none;
                        transition: border-color 0.2s;
                        appearance: none;
                        -webkit-appearance: none;
                        background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%228%22><path d=%22M1 1l5 5 5-5%22 stroke=%22%238b95a5%22 stroke-width=%221.5%22 fill=%22none%22/></svg>');
                        background-repeat: no-repeat;
                        background-position: right 12px center;
                    ">
                        <option value="free" selected>Free</option>
                        <option value="1:1">1:1 Square</option>
                        <option value="3:4">3:4 Portrait</option>
                        <option value="5:8">5:8 Portrait</option>
                        <option value="9:16">9:16 Portrait</option>
                        <option value="9:21">9:21 Portrait</option>
                        <option value="4:3">4:3 Landscape</option>
                        <option value="3:2">3:2 Landscape</option>
                        <option value="16:9">16:9 Landscape</option>
                        <option value="21:9">21:9 Landscape</option>
                    </select>
                    <small id="aspect-ratio-hint" style="
                        display: block;
                        margin-top: 6px;
                        font-size: 11px;
                        color: #6b7280;
                        font-style: italic;
                    ">Free draw — ratio calculated after</small>
                </div>

                <!-- Divider -->
                <div style="height: 1px; background: rgba(255,255,255,0.05); margin: 6px 0;"></div>

                <!-- Reset Button -->
                <button id="reset-btn" disabled style="
                    background: transparent;
                    color: #8b95a5;
                    border: 1px solid rgba(255,255,255,0.08);
                    width: 100%;
                    padding: 9px 14px;
                    border-radius: 8px;
                    font-size: 12px;
                    font-weight: 500;
                    font-family: inherit;
                    cursor: pointer;
                    opacity: 0.4;
                    transition: all 0.2s ease;
                    margin-bottom: 4px;
                "
                onmouseover="if(!this.disabled){this.style.background='rgba(239,68,68,0.1)';this.style.borderColor='rgba(239,68,68,0.3)';this.style.color='#f87171'}"
                onmouseout="this.style.background='transparent';this.style.borderColor='rgba(255,255,255,0.08)';this.style.color='#8b95a5'"
                >🔄 Clear Selection</button>

                <!-- Divider -->
                <div style="height: 1px; background: rgba(255,255,255,0.05); margin: 4px 0 6px 0;"></div>

                <!-- Selection Info -->
                <div id="coordinates-info">
                    <label style="
                        display: block;
                        font-size: 10px;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.08em;
                        color: #8b95a5;
                        margin-bottom: 10px;
                    ">Selection Info</label>
                    <div id="base-coordinates" style="
                        background: rgba(255,255,255,0.03);
                        padding: 12px 14px;
                        border-radius: 8px;
                        font-family: 'JetBrains Mono', monospace;
                        font-size: 11px;
                        line-height: 1.7;
                        color: #8b95a5;
                        border: 1px solid rgba(255,255,255,0.04);
                    ">
                        <span style="color: #6b7280;">Click and drag to select</span>
                    </div>
                    <div id="current-dimensions" style="
                        background: transparent;
                        padding: 12px;
                        border-radius: 8px;
                        font-family: 'JetBrains Mono', monospace;
                        font-size: 11px;
                        display: none;
                    "></div>
                </div>

                <div id="dimensions-info" style="display: none; margin-top: 8px;"></div>

                <!-- Spacer -->
                <div style="flex: 1;"></div>

                <!-- Keyboard hints -->
                <div style="
                    font-size: 10px;
                    color: #4b5563;
                    line-height: 1.6;
                    padding: 10px 0 0 0;
                    border-top: 1px solid rgba(255,255,255,0.04);
                ">
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;">
                        <span style="background: rgba(255,255,255,0.06); padding: 1px 5px; border-radius: 3px; font-family: 'JetBrains Mono', monospace; font-size: 9px;">Drag</span>
                        <span>Draw selection</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="background: rgba(255,255,255,0.06); padding: 1px 5px; border-radius: 3px; font-family: 'JetBrains Mono', monospace; font-size: 9px;">Handles</span>
                        <span>Resize selection</span>
                    </div>
                </div>
            </div>

            <!-- ─── Canvas Area ─── -->
            <div class="bs-canvas-area" style="
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                position: relative;
            ">
                <div id="canvas-container" style="
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    background: #1a1a2e;
                    border-radius: 6px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.04);
                    overflow: hidden;
                    max-width: 95%;
                    max-height: 95%;
                ">
                    <img src="${imageUrl}" alt="Region Selector" id="background-image" 
                        onerror="console.error('[RegionSelector] Failed to load image:', this.src); this.alt = 'Failed to load image';"
                        style="
                        display: block;
                        max-width: 100%;
                        max-height: 100%;
                        user-select: none;
                    ">
                </div>
            </div>
        </div>
    `;

    container.innerHTML = innerHtml;
    dialog.element.appendChild(container);

    // Action buttons
    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = "✓  Confirm Selection";
    confirmBtn.style.cssText = `
        background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
        color: white;
        border: none;
        padding: 11px 28px;
        border-radius: 10px;
        cursor: pointer;
        font-weight: 600;
        font-size: 13px;
        font-family: inherit;
        letter-spacing: 0.01em;
        margin-right: 10px;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(34, 197, 94, 0.25);
    `;
    confirmBtn.onmouseover = () => { confirmBtn.style.transform = "translateY(-1px)"; confirmBtn.style.boxShadow = "0 4px 16px rgba(34, 197, 94, 0.35)"; };
    confirmBtn.onmouseout = () => { confirmBtn.style.transform = "translateY(0)"; confirmBtn.style.boxShadow = "0 2px 8px rgba(34, 197, 94, 0.25)"; };

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = `
        background: transparent;
        color: #8b95a5;
        border: 1px solid rgba(255,255,255,0.1);
        padding: 11px 24px;
        border-radius: 10px;
        cursor: pointer;
        font-weight: 500;
        font-size: 13px;
        font-family: inherit;
        transition: all 0.2s ease;
    `;
    cancelBtn.onmouseover = () => { cancelBtn.style.borderColor = "rgba(239,68,68,0.3)"; cancelBtn.style.color = "#f87171"; };
    cancelBtn.onmouseout = () => { cancelBtn.style.borderColor = "rgba(255,255,255,0.1)"; cancelBtn.style.color = "#8b95a5"; };

    confirmBtn.onclick = () => {
        console.log("[RegionSelectorExt] Confirm clicked but CanvasSelector not ready yet");
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
                // Get previous metadata from node widget if it exists
                const metadataWidget = node.widgets?.find((w) => w.name === "box_metadata");
                const previousMetadata = metadataWidget?.value || null;

                const selector = window.CanvasSelector.initializeCanvasSelector(container, imageUrl, previousMetadata);

                // Aggiorna il confirm button per usare le coordinate reali
                confirmBtn.onclick = () => {
                    const coords = selector.getCoordinates();

                    // Cerca il widget box_metadata tra i widget del nodo
                    // ComfyUI lo crea automaticamente dal INPUT_TYPES opzionale
                    let metadataWidget = node.widgets?.find((w) => w.name === "box_metadata");

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
                        console.warn("[RegionSelectorExt] box_metadata widget not found. Available widgets:", node.widgets?.map(w => w.name) || []);
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
