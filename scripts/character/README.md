# Amir's 3D character

`public/models/amir.glb` is built from Quaternius' **Universal Animation Library** (CC0, https://quaternius.com) in headless Blender 5.2:

```sh
# 1. Download the CC0 pack (https://opengameart.org/content/universal-animation-library) and unzip it.
# 2. Point build_amir.py at "Godot/AnimationLibrary_Godot_Standard.glb" (path at the top), then:
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python build_amir.py
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python export.py
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python views.py -- "$PWD/amir.blend" preview
```

What the script does: slims the mannequin toward its bones, rebuilds the jacket and jeans as single
voxel-remeshed garments with weights copied from the body, adds a light-blue collar, wavy hair locks,
round black glasses, eyes, brows, ears and nose on the head bone, decimates, and keeps 14 animations
(idle, walk, jog, sprint, jump, spell-cast, talk, dance, sit).
