import bpy, math, mathutils
def setup_render(path, res=(900,900), engine='BLENDER_EEVEE_NEXT'):
    s=bpy.context.scene
    try: s.render.engine=engine
    except TypeError:
        try: s.render.engine='BLENDER_EEVEE'
        except TypeError: s.render.engine='CYCLES'
    s.render.resolution_x,s.render.resolution_y=res
    s.render.filepath=path
    s.render.film_transparent=False
    w=bpy.data.worlds.new('W') if not s.world else s.world; s.world=w; w.use_nodes=True
    bg=next(n for n in w.node_tree.nodes if n.type=='BACKGROUND'); bg.inputs[0].default_value=(0.82,0.84,0.82,1); bg.inputs[1].default_value=1.0
def add_cam(target=(0,0,1.0), loc=(0,-4.2,1.3), lens=50):
    cam=bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam')); bpy.context.scene.collection.objects.link(cam)
    cam.location=loc; cam.data.lens=lens
    d=mathutils.Vector(target)-cam.location; cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
    bpy.context.scene.camera=cam; return cam
def add_sun():
    l=bpy.data.objects.new('Sun', bpy.data.lights.new('Sun','SUN')); l.data.energy=3; l.rotation_euler=(math.radians(50),0,math.radians(30)); bpy.context.scene.collection.objects.link(l)
