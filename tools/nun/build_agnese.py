"""Rebuild Suor Agnese from the original, then bake and export the game asset.

Run from the repository root with Blender 4.3 or later.
The original mesh supplies proportions and silhouette. New eyes, eyelids,
mask pleats, fingernails and garment seams are editable geometry.
"""
import bpy
import bmesh
import json
import math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/models/agnese'
REVIEW = ROOT / 'tools/nun/review'
OUT.mkdir(parents=True, exist_ok=True)
REVIEW.mkdir(parents=True, exist_ok=True)
SOURCE=ROOT/'tools/nun/source'
SOURCE.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.cycles.use_denoising = False
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'assets/models/c_nurse.glb'))
original = next(o for o in scene.objects if o.type == 'MESH')
bpy.context.view_layer.objects.active = original
original.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bm = bmesh.new()
bm.from_mesh(original.data)
bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.0001)
bm.to_mesh(original.data)
bm.free()
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='LOOSE')
bpy.ops.object.mode_set(mode='OBJECT')

def material(name, color, roughness, scale, bump_distance):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = roughness
    coords = nodes.new('ShaderNodeNewGeometry')
    fine = nodes.new('ShaderNodeTexNoise')
    fine.inputs['Scale'].default_value = scale
    fine.inputs['Detail'].default_value = 3
    links.new(coords.outputs['Position'], fine.inputs['Vector'])
    broad = nodes.new('ShaderNodeTexNoise')
    broad.inputs['Scale'].default_value = 24 if 'skin' in name else 12
    broad.inputs['Detail'].default_value = 4
    links.new(coords.outputs['Position'], broad.inputs['Vector'])
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.18
    ramp.color_ramp.elements[0].color = tuple(c * 0.38 for c in color) + (1,)
    ramp.color_ramp.elements[1].position = 0.8
    ramp.color_ramp.elements[1].color = tuple(color) + (1,)
    links.new(broad.outputs['Fac'], ramp.inputs[0])
    links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    if name == 'Aged ivory linen':
        separate=nodes.new('ShaderNodeSeparateXYZ')
        links.new(coords.outputs['Position'],separate.inputs[0])
        hem=nodes.new('ShaderNodeMapRange')
        hem.inputs['From Min'].default_value=.28
        hem.inputs['From Max'].default_value=.67
        hem.inputs['To Min'].default_value=.58
        hem.inputs['To Max'].default_value=0
        links.new(separate.outputs['Z'],hem.inputs['Value'])
        grime=nodes.new('ShaderNodeMixRGB')
        links.new(hem.outputs['Result'],grime.inputs[0])
        links.new(ramp.outputs['Color'],grime.inputs[1])
        grime.inputs[2].default_value=(.105,.069,.032,1)
        links.new(grime.outputs[0],bsdf.inputs['Base Color'])
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.32
    bump.inputs['Distance'].default_value = bump_distance
    links.new(fine.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    # Roughness is spatially varied and baked for glTF portability.
    rough = nodes.new('ShaderNodeMapRange')
    rough.inputs['To Min'].default_value = max(0.15, roughness - 0.13)
    rough.inputs['To Max'].default_value = min(1, roughness + 0.09)
    links.new(fine.outputs['Fac'], rough.inputs['Value'])
    links.new(rough.outputs['Result'], bsdf.inputs['Roughness'])
    return mat


def add_dried_blood(source):
    """Bake localized absorbed stains into the dress material in world space."""
    mat = source.copy()
    mat.name = 'Ivory dress with absorbed blood'
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    geometry = next(node for node in nodes if node.type == 'NEW_GEOMETRY')
    cloth_color = bsdf.inputs['Base Color'].links[0].from_socket
    cloth_roughness = bsdf.inputs['Roughness'].links[0].from_socket

    def scalar(operation, first, second):
        node = nodes.new('ShaderNodeMath')
        node.operation = operation
        for index, value in enumerate((first, second)):
            if isinstance(value, (int, float)):
                node.inputs[index].default_value = value
            else:
                links.new(value, node.inputs[index])
        return node.outputs[0]

    def falloff(distance, inner, outer):
        node = nodes.new('ShaderNodeMapRange')
        node.interpolation_type = 'SMOOTHSTEP'
        node.inputs['From Min'].default_value = inner
        node.inputs['From Max'].default_value = outer
        node.inputs['To Min'].default_value = 1
        node.inputs['To Max'].default_value = 0
        links.new(distance, node.inputs['Value'])
        return node.outputs['Result']

    coarse = nodes.new('ShaderNodeTexNoise')
    coarse.inputs['Scale'].default_value = 67
    coarse.inputs['Detail'].default_value = 4
    links.new(geometry.outputs['Position'], coarse.inputs['Vector'])
    fibers = nodes.new('ShaderNodeTexNoise')
    fibers.inputs['Scale'].default_value = 460
    fibers.inputs['Detail'].default_value = 2
    links.new(geometry.outputs['Position'], fibers.inputs['Vector'])
    edge_noise = scalar('SUBTRACT', scalar('MULTIPLY', coarse.outputs['Fac'], .56), .28)
    fiber_noise = scalar('SUBTRACT', scalar('MULTIPLY', fibers.outputs['Fac'], .10), .05)

    # Main absorbed patches, narrow gravity trails and scattered satellite drops.
    spots = [
        ((-.135, -.215, 1.238), (.035, .075, .042)),
        ((-.110, -.218, 1.205), (.030, .075, .051)),
        ((-.080, -.218, 1.248), (.035, .065, .015)),
        ((-.158, -.213, 1.210), (.021, .065, .018)),
        ((-.190, -.263, .760), (.037, .075, .080)),
        ((-.150, -.263, .802), (.043, .075, .022)),
        ((-.165, -.270, .704), (.023, .075, .044)),
        ((-.212, -.266, .718), (.016, .070, .023)),
        ((.005, -.263, .490), (.031, .075, .038)),
        ((.030, -.263, .518), (.027, .075, .017)),
        ((-.025, -.268, .479), (.036, .075, .014)),
        ((-.215, -.245, .365), (.027, .090, .014)),
        ((-.105, -.225, 1.128), (.004, .065, .075)),
        ((-.145, -.225, 1.170), (.0025, .065, .047)),
        ((-.164, -.270, .649), (.003, .075, .057)),
        ((-.196, -.275, .664), (.002, .070, .031)),
        ((.012, -.273, .431), (.002, .065, .035)),
        ((-.030, -.229, 1.250), (.004, .055, .006)),
        ((-.047, -.230, 1.190), (.0025, .055, .004)),
        ((-.200, -.257, .860), (.004, .055, .006)),
        ((-.075, -.266, .695), (.003, .060, .005)),
        ((.076, -.252, .545), (.003, .055, .005)),
        ((-.052, -.285, .404), (.0025, .065, .004)),
    ]
    core_union, halo_union = 0, 0
    for center, radius in spots:
        offset = nodes.new('ShaderNodeVectorMath')
        offset.operation = 'SUBTRACT'
        offset.inputs[1].default_value = center
        links.new(geometry.outputs['Position'], offset.inputs[0])
        normalized = nodes.new('ShaderNodeVectorMath')
        normalized.operation = 'MULTIPLY'
        normalized.inputs[1].default_value = tuple(1 / axis for axis in radius)
        links.new(offset.outputs[0], normalized.inputs[0])
        length = nodes.new('ShaderNodeVectorMath')
        length.operation = 'LENGTH'
        links.new(normalized.outputs[0], length.inputs[0])
        distance = scalar('ADD', scalar('ADD', length.outputs['Value'], edge_noise), fiber_noise)
        core_union = scalar('MAXIMUM', core_union, falloff(distance, .76, 1.04))
        halo_union = scalar('MAXIMUM', halo_union, falloff(distance, .98, 1.28))

    halo = nodes.new('ShaderNodeMixRGB')
    links.new(scalar('MULTIPLY', halo_union, .30), halo.inputs[0])
    links.new(cloth_color, halo.inputs[1])
    halo.inputs[2].default_value = (.18, .060, .024, 1)

    oxidation = nodes.new('ShaderNodeValToRGB')
    oxidation.color_ramp.elements[0].position = .23
    oxidation.color_ramp.elements[0].color = (.012, .0008, .0003, 1)
    oxidation.color_ramp.elements[1].position = .77
    oxidation.color_ramp.elements[1].color = (.065, .004, .0015, 1)
    links.new(coarse.outputs['Fac'], oxidation.inputs[0])
    blood = nodes.new('ShaderNodeMixRGB')
    links.new(core_union, blood.inputs[0])
    links.new(halo.outputs[0], blood.inputs[1])
    links.new(oxidation.outputs['Color'], blood.inputs[2])
    links.new(blood.outputs[0], bsdf.inputs['Base Color'])

    roughness = nodes.new('ShaderNodeMixRGB')
    links.new(core_union, roughness.inputs[0])
    links.new(cloth_roughness, roughness.inputs[1])
    roughness.inputs[2].default_value = (.79, .79, .79, 1)
    links.new(roughness.outputs[0], bsdf.inputs['Roughness'])
    return mat

cloth = material('Aged ivory linen', (.61, .52, .36), .86, 190, .00065)
maskmat = material('Worn ivory gauze', (.66, .59, .44), .93, 220, .0003)
skin = material('Agnese aged skin', (.24, .165, .125), .70, 1400, .00023)
darkskin = material('Orbital shadows', (.12, .055, .047), .74, 110, .0001)
leather = material('Worn leather', (.045, .032, .024), .58, 90, .0004)
nails = material('Unpolished nails', (.31, .25, .16), .48, 80, .0001)
seammat = material('Ivory stitching', (.38, .30, .19), .94, 160, .0002)
sclera = material('Clouded sclera', (.48, .44, .32), .22, 80, .00002)
iris = material('Pale grey iris', (.12, .15, .11), .22, 35, .00005)
pupil = material('Pupil', (.003, .003, .002), .13, 20, 0)

dress = add_dried_blood(cloth)

parts = []
finger_parts = []
hand_parts = []
head = None
cornette = None

def assign(obj, mat, region):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    for attr in list(obj.data.color_attributes):
        obj.data.color_attributes.remove(attr)
    obj['region'] = region
    parts.append(obj)

def subdivide(obj, level):
    bpy.context.view_layer.objects.active = obj
    modifier = obj.modifiers.new('Anatomical surface', 'SUBSURF')
    modifier.levels = level
    bpy.ops.object.modifier_apply(modifier=modifier.name)

for obj in list(scene.objects):
    if obj.type != 'MESH':
        continue
    count = len(obj.data.vertices)
    low = min(v.co.z for v in obj.data.vertices)
    high = max(v.co.z for v in obj.data.vertices)
    mid = sum((v.co for v in obj.data.vertices), Vector()) / count
    if count < 20:
        bpy.data.objects.remove(obj, do_unlink=True)
        continue
    if count == 506:
        head = obj
        obj.name = 'Agnese_face'
        assign(obj, skin, 'head')
        bm = bmesh.new(); bm.from_mesh(obj.data)
        bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=64)
        bm.to_mesh(obj.data); bm.free()
        bpy.context.view_layer.objects.active=obj
        remesh=obj.modifiers.new('Continuous facial surface','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.0014;remesh.use_smooth_shade=True
        bpy.ops.object.modifier_apply(modifier=remesh.name)
        relax=obj.modifiers.new('Relax skin surface','SMOOTH');relax.factor=.65;relax.iterations=4
        bpy.ops.object.modifier_apply(modifier=relax.name)
        # Subtle forehead creases and cheek hollowing, measured in metres.
        for vertex in obj.data.vertices:
            p = vertex.co
            front = max(0, min(1, (-p.y - .14) / .035))
            cheek = math.exp(-((abs(p.x + .13)-.043)/.018)**2 - ((p.z-1.519)/.023)**2)
            p.y += .0025 * cheek * front
            for line in (1.592, 1.599, 1.605):
                p.y += .00025 * front * math.exp(-((p.z-line)/.003)**2) * math.exp(-((p.x+.13)/.045)**4)
    elif count == 128:
        cornette = obj
        obj.name = 'Historical_cornette'
        assign(obj, cloth, 'head')
        # Keep the angular starched construction, with curved, thin edges.
        mod = obj.modifiers.new('Fabric tessellation', 'SUBSURF')
        mod.subdivision_type = 'SIMPLE'
        mod.levels = 2
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
        for vertex in obj.data.vertices:
            p = vertex.co
            edge = max(0, (abs(p.x + .13)-.075)/.23)
            p.z -= .011 * edge**2
            p.y += .004 * math.sin((p.x+.13)*16) * edge
    elif count == 25:
        obj.name = 'Finger'
        assign(obj, skin, 'hand.R' if mid.x > 0 else 'hand.L')
        finger_parts.append(obj)
        subdivide(obj, 2)
    elif count == 89:
        obj.name = 'Palm_and_thumb'
        assign(obj, skin, 'hand.R' if mid.x > 0 else 'hand.L')
        hand_parts.append(obj)
        subdivide(obj, 2)
        obj.data.materials.append(maskmat)
        cutoff=high-.065
        for polygon in obj.data.polygons:
            if sum(obj.data.vertices[i].co.z for i in polygon.vertices)/len(polygon.vertices)>cutoff:polygon.material_index=1
    elif count == 58 and high < .1:
        obj.name = 'Rounded_nursing_shoe'
        assign(obj, leather, 'foot.R' if mid.x > 0 else 'foot.L')
        subdivide(obj, 2)
    elif count == 140:
        obj.name = 'Neck'
        assign(obj, skin, 'neck')
        subdivide(obj, 2)
    else:
        obj.name = 'Ivory_garment'
        region = 'body'
        if high < .8 and low < .1:
            region = 'leg.R' if mid.x > 0 else 'leg.L'
        elif low > .83 and abs(mid.x+.10) > .18:
            region = 'arm.R' if mid.x > 0 else 'arm.L'
        fabric = maskmat if region.startswith('arm') else (dress if region == 'body' else cloth)
        assign(obj, fabric, region)
        subdivide(obj, 1)
        # Actual shallow vertical folds in the lower garment.
        if count in (442, 81, 56) and low < .4 and high > .7:
            for vertex in obj.data.vertices:
                p = vertex.co
                weight = max(0, min(1, (1.06-p.z)/.6))
                if p.z > .29:
                    p.y += .0045 * weight * math.sin((p.x+.10)*93 + p.z*2)
    for poly in obj.data.polygons:
        poly.use_smooth = True

def ellipsoid(name, center, radius, mat, region, segments=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = radius
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat, region)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj

def tube(name, coordinates, radius, mat, region):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 1
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new('POLY')
    spline.points.add(len(coordinates)-1)
    for point, coordinate in zip(spline.points, coordinates):
        point.co = tuple(coordinate) + (1,)
    obj = bpy.data.objects.new(name, curve)
    scene.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    assign(obj, mat, region)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj

# Recess the eyes and blend fleshy orbital surrounds into the face surface.
head_bvh = BVHTree.FromObject(head, bpy.context.evaluated_depsgraph_get())
for side, x in [('L', -.160), ('R', -.101)]:
    z = 1.570 + (.0007 if side == 'L' else 0)
    ellipsoid('Eye_'+side, (x,-.176,z), (.015,.009,.006), sclera, 'head', 24, 12)
    ellipsoid('Iris_'+side, (x+.001,-.1848,z), (.0055,.0006,.0055), iris, 'head', 24, 12)
    ellipsoid('Pupil_'+side, (x+.001,-.1854,z), (.0018,.0002,.0023), pupil, 'head', 16, 8)
    brow=[]
    for i in range(21):
        t=i/20
        px=x+(t-.5)*.034
        pz=z+.015+.003*math.sin(t*math.pi)
        hit=head_bvh.ray_cast(Vector((px,-1,pz)),Vector((0,1,0)))[0]
        brow.append((px,hit.y-.0005 if hit is not None else -.18,pz))
    tube('Sparse_eyebrow_'+side,brow,.00045,darkskin,'head')
    # Open an anatomical aperture in the continuous face; the eyeball sits behind it.
    bm=bmesh.new();bm.from_mesh(head.data)
    cut=[]
    for face in bm.faces:
        p=face.calc_center_median()
        if p.y<-.15 and ((p.x-x)/.015)**2+((p.z-z)/.0048)**2<1:
            cut.append(face)
    bmesh.ops.delete(bm,geom=cut,context='FACES')
    bm.to_mesh(head.data);bm.free()
    for upper in (True,False):
        coords=[]
        for i in range(33):
            t=i/32*math.pi
            px=x+.0155*math.cos(t);pz=z+(1 if upper else -1)*.005*math.sin(t)
            hit=head_bvh.ray_cast(Vector((px,-1,pz)),Vector((0,1,0)))[0]
            coords.append((px,hit.y-.0003 if hit is not None else -.183,pz))
        tube('Anatomical_eyelid_'+side,coords,.0008,skin,'head')

# A separate shaped gauze mask follows the face and has three horizontal pleats.
verts, faces = [], []
for row in range(17):
    v = row/16
    for col in range(33):
        u = col/32
        x = -.13+(u-.5)*(.117+.010*v)
        z = 1.465+v*.080 - .007*(1-v)*math.cos((u-.5)*math.pi) + .009*v*math.cos((u-.5)*math.pi)
        y = -.177 - .065*math.cos((u-.5)*math.pi) + .002*math.sin(v*6*math.pi)
        verts.append((x,y,z))
        if row and col:
            k = row*33+col
            faces.append((k-34,k-33,k,k-1))
mesh = bpy.data.meshes.new('Pleated_mask')
mesh.from_pydata(verts,[],faces)
mesh.update()
mask = bpy.data.objects.new('Pleated_gauze_mask',mesh)
scene.collection.objects.link(mask)
assign(mask,maskmat,'head')
for poly in mesh.polygons: poly.use_smooth=True
for row in (0,16):
    tube('Mask_hem', [verts[row*33+col] for col in range(33)], .0007, seammat, 'head')
for x in (-.1935,-.0665):
    tube('Mask_tie', [(x,-.192,1.515),(x,-.155,1.521),(x,-.105,1.515)], .0011, maskmat, 'head')

# Nails and flexion creases give each existing finger a readable tip and joints.
for finger in finger_parts:
    world = [finger.matrix_world @ vertex.co for vertex in finger.data.vertices]
    tip = min(world, key=lambda p:p.z)
    top = max(world, key=lambda p:p.z)
    axis = (top-tip).normalized()
    nail_center = tip + axis*.009 + Vector((0,-.004,0))
    nail = ellipsoid('Fingernail', nail_center, (.0045,.001,.007), nails, finger['region'], 12, 8)
    nail.rotation_euler = axis.to_track_quat('Z','Y').to_euler()
    for fraction in (.36,.67):
        p = tip.lerp(top,fraction)
        tube('Finger_joint_crease', [p+Vector((dx,-.005,0)) for dx in (-.004,0,.004)], .00035, darkskin, finger['region'])

# The starched cornette keeps its original sewn silhouette. Surface grain is baked.
# Single atlas material keeps the Android renderer to one skinned draw call.
bpy.ops.object.select_all(action='DESELECT')
for obj in parts: obj.select_set(True)
assert head is not None, 'Original head component not found'
bpy.context.view_layer.objects.active=head
# Preserve semantic vertex groups through join for an explicit animation rig.
for obj in parts:
    group=obj.vertex_groups.new(name=obj['region'])
    group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
bpy.ops.object.join()
character=bpy.context.object
character.name='Suor_Agnese'
modifier=character.modifiers.new('Mobile triangle budget','DECIMATE')
modifier.ratio=min(1,32000/max(1,sum(len(p.vertices)-2 for p in character.data.polygons)))
bpy.ops.object.modifier_apply(modifier=modifier.name)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(island_margin=.009)
bpy.ops.object.mode_set(mode='OBJECT')
scene.render.bake.margin=8
atlas={}
materials=list(character.data.materials)
for kind in ('basecolor','roughness','normal'):
    image=bpy.data.images.new('Agnese_'+kind,width=2048,height=2048)
    if kind!='basecolor':image.colorspace_settings.name='Non-Color'
    restored=[]
    for mat in materials:
        nodes,links=mat.node_tree.nodes,mat.node_tree.links
        output=nodes.get('Material Output')
        bsdf=nodes.get('Principled BSDF')
        target=nodes.new('ShaderNodeTexImage');target.image=image;nodes.active=target
        if kind!='normal':
            emit=nodes.new('ShaderNodeEmission')
            socket=bsdf.inputs['Base Color' if kind=='basecolor' else 'Roughness']
            if socket.is_linked:links.new(socket.links[0].from_socket,emit.inputs['Color'])
            else:
                value=socket.default_value
                emit.inputs['Color'].default_value=value if kind=='basecolor' else (value,value,value,1)
            links.new(emit.outputs[0],output.inputs['Surface'])
            restored.append((mat,emit))
    bpy.ops.object.bake(type='NORMAL' if kind=='normal' else 'EMIT')
    for mat,emit in restored:
        mat.node_tree.links.new(mat.node_tree.nodes.get('Principled BSDF').outputs[0],mat.node_tree.nodes.get('Material Output').inputs['Surface'])
        mat.node_tree.nodes.remove(emit)
    if kind!='basecolor': image.scale(1024,1024)
    extension='jpg' if kind=='basecolor' else 'png'
    image.filepath_raw=str(SOURCE/('Agnese_'+kind+'.'+extension))
    image.file_format='JPEG' if kind=='basecolor' else 'PNG'
    image.save();atlas[kind]=image

game=bpy.data.materials.new('Agnese_PBR');game.use_nodes=True
nodes,links=game.node_tree.nodes,game.node_tree.links
bsdf=nodes.get('Principled BSDF')
for kind,socket in [('basecolor','Base Color'),('roughness','Roughness')]:
    tex=nodes.new('ShaderNodeTexImage');tex.image=atlas[kind];links.new(tex.outputs['Color'],bsdf.inputs[socket])
tex=nodes.new('ShaderNodeTexImage');tex.image=atlas['normal']
normal=nodes.new('ShaderNodeNormalMap');links.new(tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],bsdf.inputs['Normal'])
character.data.materials.clear();character.data.materials.append(game)
for polygon in character.data.polygons:polygon.material_index=0

