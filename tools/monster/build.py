import sys; sys.path.insert(0, '.')
from common import *
import numpy as np

# ---------------------------------------------------------------- materiali
def mat_skin(name='skin'):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    N = nt.nodes; L = nt.links
    out = N.new('ShaderNodeOutputMaterial'); bsdf = N.new('ShaderNodeBsdfPrincipled')
    tc = N.new('ShaderNodeTexCoord')
    warp = N.new('ShaderNodeTexNoise'); warp.inputs['Scale'].default_value = 14; warp.inputs['Detail'].default_value = 3; L.new(tc.outputs['Object'], warp.inputs['Vector'])
    wv = N.new('ShaderNodeVectorMath'); wv.operation = 'ADD'; L.new(tc.outputs['Object'], wv.inputs[0])
    ws = N.new('ShaderNodeVectorMath'); ws.operation = 'SCALE'; ws.inputs['Scale'].default_value = 0.035; L.new(warp.outputs['Color'], ws.inputs[0]); L.new(ws.outputs[0], wv.inputs[1])
    vor = N.new('ShaderNodeTexVoronoi'); vor.feature = 'DISTANCE_TO_EDGE'; vor.inputs['Scale'].default_value = 34; L.new(wv.outputs[0], vor.inputs['Vector'])
    vor2 = N.new('ShaderNodeTexVoronoi'); vor2.feature = 'DISTANCE_TO_EDGE'; vor2.inputs['Scale'].default_value = 95; L.new(wv.outputs[0], vor2.inputs['Vector'])
    noi = N.new('ShaderNodeTexNoise'); noi.inputs['Scale'].default_value = 7; noi.inputs['Detail'].default_value = 8; L.new(tc.outputs['Object'], noi.inputs['Vector'])
    noi2 = N.new('ShaderNodeTexNoise'); noi2.inputs['Scale'].default_value = 40; noi2.inputs['Detail'].default_value = 4; L.new(tc.outputs['Object'], noi2.inputs['Vector'])
    cr = N.new('ShaderNodeMapRange'); cr.inputs['From Min'].default_value = 0.0; cr.inputs['From Max'].default_value = 0.042; cr.clamp = True; L.new(vor.outputs['Distance'], cr.inputs['Value'])
    cr2 = N.new('ShaderNodeMapRange'); cr2.inputs['From Min'].default_value = 0.0; cr2.inputs['From Max'].default_value = 0.06; cr2.clamp = True; L.new(vor2.outputs['Distance'], cr2.inputs['Value'])
    big = N.new('ShaderNodeMapRange'); big.inputs['From Min'].default_value = 0.42; big.inputs['From Max'].default_value = 0.56; big.clamp = True; L.new(noi.outputs['Fac'], big.inputs['Value'])   # dove le crepe grandi esistono (a zone)
    cr_big = N.new('ShaderNodeMath'); cr_big.operation = 'MAXIMUM'; L.new(cr.outputs[0], cr_big.inputs[0]); L.new(big.outputs[0], cr_big.inputs[1])
    mul = N.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; L.new(cr_big.outputs[0], mul.inputs[0]); L.new(cr2.outputs[0], mul.inputs[1])
    ramp = N.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color = (0.0025, 0.002, 0.0018, 1); ramp.color_ramp.elements[1].color = (0.030, 0.023, 0.019, 1); e = ramp.color_ramp.elements.new(0.93); e.color = (0.15, 0.14, 0.13, 1); e2 = ramp.color_ramp.elements.new(0.80); e2.color = (0.07, 0.055, 0.047, 1); L.new(noi.outputs['Fac'], ramp.inputs['Fac'])
    wound = N.new('ShaderNodeRGB'); wound.outputs[0].default_value = (0.16, 0.012, 0.006, 1)
    mix = N.new('ShaderNodeMixRGB'); L.new(mul.outputs[0], mix.inputs['Fac']); L.new(wound.outputs[0], mix.inputs['Color1']); L.new(ramp.outputs[0], mix.inputs['Color2'])
    shiny = N.new('ShaderNodeMapRange'); shiny.inputs['From Min'].default_value = 0.58; shiny.inputs['From Max'].default_value = 0.72; shiny.clamp = True; L.new(noi2.outputs['Fac'], shiny.inputs['Value'])
    rough = N.new('ShaderNodeMapRange'); rough.inputs['To Min'].default_value = 0.82; rough.inputs['To Max'].default_value = 0.32; L.new(shiny.outputs[0], rough.inputs['Value'])
    L.new(mix.outputs[0], bsdf.inputs['Base Color']); L.new(rough.outputs[0], bsdf.inputs['Roughness'])
    emi = N.new('ShaderNodeMapRange'); emi.inputs['From Min'].default_value = 0.0; emi.inputs['From Max'].default_value = 0.0065; emi.inputs['To Min'].default_value = 1; emi.inputs['To Max'].default_value = 0; emi.clamp = True; L.new(vor.outputs['Distance'], emi.inputs['Value'])
    blot = N.new('ShaderNodeMapRange'); blot.inputs['From Min'].default_value = 0.56; blot.inputs['From Max'].default_value = 0.7; blot.clamp = True; L.new(noi.outputs['Fac'], blot.inputs['Value'])
    em2 = N.new('ShaderNodeMath'); em2.operation = 'MULTIPLY'; L.new(emi.outputs[0], em2.inputs[0]); L.new(blot.outputs[0], em2.inputs[1])
    em3 = N.new('ShaderNodeMath'); em3.operation = 'MULTIPLY'; em3.inputs[1].default_value = 2.2; L.new(em2.outputs[0], em3.inputs[0])
    L.new(em3.outputs[0], bsdf.inputs['Emission Strength']); bsdf.inputs['Emission Color'].default_value = (1.0, 0.24, 0.03, 1)
    bump = N.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 1.6; bump.inputs['Distance'].default_value = 0.012; L.new(mul.outputs[0], bump.inputs['Height']); L.new(bump.outputs[0], bsdf.inputs['Normal'])
    L.new(bsdf.outputs[0], out.inputs[0]); return m

