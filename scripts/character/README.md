# Amir's 3D character

`public/models/amir.glb` is made the way people usually turn themselves into game characters:

1. **Character sheet.** Four photos of Amir go into the Gemini app (Nano Banana) with a prompt for a
   full-body, front-on, A-pose reference in a stylised indie-game look: his hair, round glasses,
   dark denim jacket over a light-blue shirt, dark jeans, white sneakers, on a plain grey background.
2. **Image to 3D.** That image goes to the free TRELLIS Space on Hugging Face
   (`trellis-community/TRELLIS`, `/generate_and_extract_glb`, signed in with a free HF token for ZeroGPU time).
   The result is a textured GLB.
3. **Rig.** `rig_generated.py` (run inside Blender, e.g. through the Blender MCP) fits Quaternius'
   CC0 Universal Animation Library skeleton (https://quaternius.com, from
   https://opengameart.org/content/universal-animation-library) to the model. Then it binds with
   automatic weights, re-rests the skeleton to the source orientations so the 14 animations (idle,
   walk, jog, sprint, jump, spell-cast, talk, dance, sit) play as authored, and exports the GLB.

`build_amir.py`, `export.py`, `common.py` and `views.py` are the earlier attempt (the mannequin
restyled by hand in headless Blender), kept for reference.