# Skeleton for subtle breathing, hand tension and controlled head motion.
armature=bpy.data.armatures.new('Agnese_skeleton')
rig=bpy.data.objects.new('Agnese_rig',armature);scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bones={
 'root':((-.10,-.07,.10),(-.10,-.07,.40),None),
 'body':((-.10,-.07,.85),(-.13,-.07,1.32),'root'),
 'neck':((-.13,-.07,1.32),(-.13,-.10,1.45),'body'),
 'head':((-.13,-.10,1.45),(-.13,-.10,1.65),'neck'),
 'arm.L':((-.24,-.07,1.30),(-.35,-.13,.93),'body'),
 'arm.R':((.04,-.07,1.32),(.16,-.15,.97),'body'),
 'hand.L':((-.35,-.13,.93),(-.40,-.16,.72),'arm.L'),
 'hand.R':((.16,-.15,.97),(.21,-.18,.76),'arm.R'),
 'leg.L':((-.18,-.12,.78),(-.19,-.12,.08),'root'),
 'leg.R':((.08,-.12,.79),(.13,-.12,.08),'root'),
 'foot.L':((-.19,-.12,.08),(-.19,-.25,.035),'leg.L'),
 'foot.R':((.13,-.12,.08),(.13,-.25,.035),'leg.R'),
}
for name,(start,end,parent) in bones.items():
    bone=armature.edit_bones.new(name);bone.head=start;bone.tail=end
    if parent:bone.parent=armature.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
