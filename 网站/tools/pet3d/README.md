# Pet Reference-to-3D Pipeline

This directory contains offline-only tooling for preparing TOM and 皮皮. It is
not part of the website runtime. Production now imports the open CC0 cat and dog
variations published by Mesh2Motion, then converts them to lightweight static
GLB assets for the website's procedural animation layer.

## Privacy

- Source photos stay under `work/pet3d/source/`.
- No photo is copied into `public/`.
- No source photo is sent to a third-party generation service.
- Only validated GLB files and derived PBR textures may be copied to the site.

## Current environment

The managed sandbox currently denies D-drive writes. With user approval, the
working environment and caches are kept under:

```text
work/pet3d/venv-system
work/pet3d/cache
work/pet3d/models
```

## Commands

```powershell
work\pet3d\venv-system\Scripts\python.exe tools\pet3d\import_mesh2motion.py
work\pet3d\venv-system\Scripts\python.exe -m unittest discover -s tools\pet3d\tests -p "test_*.py" -v
node tools\pet3d\render_turntable.mjs work/pet3d/output/tom-mesh2motion.glb TOM work/pet3d/output/tom-turntable.png
node tools\pet3d\render_turntable.mjs work/pet3d/output/pipi-mesh2motion.glb PIPI work/pet3d/output/pipi-turntable.png
```

`import_mesh2motion.py` converts the source variants to static meshes,
rewrites TOM's orange tabby texture to a cool blue-grey coat, and writes the
production assets under `public/pets/models/`. Source downloads are kept under:

```text
work/pet3d/eval/mesh2motion/cat.glb
work/pet3d/eval/mesh2motion/dog.glb
```

Both source files come from Mesh2Motion's `static/assets/fox/variations/`
directory. The artwork is CC0 1.0 and the project code is MIT. Published assets
and licences are recorded in `public/pets/attribution.md`.
