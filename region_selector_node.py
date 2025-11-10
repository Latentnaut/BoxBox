"""
Region Selector Node - Nodo per selezionare regioni di immagini con interfaccia popup
"""

import json


class RegionSelectorNode:
    """
    Nodo che permette di selezionare una regione rettangolare su un'immagine
    tramite un'interfaccia interattiva in popup.

    Outputs:
    - IMAGE: L'immagine passata
    - STRING: Metadata JSON con coordinate della regione selezionata
    """

    def __init__(self):
        # Metadata di default con coordinate x1, x2, y1, y2 (lati, non posizione+dimensioni)
        self.last_metadata = json.dumps({
            "x1": 0,
            "y1": 0,
            "x2": 0,
            "y2": 0,
            "zoom": 1,
            "borderWidth": 0,
            "borderPosition": "inside",
            "selected": False
        })

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
            },
            "optional": {
                "region_metadata": ("STRING", {
                    "default": "{}",
                    "multiline": True,
                }),
            }
        }

    RETURN_TYPES = ("IMAGE", "STRING")
    RETURN_NAMES = ("image", "region_metadata")
    FUNCTION = "process_region_selection"
    CATEGORY = "image/region"
    OUTPUT_NODE = True

    def process_region_selection(self, image, region_metadata="{}"):
        """
        Processa l'immagine e ritorna l'immagine + metadata della regione selezionata.

        Args:
            image: Tensor immagine (B, H, W, C)
            region_metadata: JSON string con coordinate della regione (x1, x2, y1, y2)

        Returns:
            (image, region_metadata_json): Immagine originale e metadata JSON
        """

        # Usa il metadata fornito, o l'ultimo salvato se vuoto
        if region_metadata and region_metadata.strip() and region_metadata != "{}":
            metadata_to_return = region_metadata
            self.last_metadata = region_metadata
        else:
            # Se nessun metadata è stato fornito, usa l'ultimo salvato
            metadata_to_return = self.last_metadata

        print(f"[RegionSelectorNode] Processing selection, metadata: {metadata_to_return}")
        return (image, metadata_to_return)


NODE_CLASS_MAPPINGS = {"BoxSelector": RegionSelectorNode}
NODE_DISPLAY_NAME_MAPPINGS = {"BoxSelector": "📦 BoxSelector"}