def mat_simple(name, col, rough=0.6, emit=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = col; b.inputs['Roughness'].default_value = rough
    return m

def skin_mod(ob, level=3):
    s = ob.modifiers.new('sub', 'SUBSURF'); s.levels = level; s.render_levels = level
    return ob

def displace(ob, strength, scale, w=(-1, 1, 0, 0)):
    t = bpy.data.textures.new('vt', 'VORONOI'); t.noise_scale = scale; t.weight_1, t.weight_2, t.weight_3, t.weight_4 = w; t.color_mode = 'INTENSITY'; t.noise_intensity = 1.0
    d = ob.modifiers.new('disp', 'DISPLACE'); d.texture = t; d.strength = strength; d.mid_level = 0.35; d.texture_coords = 'LOCAL'
    return d

# ---------------------------------------------------------------- corpo
def build_body():
    V = []; E = []
    def add(x, y, z, rx, ry=None, parent=None):
        V.append((x, y, z, rx, ry if ry is not None else rx)); i = len(V) - 1
        if parent is not None: E.append((parent, i)); 
        return i
    pel = add(0, 0.02, 0.93, 0.12, 0.09); bel = add(0, 0.0, 1.10, 0.085, 0.075, pel); che = add(0, -0.07, 1.29, 0.125, 0.085, bel)
    upp = add(0, -0.16, 1.45, 0.125, 0.07, che); nek = add(0, -0.30, 1.54, 0.04, 0.04, upp)
    for s in (1, -1):
        sh = add(0.185 * s, -0.15, 1.45, 0.045, 0.04, upp); el = add(0.27 * s, -0.12, 1.16, 0.034, 0.032, sh)
        wr = add(0.29 * s, -0.16, 0.76, 0.024, 0.02, el); pa = add(0.29 * s, -0.19, 0.60, 0.026, 0.011, wr)
        for dx, dy in [(-0.04, 0), (-0.015, -0.02), (0.01, -0.025), (0.035, -0.015), (0.052, 0.03)]:
            f1 = add(0.29 * s + dx * s, -0.20 + dy, 0.50 - abs(dx), 0.009, 0.008, pa); f2 = add(0.29 * s + dx * 1.4 * s, -0.21 + dy, 0.37 - abs(dx), 0.0075, 0.0065, f1)
            add(0.29 * s + dx * 1.6 * s, -0.215 + dy, 0.29 - abs(dx), 0.006, 0.005, f2)
        hp = add(0.095 * s, 0.02, 0.90, 0.06, 0.06, pel); kn = add(0.105 * s, -0.05, 0.50, 0.04, 0.04, hp)
        an = add(0.105 * s, 0.0, 0.09, 0.027, 0.027, kn); ft = add(0.105 * s, -0.12, 0.03, 0.026, 0.035, an); add(0.105 * s, -0.20, 0.02, 0.016, 0.016, ft)
    ob = skin_figure('body', V, E); skin_mod(ob, 3)
    return ob

def sphere_obj(name, loc, scale, seg=48, rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1, location=loc); o = bpy.context.object; o.name = name; o.scale = scale
    bpy.ops.object.transform_apply(scale=True); return o

def build_head():
    # cranio: sfera scolpita a colpi di "dent" gaussiani (orbite, naso, bocca, guance), mandibola allungata a parte
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=64, radius=1, location=(0, 0, 0)); o = bpy.context.object; o.name = 'head'
    me = o.data; co = np.array([v.co[:] for v in me.vertices]); 
    sx, sy, sz = 0.078, 0.098, 0.115
    P = co * np.array([sx, sy, sz])
    def dent(P, c, r, depth, axis=(0, -1, 0)):
        d = np.linalg.norm(P - np.array(c), axis=1); w = np.exp(-(d / r) ** 2)
        P += np.outer(w * depth, np.array(axis)); return P
    # fronte = -Y. Spingere verso +Y = incavo
    front = P[:, 1] < 0
    for sxn in (1, -1):
        P = dent(P, (0.032 * sxn, -0.085, 0.020), 0.026, 0.040, (0, 1, 0))      # orbite profonde
        P = dent(P, (0.038 * sxn, -0.070, -0.030), 0.030, 0.014, (0, 1, 0))     # guance scavate
        P = dent(P, (0.040 * sxn, -0.082, 0.060), 0.030, -0.008, (0, 1, 0))     # arcata sopraccigliare in rilievo
    P = dent(P, (0, -0.098, -0.010), 0.014, 0.020, (0, 1, 0))                    # naso collassato
    P = dent(P, (0, -0.093, -0.075), 0.040, 0.020, (0, 1, 0))                    # bocca incavata (la apriamo con la mandibola)
    P = dent(P, (0, -0.0, 0.07), 0.07, -0.006, (0, 0, 1)); 
    # asimmetria: lato sinistro più fuso/schiacciato
    P[:, 0] += 0.006 * np.exp(-((P[:, 2] + 0.02) / 0.06) ** 2) * (P[:, 0] > 0)
    for v, p in zip(me.vertices, P): v.co = p
    o.rotation_euler = (math.radians(14), 0, math.radians(-7))   # testa reclinata
    return o

