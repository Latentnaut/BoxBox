# 📦 BoxBox - Enhanced Version

Custom node for ComfyUI for interactive region selection (boxes) with advanced features and critical bug fixes.

## 🎉 What's New in This Enhanced Version

This is an optimized fork of the original [BoxBox](https://github.com/mercu-lore/BoxBox) with several fixes and new functionalities:

### ✅ Bug Fixes

1. **Image Loading (ComfyUI v0.12.2+)**
   - Updated URL construction to use the ComfyUI API helper.
   - Proper encoding for filenames with special characters.
   - Error handling with fallback mechanisms.

2. **Backend Stability**
   - Uses the standard ComfyUI `temp` folder.
   - Fixed HTTP responses using `web.json_response`.
   - Filename sanitization to avoid path conflicts.

3. **Precise Coordinate Scaling**
   - Fixed duplicate scaling (previously occurring in both frontend and backend).
   - Exact conversion from display space coordinates to original image size.

4. **Intermediate Node Support**
   - Recursive node chain traversal to find the source image.
   - Compatible with processing nodes (Brightness, Blur, etc.) between `LoadImage` and `BoxSelector`.

5. **NumPy 2.0 Compatibility**
   - Updated server logic with explicit casting (`np.uint8`, `np.float32`).
   - Resolved binary incompatibilities in coordinate processing.

6. **Adaptive Window Scaling**
   - Fixed coordinate misalignment when resizing the browser window.
   - Dynamic calculation of the total scale factor (Server Scale * Browser CSS Scale).

### 🆕 New Features

1. **Aspect Ratio Memory**
   - Remembers your last selected proportion via `localStorage`.
   - Keeps the ratio locked when drawing new selections.

2. **Selection Restoration**
   - Automatically restores the last selection when reopening the selector.
   - Allows for quick adjustments to existing selections.

3. **Improved UX**
   - Removed intrusive alerts for small images.
   - Detailed console logging for debugging (`[BoxBox]`).

---

## 🎯 Usage

1. Add a **LoadImage** node.
2. Add a **BoxSelector** node and connect them.
3. Click the **📦 Select Box** button.
4. Draw the region in the popup window.
5. Select an Aspect Ratio if desired and click **✅ Confirm**.
6. Use **BoxCrop** to get the image crop.

## 🔧 Included Nodes

- **📦 BoxSelector**: Interactive selection with ratio locking.
- **✂️ BoxCrop**: Crops the image based on selected coordinates.
- **📐 BoxResize**: Scales the crop while maintaining fidelity.

---
*Documentation synchronized following the node-doc-sync protocol.*
