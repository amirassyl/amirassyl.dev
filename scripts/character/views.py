import bpy, sys, math, mathutils
sys.path.insert(0, '/Users/amir/.claude/jobs/0753da4a/tmp/bl'); from common import *
src = sys.argv[sys.argv.index('--')+1]; tag = sys.argv[sys.argv.index('--')+2]
bpy.ops.wm.open_mainfile(filepath=src)
rig = bpy.data.objects['Rig']; a = bpy.data.actions['Idle_Loop']; rig.animation_data.action = a
if hasattr(rig.animation_data,'action_slot') and a.slots: rig.animation_data.action_slot = a.slots[0]
bpy.context.scene.frame_set(12)
setup_render('', (700, 900)); add_sun()
s = bpy.context.scene
w = s.world.node_tree.nodes; next(n for n in w if n.type=='BACKGROUND').inputs[0].default_value = (0.78, 0.8, 0.78, 1)
cam = add_cam()
shots = {'front': ((0, -3.6, 1.2), (0, 0, 0.95), 50), 'tq': ((2.4, -2.6, 1.5), (0, 0, 0.95), 50),
         'back': ((0.3, 3.6, 1.3), (0, 0, 0.95), 50), 'head': ((0.25, -0.75, 1.72), (0, 0, 1.69), 60)}
for k, (loc, tgt, lens) in shots.items():
    cam.location = loc; cam.data.lens = lens
    cam.rotation_euler = (mathutils.Vector(tgt) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    s.render.filepath = f'/Users/amir/.claude/jobs/0753da4a/tmp/bl/{tag}_{k}.png'; bpy.ops.render.render(write_still=True)