character.parent=rig
modifier=character.modifiers.new('Agnese skeleton','ARMATURE');modifier.object=rig
rig.animation_data_create()
for name,duration in [('Idle',6),('HeadTurn',3),('Apparition',.6)]:
    action=bpy.data.actions.new(name);rig.animation_data.action=action
    frames=[0,duration*.24,duration*.5,duration*.77,duration]
    for second in frames:
        t=second/duration
        for bone_name in ('body','neck','head','hand.L','hand.R'):
            pose=rig.pose.bones[bone_name];pose.rotation_mode='XYZ'
            angles=(0,0,0)
            if name=='Idle':
                if bone_name=='body':angles=(.006*math.sin(t*2*math.pi),0,.003*math.sin(t*2*math.pi))
                if bone_name=='head':angles=(.004*math.sin(t*2*math.pi),.008*math.sin(t*2*math.pi),.012)
            elif name=='HeadTurn' and bone_name=='head':
                angles=(.025*math.sin(t*math.pi),.08*math.sin(t*math.pi),.09*math.sin(t*math.pi))
            elif name=='Apparition':
                settle=min(1,max(0,(t-.12)/.36))
                if bone_name=='head':angles=(.06*settle,.07*settle,.16*settle)
                if bone_name.startswith('hand'):angles=(.10*settle,0,.04*settle)
            pose.rotation_euler=angles
            pose.keyframe_insert(data_path='rotation_euler',frame=1+second*30)
    track=rig.animation_data.nla_tracks.new();track.name=name
    strip=track.strips.new(name,1,action)
    rig.animation_data.action=None
