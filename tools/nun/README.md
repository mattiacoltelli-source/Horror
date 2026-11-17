# Suor Agnese

The replacement is integrated in `js/events/scare.js` on `feature/nun-3d-upgrade`.
Open `agnese-preview.html` through a static web server for the original/new
comparison, touch rotation, face/hands framing and head animation. Its finale
button opens the actual game in the tower and triggers the existing scare.

The production Pages workflow excludes this feature branch.

## Files

- `assets/models/agnese/suor-agnese.glb` embeds the mesh, skin, three PBR maps and animations.
- `build_agnese.py` rebuilds it from the existing `assets/models/c_nurse.glb`.
- The **Suor Agnese - build and mobile checks** workflow provides the packed
  Blender source, separate textures, comparison renders, browser screenshots
  and a playable site ZIP in its `suor-agnese-completa` artifact.
- `assets/models/agnese/metrics.json` records the actual exported budget.

Run `blender -b --python tools/nun/build_agnese.py` from the repository root.
The local source was generated with Blender 4.3.2. No paid service or external
character asset is used. The original model remains available as a load fallback.

## Changes

The face surface is remeshed and relaxed. New recessed eyes, irises, pupils,
eyelids, brows and a pleated gauze mask replace the original flat eye shapes.
Fingers and palms have denser rounded surfaces, nails and joint creases.
The starched cornette retains its broad silhouette with softened outer edges.
The habit and outer cornette use a charcoal palette with an ivory coif, collar,
cuffs, belt, apron piping and a small painted cross. The face and neck use a
pallid skin tone. These palette details are baked into the existing atlas.
The dress retains its absorbed blood stains and shallow folds. Shoes have
rounded surfaces and a worn leather material.

The atlas contains a 2048 px base color and 1024 px normal and roughness maps.
One material and one skinned mesh use a target of 32,000 triangles and 12 bones.
`Idle`, `HeadTurn` and `Apparition` are embedded clips. The actual finale uses
`Apparition` and preserves the 0.95 s blackout, forward approach, 0.42 s exposure
and existing ending callback. `HeadTurn` is available in the review viewer.

## Verification and limits

`check_browser.py` opens the model viewer and the real game in a 393 × 852
touch viewport, checks the skinned draw call, switches original/new, runs both
ending variants and captures their visible frames. Its results are stored in
`review/browser-checks.json`. A successful export alone does not establish that
these browser checks passed.

The proportions and underlying stylisation still come from the original asset.
The result is an upgraded game character with procedural surface detail. It has
not received a photogrammetry or manual high-resolution anatomy sculpting pass.
The mask covers the lower face. Fingers are bound to hand bones and do not have
independent finger controls. No walking clip is used in this short finale.
Browser emulation and software rendering do not measure real Android GPU speed.
Visual approval and a real-device check are required before a production release.
