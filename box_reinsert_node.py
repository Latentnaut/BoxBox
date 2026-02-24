"""
Box Reinsert Node - Nodo per rimettere l'immagine generata nel punto originale
"""

import json
import torch
import numpy as np
from PIL import Image, ImageDraw, ImageFilter


class BoxReinsertNode:
    """
    Nodo che rimette l'immagine generata nel punto originale.

    Workflow:
    1. BoxSelector → estrae una regione (metadata con x1, x2, y1, y2)
    2. BoxCrop → ritaglia la regione
    3. BoxResize → ridimensiona per generazione (metadata con scale info)
    4. [Generazione AI] → produce immagine generata
    5. BoxReinsert → annulla il resize e rimette nel punto originale

    Input:
    - original_image: Immagine originale intera
    - generated_image: Immagine generata (ridimensionata)
    - box_metadata: Metadata dal BoxSelector (coordinate selezione)
    - resize_metadata: Metadata dal BoxResize (scale info)

    Output:
    - image: Immagine originale con generated_image rimessa nel posto corretto
    """

    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "original_image": ("IMAGE",),
                "generated_image": ("IMAGE",),
                "box_metadata": ("STRING",),
                "resize_metadata": ("STRING",),
                "mask_size": ("INT", {"default": 94, "min": 1, "max": 100, "step": 1}),
                "blur_sigma": ("FLOAT", {"default": 15.0, "min": 0.0, "max": 100.0, "step": 0.5}),
            }
        }

    RETURN_TYPES = ("IMAGE", "MASK")
    RETURN_NAMES = ("image", "mask")
    FUNCTION = "reinsert_image"
    CATEGORY = "image/box"

    def reinsert_image(self, original_image, generated_image, box_metadata, resize_metadata, mask_size=94, blur_sigma=15.0):
        """
        Rimette l'immagine generata nel punto originale.

        Se resize_metadata è vuoto, bypassa il resize e rimette direttamente l'immagine generata.

        Args:
            original_image: Immagine originale (B, H, W, C)
            generated_image: Immagine generata/elaborata (B, H, W, C)
            box_metadata: JSON metadata dal BoxSelector con x1, x2, y1, y2
            resize_metadata: JSON metadata dal BoxResize con scale_x, scale_y (opzionale)
            mask_size: Dimensione del quadrato bianco interno (percentuale)
            blur_sigma: Raggio del Gaussian blur applicato alla maschera

        Returns:
            (final_image, mask): Immagine finale prodotta e la maschera generata
        """

        try:
            box_meta = json.loads(box_metadata)
        except json.JSONDecodeError:
            print("[BoxReinsertNode] Invalid box_metadata JSON")
            return (original_image,)

        # Prova a leggere resize_metadata
        resize_meta = {}
        use_resize = False
        if resize_metadata and resize_metadata.strip() and resize_metadata != "{}":
            try:
                resize_meta = json.loads(resize_metadata)
                use_resize = True
            except json.JSONDecodeError:
                print("[BoxReinsertNode] Invalid resize_metadata JSON, bypassing resize")
                use_resize = False

        # Estrai coordinate della selezione originale
        x1 = box_meta.get("x1", 0)
        x2 = box_meta.get("x2", 0)
        y1 = box_meta.get("y1", 0)
        y2 = box_meta.get("y2", 0)

        # Applica fattore di scala se la preview era stata scalata
        display_scale_factor = box_meta.get("displayScaleFactor", 1.0)
        if display_scale_factor and display_scale_factor != 1.0:
            # Se le coordinate sono state prese da una preview scalata,
            # dividi per il fattore di scala per ottenere le coordinate originali
            x1 = x1 / display_scale_factor
            x2 = x2 / display_scale_factor
            y1 = y1 / display_scale_factor
            y2 = y2 / display_scale_factor
            print(f"[BoxReinsertNode] Scale factor detected: {display_scale_factor}x. Adjusted coordinates.")

        # Normalizza coordinate (assicura che x1 < x2, y1 < y2)
        box_x_start = int(round(min(x1, x2)))
        box_x_end = int(round(max(x1, x2)))
        box_y_start = int(round(min(y1, y2)))
        box_y_end = int(round(max(y1, y2)))

        crop_width = box_x_end - box_x_start
        crop_height = box_y_end - box_y_start

        # Converti immagini a PIL con casting esplicito
        # original_image es (B, H, W, C)

        print(f"[BoxReinsertNode] Target crop size: {crop_width}x{crop_height}")
        print(f"[BoxReinsertNode] Use resize: {use_resize}")

        batch_size = generated_image.shape[0]
        original_batch_size = original_image.shape[0]
        final_tensors = []
        mask_tensors = []

        for i in range(batch_size):
            orig_idx = min(i, original_batch_size - 1)
            
            original_np = (original_image[orig_idx].detach().cpu().numpy() * 255).round().astype(np.uint8)
            original_pil = Image.fromarray(original_np)

            generated_np = (generated_image[i].detach().cpu().numpy() * 255).round().astype(np.uint8)
            generated_pil = Image.fromarray(generated_np)

            if i == 0:
                print(f"[BoxReinsertNode] Generated image size (batch 0): {generated_pil.size}")

            # Step 1: Ridimensiona
            if use_resize:
                generated_resized = generated_pil.resize((crop_width, crop_height), Image.Resampling.LANCZOS)
            else:
                generated_resized = generated_pil

            # Step 1.5: Crea maschera di sfocatura
            # Creiamo la maschera direttamente alle dimensioni della base originale 
            # (non solo del crop) per avere uno spazio infinito per sfumare al 100% nero.
            full_mask = Image.new("L", original_pil.size, 0)
            
            # Calcoliamo le dimensioni del quadrato del crop e applichiamo il mask_size
            inner_w = int(crop_width * (mask_size / 100.0))
            inner_h = int(crop_height * (mask_size / 100.0))
            
            # Troviamo la posizione X e Y basata sulla box originaria e centrata
            box_center_x = box_x_start + (crop_width // 2)
            box_center_y = box_y_start + (crop_height // 2)
            
            rect_start_x = box_center_x - (inner_w // 2)
            rect_start_y = box_center_y - (inner_h // 2)
            rect_end_x = rect_start_x + inner_w
            rect_end_y = rect_start_y + inner_h
            
            draw = ImageDraw.Draw(full_mask)
            draw.rectangle(
                [rect_start_x, rect_start_y, rect_end_x, rect_end_y],
                fill=255
            )
            
            if blur_sigma > 0:
                # Applichiamo il blur a TUTTA l'immagine base, no a un ritaglio
                full_mask = full_mask.filter(ImageFilter.GaussianBlur(radius=blur_sigma))

            # Creiamo anche una versione ritagliata per il 'paste' del generated_resized
            mask_comp = full_mask.crop((box_x_start, box_y_start, box_x_start + crop_width, box_y_start + crop_height))
            
            # Step 2: Rimetti nel punto originale
            final_image = original_pil.copy()
            if generated_resized.mode == "RGBA":
                generated_resized = generated_resized.convert("RGB")
            final_image.paste(generated_resized, (box_x_start, box_y_start), mask_comp)

            # Converti back a tensor con casting sicuro per NumPy 2.0
            final_np_array = np.array(final_image, dtype=np.float32) / 255.0
            final_tensor = torch.from_numpy(final_np_array)

            # Assicurati che il tensor abbia le giuste dimensioni
            channels = original_image.shape[3]
            if final_tensor.shape[-1] != channels:
                if channels == 4 and final_tensor.shape[-1] == 3:
                    alpha = torch.ones((final_tensor.shape[0], final_tensor.shape[1], 1))
                    final_tensor = torch.cat([final_tensor, alpha], dim=-1)
                elif channels == 3 and final_tensor.shape[-1] == 4:
                    final_tensor = final_tensor[:, :, :3]
            
            final_tensors.append(final_tensor)
            
            # Step 3: Salva la maschera a pieno schermo per l'autput (B, H, W)
            mask_np = np.array(full_mask, dtype=np.float32) / 255.0
            mask_tensor = torch.from_numpy(mask_np)
            mask_tensors.append(mask_tensor)

        final_batch = torch.stack(final_tensors, dim=0)
        mask_batch = torch.stack(mask_tensors, dim=0)

        print(f"[BoxReinsertNode] Reinserted batch of {batch_size} image(s) at position ({box_x_start}, {box_y_start})")
        print(f"[BoxReinsertNode] Final batch shape: {final_batch.shape[0]}x{final_batch.shape[1]}x{final_batch.shape[2]}x{final_batch.shape[3]}")

        return (final_batch, mask_batch)


NODE_CLASS_MAPPINGS = {"BoxReinsert": BoxReinsertNode}
NODE_DISPLAY_NAME_MAPPINGS = {"BoxReinsert": "🎨 BoxReinsert"}