def torso_center(z):
    # centro (y) del torace a quota z, dall'interpolazione della colonna ingobbita
    pts = [(0.93, 0.02), (1.10, 0.0), (1.29, -0.07), (1.45, -0.16)]
    for (z0, y0), (z1, y1) in zip(pts, pts[1:]):
        if z0 <= z <= z1: return y0 + (y1 - y0) * (z - z0) / (z1 - z0)
    return pts[-1][1]

def build_ribs(a=0.128, b=0.094, n=9, z_top=1.42, dz=0.040):
    objs = []
    for i in range(n):
        z = z_top - i * dz; cy = torso_center(z); k = 1 - 0.06 * abs(i - 3) ** 1.2
        for s_ in (1, -1):
            bpy.ops.curve.primitive_bezier_curve_add(); c = bpy.context.object; c.name = f'rib{i}_{s_}'
            sp = c.data.splines[0]; degs = (160, 125, 90, 55, 25); sp.bezier_points.add(len(degs) - 2)
            for dg, bp in zip(degs, sp.bezier_points):
                t = math.radians(dg); bp.co = (s_ * a * k * math.sin(t), cy - b * k * math.cos(t), z + 0.01 - 0.045 * (160 - dg) / 135)
                bp.handle_left_type = bp.handle_right_type = 'AUTO'
            c.data.bevel_depth = 0.0105 - 0.0004 * i; c.data.bevel_resolution = 4; c.data.resolution_u = 14
            objs.append(c)
    return objs

def ellipsoid(name, loc, sc, seg=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1, location=loc); o = bpy.context.object; o.name = name; o.scale = sc
    bpy.ops.object.transform_apply(scale=True); return o

