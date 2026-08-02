"""STL 打印高模 -> 游戏用 GLB
用法: python tools/stl_to_glb.py <输入.stl> <输出.glb> [目标面数]
处理: 减面(fast_simplification) -> 居中 -> 缩放到高度 1.0 -> 导出 GLB
"""

import sys
import numpy as np
import trimesh
import fast_simplification


def main():
    src, dst = sys.argv[1], sys.argv[2]
    target_faces = int(sys.argv[3]) if len(sys.argv) > 3 else 40000

    mesh = trimesh.load(src, force="mesh")
    print(f"原始: {len(mesh.faces)} 面, 包围盒 {np.round(mesh.extents, 2)}")

    reduction = 1.0 - target_faces / len(mesh.faces)
    if reduction > 0:
        pts, faces = fast_simplification.simplify(
            mesh.vertices, mesh.faces, target_reduction=reduction, agg=7
        )
        mesh = trimesh.Trimesh(pts, faces, process=True)

    # 居中：底面中心对齐原点（方便游戏里按"脚底"定位）
    mesh.apply_translation(-mesh.bounds.mean(axis=0) + [0, mesh.extents[2] / 2, 0])
    # 归一化：高度 = 1.0（游戏内再按需缩放）
    mesh.apply_scale(1.0 / mesh.extents[2])

    mesh.export(dst)
    print(f"输出: {len(mesh.faces)} 面 -> {dst}")


if __name__ == "__main__":
    main()
