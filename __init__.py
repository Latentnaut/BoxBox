"""
BoxBox - Pacchetto nodi completo per selezione, crop, resize e reinserimento regioni immagine
"""

import os
from .region_selector_node import RegionSelectorNode, NODE_CLASS_MAPPINGS as RSN_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS as RSN_DISPLAY
from .region_crop_node import RegionCropNode, NODE_CLASS_MAPPINGS as RCN_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS as RCN_DISPLAY
from .box_resize_node import BoxResizeNode, NODE_CLASS_MAPPINGS as BRN_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS as BRN_DISPLAY
from .box_reinsert_node import BoxReinsertNode, NODE_CLASS_MAPPINGS as BRI_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS as BRI_DISPLAY

# Combina le mappature di tutti i nodi
NODE_CLASS_MAPPINGS = {
    **RSN_MAPPINGS,
    **RCN_MAPPINGS,
    **BRN_MAPPINGS,
    **BRI_MAPPINGS,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    **RSN_DISPLAY,
    **RCN_DISPLAY,
    **BRN_DISPLAY,
    **BRI_DISPLAY,
}

# Percorso file web (HTML/CSS/JS)
WEB_DIRECTORY = os.path.join(os.path.dirname(__file__), "web")

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
