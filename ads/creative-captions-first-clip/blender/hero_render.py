"""Product hero for the Creative Captions ad. Uses the ORIGINAL model, untouched.

Run:  blender -b -P blender/hero_render.py -- /path/to/creative_captions_model.(blend|glb|fbx)
Writes to footage/hero_render/: beauty (RGBA, alpha) + shadow-catcher pass, 1080x1920, 30 fps, 96 frames.
Nothing in the model (geometry, textures, decals, scale) is modified.
"""
import bpy, sys, math
from pathlib import Path

src = Path(sys.argv[sys.argv.index("--") + 1])
out = Path(__file__).resolve().parent.parent / "footage/hero_render"
out.mkdir(parents=True, exist_ok=True)

if src.suffix == ".blend":
    bpy.ops.wm.open_mainfile(filepath=str(src))
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    (bpy.ops.import_scene.gltf if src.suffix in (".glb", ".gltf") else bpy.ops.import_scene.fbx)(filepath=str(src))

sc = bpy.context.scene
objs = [o for o in sc.objects if o.type == "MESH"]
mins = [min((o.matrix_world @ v.co)[i] for o in objs for v in o.data.vertices) for i in range(3)]
maxs = [max((o.matrix_world @ v.co)[i] for o in objs for v in o.data.vertices) for i in range(3)]
c = [(a + b) / 2 for a, b in zip(mins, maxs)]
size = max(b - a for a, b in zip(mins, maxs))

# Shadow catcher (desk contact shadow), rendered as its own pass
bpy.ops.mesh.primitive_plane_add(size=size * 8, location=(c[0], c[1], mins[2]))
floor = bpy.context.object; floor.name = "ShadowCatcher"; floor.is_shadow_catcher = True

# Match B1 desk light: warm lamp camera-left, cool monitor fill camera-right-front
def light(name, kind, energy, color, loc, size_):
    d = bpy.data.lights.new(name, kind); d.energy = energy; d.color = color
    if kind == "AREA": d.size = size_
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (c[0] - loc[0], 0, 0); return o
lamp = light("WarmLamp", "AREA", 400 * size, (1.0, 0.78, 0.55), (c[0] - size * 2.5, c[1] - size, c[2] + size * 1.5), size)
mon = light("MonitorFill", "AREA", 220 * size, (0.78, 0.86, 1.0), (c[0] + size * 1.2, c[1] - size * 2.2, c[2] + size * 0.6), size * 1.5)
for L in (lamp, mon):
    t = L.constraints.new("TRACK_TO"); t.target = objs[0]; t.track_axis = "TRACK_NEGATIVE_Z"

# Camera: low three-quarter, short lateral slide so the wordmark catches the monitor light
cam_d = bpy.data.cameras.new("HeroCam"); cam_d.lens = 70
cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 4.0; cam_d.dof.focus_object = objs[0]
cam = bpy.data.objects.new("HeroCam", cam_d); sc.collection.objects.link(cam); sc.camera = cam
tt = cam.constraints.new("TRACK_TO"); tt.target = objs[0]; tt.track_axis = "TRACK_NEGATIVE_Z"; tt.up_axis = "UP_Y"
r = size * 3.2
for f, ang in ((1, -38), (96, -30)):  # ~8 degree slide: "just enough"
    a = math.radians(ang)
    cam.location = (c[0] + r * math.sin(a), c[1] - r * math.cos(a), mins[2] + size * 0.35)
    cam.keyframe_insert("location", frame=f)

sc.frame_start, sc.frame_end = 1, 96
sc.render.fps = 30
sc.render.resolution_x, sc.render.resolution_y = 1080, 1920
sc.render.engine = "CYCLES"; sc.cycles.samples = 256
sc.render.film_transparent = True
sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"

# Pass 1: beauty with alpha (shadow catcher contributes shadow into alpha)
sc.render.filepath = str(out / "hero_beauty_")
bpy.ops.render.render(animation=True)
# Pass 2: shadow only (product made holdout)
for o in objs: o.is_holdout = True
sc.render.filepath = str(out / "hero_shadow_")
bpy.ops.render.render(animation=True)
print("done ->", out)
