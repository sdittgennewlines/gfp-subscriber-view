"""
build_map.py: turn Natural Earth country borders into ready-to-draw SVG paths.

Run once (the output is committed, so the site never needs this script):

    python3 tools/build_map.py path/to/ne_110m_admin_0_countries.geojson

Writes data/world.json:

    {
      "width": 1200, "height": 560,          # SVG viewBox size
      "countries": [
        { "name": "Sudan",                   # Natural Earth NAME (see config.js placeAliases)
          "d": "M...Z",                      # SVG path, already projected
          "label": [x, y] },                 # where to put a chip/label
        ...
      ],
      "project": { ... }                     # projection constants, so the
                                             # browser can place pins by lon/lat
    }

Projection: Natural Earth I (the same one d3.geoNaturalEarth1 uses), which is
what the design mockup's map was drawn with. Antarctica is dropped.

Source data: Natural Earth (public domain), https://www.naturalearthdata.com
"""
import json
import math
import sys
from pathlib import Path

WIDTH = 1200          # output width in SVG units; height follows from the map's shape
PRECISION = 1         # decimals kept in path coordinates (1 = ~0.1px, plenty)
DROP = {"Antarctica", "Fr. S. Antarctic Lands"}


def natural_earth(lon, lat):
    """Natural Earth I projection, in radians-based units (unscaled)."""
    lam, phi = math.radians(lon), math.radians(lat)
    p2 = phi * phi
    p4 = p2 * p2
    x = lam * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)))
    y = phi * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))
    return x, -y  # SVG y grows downward


def rings(geometry):
    """Yield every ring of a Polygon or MultiPolygon."""
    if geometry["type"] == "Polygon":
        yield from geometry["coordinates"]
    else:
        for poly in geometry["coordinates"]:
            yield from poly


def main(src):
    features = [f for f in json.load(open(src))["features"] if f["properties"]["NAME"] not in DROP]

    # 1. Bounds of the projected map, used to scale it to WIDTH.
    xs, ys = [], []
    for f in features:
        for ring in rings(f["geometry"]):
            for lon, lat in ring:
                x, y = natural_earth(lon, lat)
                xs.append(x)
                ys.append(y)
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    k = WIDTH / (x1 - x0)
    height = round((y1 - y0) * k)

    def to_svg(lon, lat):
        x, y = natural_earth(lon, lat)
        return round((x - x0) * k, PRECISION), round((y - y0) * k, PRECISION)

    # 2. One path per country.
    out = []
    for f in features:
        p = f["properties"]
        parts = []
        for ring in rings(f["geometry"]):
            pts = [to_svg(lon, lat) for lon, lat in ring]
            parts.append("M" + "L".join(f"{x:g},{y:g}" for x, y in pts) + "Z")
        out.append({
            "name": p["NAME"],
            "d": "".join(parts),
            "label": list(to_svg(p["LABEL_X"], p["LABEL_Y"])),
        })
    out.sort(key=lambda c: c["name"])

    dest = Path(__file__).resolve().parent.parent / "data" / "world.json"
    dest.write_text(json.dumps({
        "width": WIDTH,
        "height": height,
        "source": "Natural Earth 1:110m Admin 0 countries (public domain)",
        # Lets the browser project a lon/lat pin the same way: see js/map/projection.js
        "project": {"x0": x0, "y0": y0, "k": k},
        "countries": out,
    }, separators=(",", ":")))
    print(f"wrote {dest} ({len(out)} countries, {WIDTH}x{height}, {dest.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main(sys.argv[1])
