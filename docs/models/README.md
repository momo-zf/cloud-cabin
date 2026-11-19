# Web GLBs (our models only — never game meshes)

| file | source | raw size | web size | method |
|---|---|---|---|---|
| `home.web.glb` | Cabin scene export (`home.glb`) | 3.8 MB (3,968,256 B) | 355 KB (362.77 KB reported) | gltf-transform weld + prune + Draco, no simplify |
| `bed.web.glb` | Bed model export (`bed.glb`) | 115 KB | 17 KB | Draco only, no simplify, all nodes kept |
| `bedding_palette.json` | copied from the bed folder | — | — | 8 coordinated presets + per-part hex lists |

Do **not** use a fully `optimize`d bed (join/simplify drops `Bed_Pillow` and collider node names). Hide every node whose name starts with `Collider` in the viewer.

Bed fabrics in the GLB are a neutral white `#F7F4EE`. Colours are **not** baked in. Cycle the 8 `presets` from `bedding_palette.json` by setting `bed_sheet` / `bed_duvet` / `bed_pillow` base colors. Never tint `bed_wood`.