def build_head2():
    """Cranio allungato e scavato + mandibola slogata + denti + braci negli occhi. Origine = centro del cranio; fronte = -Y."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=128, ring_count=80, radius=1, location=(0, 0, 0)); o = bpy.context.object; o.name = 'head'
    me = o.data; co = np.array([v.co[:] for v in me.vertices]); P = co * np.array([0.072, 0.105, 0.128])
    # rastremazione verso il mento, zigomi alti
    low = np.clip((-P[:, 2] - 0.02) / 0.11, 0, 1); P[:, 0] *= (1 - 0.38 * low ** 1.3); P[:, 1] *= (1 - 0.22 * low)
    zyg = np.exp(-(((P[:, 2] + 0.01) / 0.03) ** 2)); P[:, 0] *= (1 + 0.14 * zyg)
    def dent(P, c, r, depth, axis=(0, 1, 0)):
        d = np.linalg.norm(P - np.array(c), axis=1); w = np.exp(-(d / r) ** 2); P += np.outer(w * depth, np.array(axis)); return P
    for sx in (1, -1):
        P = dent(P, (0.030 * sx, -0.100, 0.030), 0.024, 0.052)       # orbite profonde
        P = dent(P, (0.040 * sx, -0.090, -0.030), 0.034, 0.020)      # guance scavate
        P = dent(P, (0.036 * sx, -0.098, 0.062), 0.030, -0.010)      # arcate sopraccigliari
        P = dent(P, (0.060 * sx, -0.050, -0.005), 0.025, -0.006)     # zigomi in fuori
        P = dent(P, (0.062 * sx, -0.020, 0.00), 0.03, 0.010)         # tempie incavate
    P = dent(P, (0, -0.108, -0.012), 0.014, 0.030)                    # naso: cavità
    P = dent(P, (0, -0.095, -0.062), 0.040, 0.030)                    # zona della bocca, scavata
    P[:, 0] += 0.007 * np.exp(-((P[:, 2] + 0.03) / 0.07) ** 2) * (P[:, 0] > 0)     # lato fuso, appena asimmetrico
    for v, p in zip(me.vertices, P): v.co = p
    bpy.ops.object.shade_smooth()
    return o

def build_jaw():
    jaw = ellipsoid('jaw', (0, -0.075, -0.158), (0.042, 0.065, 0.034), 40, 20)
    me = jaw.data; P = np.array([v.co[:] for v in me.vertices]); c = np.array([0, -0.075, -0.158]); R = P - c
    R[:, 1] *= 1 + 0.0; P = c + R; low = np.clip((-0.158 - P[:, 2]) / 0.03 + 0.5, 0, 1)
    P[:, 0] *= (1 - 0.25 * (P[:, 1] < -0.09)); P[:, 2] -= 0.02 * np.exp(-(((P[:, 1] + 0.12) / 0.03) ** 2))   # mento
    for v, p in zip(me.vertices, P): v.co = p
    bpy.ops.object.shade_smooth(); return jaw

def build_teeth(rows):
    teeth = []
    for z0, y_off, up in rows:
        n = 15
        for i in range(n):
            u = (i / (n - 1) - 0.5) * 2; x = u * 0.034; y = -0.108 + 0.06 * (u * u) * 0.8 - 0.002 + y_off; 
            if random.random() < 0.18: continue                                   # denti mancanti
            h = random.uniform(0.012, 0.024) * (1.0 + 0.5 * (1 - abs(u)))
            bpy.ops.mesh.primitive_cone_add(vertices=7, radius1=0.0042, radius2=0.0008, depth=h, location=(x + random.uniform(-0.002, 0.002), y, z0 + (h / 2) * (-up)))
            t = bpy.context.object; t.rotation_euler = (math.radians(180 if up == 1 else 0) + random.uniform(-0.2, 0.2), random.uniform(-0.2, 0.2), 0); teeth.append(t)
    return teeth

def curve_strand(pts, bevel=0.0014, name='h'):
    bpy.ops.curve.primitive_bezier_curve_add(); c = bpy.context.object; c.name = name; sp = c.data.splines[0]; sp.bezier_points.add(len(pts) - 2)
    for p, bp in zip(pts, sp.bezier_points): bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'
    c.data.bevel_depth = bevel; c.data.bevel_resolution = 2; c.data.resolution_u = 6; return c

def build_hair(head_pos, n=70, seed=3):
    rnd = random.Random(seed); out = []
    for i in range(n):
        ang = rnd.uniform(-math.pi * 0.98, math.pi * 0.98)
        r0 = rnd.uniform(0.045, 0.078); x0 = head_pos[0] + r0 * math.sin(ang) * 0.95; y0 = head_pos[1] + 0.03 - r0 * math.cos(ang) * 1.1; z0 = head_pos[2] + rnd.uniform(0.06, 0.115)
        face = abs(ang) < 0.7                                              # i capelli sul viso: pochi e corti
        if face and rnd.random() < 0.65: continue
        L = rnd.uniform(0.25, 0.75) * (0.45 if face else 1.0); pts = []; wob = rnd.uniform(0.006, 0.02); ph = rnd.uniform(0, 6.28)
        for k in range(9):
            t = k / 8.0
            pts.append((x0 + 0.04 * math.sin(ang) * t + wob * math.sin(t * 6 + ph), y0 + 0.07 * t * (0.3 if face else 1.0) + wob * math.cos(t * 5 + ph), z0 - L * t * (1 - 0.15 * t) + 0.01 * math.sin(t * 8 + i)))
        out.append(curve_strand(pts, rnd.uniform(0.0016, 0.0026), f'hair{i}'))
    return out

def build_skirt():
    """Camicia d'ospedale bruciata: gonna sfrangiata dai fianchi alle ginocchia + brandelli."""
    N, M = 56, 22; bm = bmesh.new(); rows = []
    rnd = random.Random(11); phase = [rnd.uniform(0, 6.28) for _ in range(4)]
    for j in range(M + 1):
        t = j / M; z = 1.04 - t * 0.55
        row = []
        for i in range(N):
            th = 2 * math.pi * i / N; r = (0.135 + 0.11 * t ** 1.2) * (1 + 0.16 * math.sin(th * 5 + phase[0] + t * 3) + 0.09 * math.sin(th * 11 + phase[1]) + 0.05 * math.sin(th * 23 + phase[2]))
            cy = 0.015 - 0.0 * t
            x = r * math.sin(th) * 1.05; y = cy + r * math.cos(th) * 0.9
            row.append(bm.verts.new((x, y, z)))
        rows.append(row)
    for j in range(M):
        for i in range(N):
            bm.faces.new((rows[j][i], rows[j][(i + 1) % N], rows[j + 1][(i + 1) % N], rows[j + 1][i]))
    # orlo sfrangiato: sposta in su i vertici delle ultime righe secondo un profilo a denti
    for i in range(N):
        th = 2 * math.pi * i / N; tooth = (abs(math.sin(th * 4.5 + phase[2])) ** 0.6) * 0.20 + (abs(math.sin(th * 13 + phase[3])) ** 2) * 0.07
        for j in range(M - 6, M + 1):
            w = (j - (M - 6)) / 6.0; rows[j][i].co.z += tooth * w ** 1.5
    me = bpy.data.meshes.new('skirt'); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new('skirt', me); bpy.context.collection.objects.link(o)
    o.modifiers.new('solid', 'SOLIDIFY').thickness = 0.004
    return o

