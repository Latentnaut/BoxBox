"""
Box Resize Node - Nodo per ridimensionare immagini con preset aspect ratio o custom
"""

import json
import torch
import torch.nn.functional as F
from typing import Dict, Any, Tuple


class BoxResizeNode:
    """
    Nodo che ridimensiona immagini con supporto per preset aspect ratio comuni.

    Supporta:
    - Preset di aspect ratio (1:1, 3:4, 5:8, 9:16, ecc...)
    - Modalità custom width/height
    - Keep aspect ratio
    - Interpolazione (bilinear, bicubic, nearest)

    Outputs metadata con informazioni complete di trasformazione.
    """

    RESIZE_PRESETS = {
        "Custom": None,
        "1:1 Square 1024x1024": (1024, 1024),
        "3:4 Portrait 896x1152": (896, 1152),
        "5:8 Portrait 832x1216": (832, 1216),
        "9:16 Portrait 768x1344": (768, 1344),
        "9:21 Portrait 640x1536": (640, 1536),
        "4:3 Landscape 1152x896": (1152, 896),
        "3:2 Landscape 1216x832": (1216, 832),
        "16:9 Landscape 1344x768": (1344, 768),
        "21:9 Landscape 1536x640": (1536, 640),
    }

    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        """
        Definisce gli input del nodo.

        Returns:
            Dict con tipologie e configurazioni degli input
        """
        return {
            "required": {
                "image": ("IMAGE",),
                "size": (list(cls.RESIZE_PRESETS.keys()), {
                    "default": "Custom"
                }),
                "keep_aspect_ratio": ("BOOLEAN", {
                    "default": True
                }),
                "interpolation_mode": (["bilinear", "bicubic", "nearest"], {
                    "default": "bilinear"
                }),
            },
            "optional": {
                "width": ("INT", {
                    "default": 1024,
                    "min": 64,
                    "max": 8192,
                    "step": 8
                }),
                "height": ("INT", {
                    "default": 1024,
                    "min": 64,
                    "max": 8192,
                    "step": 8
                }),
            }
        }

    RETURN_TYPES = ("IMAGE", "STRING")
    RETURN_NAMES = ("image", "resize_metadata")
    FUNCTION = "resize"
    CATEGORY = "image/box"

    def resize(
        self,
        image: torch.Tensor,
        size: str,
        keep_aspect_ratio: bool,
        interpolation_mode: str = "bilinear",
        width: int = 1024,
        height: int = 1024
    ) -> Tuple[torch.Tensor, str]:
        """
        Ridimensiona l'immagine con support per preset.

        Args:
            image: Tensor immagine in formato (batch, height, width, channels)
            size: Preset selezionato o "Custom"
            keep_aspect_ratio: Se True, mantiene le proporzioni
            interpolation_mode: Modalità di interpolazione ("bilinear", "bicubic", "nearest")
            width: Larghezza custom (se size = "Custom")
            height: Altezza custom (se size = "Custom")

        Returns:
            Tuple contenente:
            - resized_image: Tensor dell'immagine ridimensionata
            - resize_metadata: Stringa JSON con informazioni di ridimensionamento
        """

        # Estrai dimensioni dal preset o usa custom
        if size == "Custom":
            target_width, target_height = width, height
        else:
            target_width, target_height = self.RESIZE_PRESETS[size]

        # Valida l'input
        if len(image.shape) != 4:
            raise ValueError(f"Formato immagine non valido: atteso (batch, height, width, channels), ricevuto {image.shape}")

        # Estrai le dimensioni originali
        original_height = image.shape[1]
        original_width = image.shape[2]
        channels = image.shape[3]

        # Calcola le dimensioni finali
        if keep_aspect_ratio:
            # Mantieni le proporzioni usando target_width come riferimento
            aspect_ratio = original_height / original_width
            final_width = target_width
            final_height = int(target_width * aspect_ratio)
        else:
            final_width = target_width
            final_height = target_height

        # Se le dimensioni sono già corrette, ritorna l'immagine originale
        if final_width == original_width and final_height == original_height:
            resize_metadata = {
                "original_width": int(original_width),
                "original_height": int(original_height),
                "resized_width": int(final_width),
                "resized_height": int(final_height),
                "scale_x": 1.0,
                "scale_y": 1.0,
                "size_preset": size,
                "keep_aspect_ratio": keep_aspect_ratio,
                "interpolation_mode": interpolation_mode
            }
            return (image, json.dumps(resize_metadata))

        # Converte l'immagine da (batch, height, width, channels) a (batch, channels, height, width)
        # formato richiesto da torch.nn.functional.interpolate
        image_permuted = image.permute(0, 3, 1, 2)

        # Esegui il ridimensionamento
        align_corners = False if interpolation_mode != "nearest" else None

        resized = F.interpolate(
            image_permuted,
            size=(final_height, final_width),
            mode=interpolation_mode,
            align_corners=align_corners
        )

        # Riconverti al formato originale: (batch, height, width, channels)
        resized = resized.permute(0, 2, 3, 1)

        # Calcola i fattori di scala
        scale_x = final_width / original_width
        scale_y = final_height / original_height

        # Crea metadati con informazioni complete di ridimensionamento
        resize_metadata = {
            "original_width": int(original_width),
            "original_height": int(original_height),
            "resized_width": int(final_width),
            "resized_height": int(final_height),
            "scale_x": float(scale_x),
            "scale_y": float(scale_y),
            "size_preset": size,
            "keep_aspect_ratio": keep_aspect_ratio,
            "interpolation_mode": interpolation_mode
        }

        resize_metadata_str = json.dumps(resize_metadata)

        print(f"[BoxResizeNode] Resized {original_width}x{original_height} → {final_width}x{final_height} (preset: {size}, keep_aspect: {keep_aspect_ratio})")
        print(f"[BoxResizeNode] Metadata: {resize_metadata_str}")

        return (resized, resize_metadata_str)


NODE_CLASS_MAPPINGS = {"BoxResize": BoxResizeNode}
NODE_DISPLAY_NAME_MAPPINGS = {"BoxResize": "📦 BoxResize"}
