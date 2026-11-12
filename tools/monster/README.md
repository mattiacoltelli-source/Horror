# Mostro «la sorella» (assets/models/sorella.glb)

Modellato da script con Blender come modulo Python (`pip install bpy`, Python 3.11). Ordine: `stage1.py` (alta e bassa risoluzione) → `stage2.py` (UV e bake: colore, normal, emissione) → `stage3.py` (gonna, capelli, denti, occhi) → `stage4.py` (scheletro di 42 ossa e animazioni Idle/Walk/Lunge) → `export.py` (GLB). I percorsi nei file sono relativi alla cartella di lavoro: vanno adattati.

~20k triangoli, 5 materiali, texture JPEG 1024. Non è usato altro che questo GLB: gli script servono solo per rigenerarlo o ritoccarlo.