def knob(name, loc, sc):
    o = ellipsoid(name, loc, sc, 24, 12); return o

def mat_cloth(name='cloth'):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear(); N = nt.nodes; L = nt.links
    out = N.new('ShaderNodeOutputMaterial'); b = N.new('ShaderNodeBsdfPrincipled'); tc = N.new('ShaderNodeTexCoord')
    n1 = N.new('ShaderNodeTexNoise'); n1.inputs['Scale'].default_value = 5; n1.inputs['Detail'].default_value = 8; L.new(tc.outputs['Object'], n1.inputs['Vector'])
    n2 = N.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = 70; n2.inputs['Detail'].default_value = 2; L.new(tc.outputs['Object'], n2.inputs['Vector'])
    sep = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], sep.inputs[0])
    hem = N.new('ShaderNodeMapRange'); hem.inputs['From Min'].default_value = 1.0; hem.inputs['From Max'].default_value = 0.66; hem.clamp = True; L.new(sep.outputs['Z'], hem.inputs['Value'])        # bruciato verso l'orlo
    burn = N.new('ShaderNodeMath'); burn.operation = 'MULTIPLY'; L.new(hem.outputs[0], burn.inputs[0]); L.new(n1.outputs['Fac'], burn.inputs[1]); burn.inputs[1].default_value = 1.0
    ramp = N.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color = (0.012, 0.009, 0.007, 1); ramp.color_ramp.elements[1].color = (0.115, 0.095, 0.065, 1); L.new(n1.outputs['Fac'], ramp.inputs['Fac'])
    dark = N.new('ShaderNodeMixRGB'); dark.inputs['Color2'].default_value = (0.005, 0.004, 0.003, 1); L.new(hem.outputs[0], dark.inputs['Fac']); L.new(ramp.outputs[0], dark.inputs['Color1'])
    L.new(dark.outputs[0], b.inputs['Base Color']); b.inputs['Roughness'].default_value = 0.95
    bump = N.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.35; L.new(n2.outputs['Fac'], bump.inputs['Height']); L.new(bump.outputs[0], b.inputs['Normal'])
    L.new(b.outputs[0], out.inputs[0]); return m