scene.render.fps=30
scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');character.select_set(True);rig.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'suor-agnese.glb'),export_format='GLB',use_selection=True,
                          export_animations=True,export_nla_strips=True,export_force_sampling=True,
                          export_cameras=False,export_lights=False)
triangles=sum(len(p.vertices)-2 for p in character.data.polygons)
(OUT/'metrics.json').write_text(json.dumps({'triangles':triangles,'bones':len(bones),'atlas':{'basecolor':2048,'normal':1024,'roughness':1024},'clips':['Idle','HeadTurn','Apparition'],'glb_bytes':(OUT/'suor-agnese.glb').stat().st_size},indent=2))

# Comparison lighting is fixed so the images can be assessed side by side.
world=bpy.data.worlds.new('Review studio');scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.12,.14,.18,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.4
def aim(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
for name,loc,energy,color,size in [('Key',(-1,-2,2.2),150,(.83,.90,1),1.3),('Fill',(1,-1,1.6),65,(1,.80,.60),1),('Rim',(.5,.8,2),180,(.6,.75,1),1)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.color=color;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=loc;aim(obj,(-.1,-.1,1.1))
bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO'
scene.render.resolution_x=720;scene.render.resolution_y=960;scene.render.resolution_percentage=100
scene.cycles.samples=32
scene.view_settings.view_transform='AgX'
for label,loc,target,scale in [('new-front',(-.10,-3,.85),(-.10,-.10,.85),1.96),('new-three-quarter',(1.3,-3,1.1),(-.10,-.10,.90),1.96),('new-face',(-.13,-3,1.55),(-.13,-.1,1.55),.35),('new-hands',(-.1,-3,.84),(-.1,-.1,.84),.98)]:
    camera.location=loc;aim(camera,target);camera.data.ortho_scale=scale
    scene.render.filepath=str(REVIEW/(label+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'suor-agnese.blend'),compress=True)
print('AGNESE_METRICS', (OUT/'metrics.json').read_text())

# Render the unmodified source under exactly the same studio lighting.
character.hide_render=True
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/models/c_nurse.glb'))
for label,loc,target,scale in [('original-front',(-.10,-3,.85),(-.10,-.10,.85),1.96),('original-face',(-.13,-3,1.55),(-.13,-.1,1.55),.35)]:
    camera.location=loc;aim(camera,target);camera.data.ortho_scale=scale
    scene.render.filepath=str(REVIEW/(label+'.png'));bpy.ops.render.render(write_still=True)
