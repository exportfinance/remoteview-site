"""Orbital Watch worker (staging).

Every cycle: for each watched site that is due, look for new Sentinel-2 L2A (Earth Search),
Landsat 8/9 C2 L2 and Sentinel-1 RTC (Planetary Computer) scenes, compare the newest clear
scene with a baseline built from earlier scenes, store before/after/change images, record
NASA FIRMS fire detections inside the site, write a plain-language summary and ask the app
to send browser push notifications for significant changes.
"""
import base64, csv, datetime as dt, io, json, logging, math, os, time, traceback
import numpy as np
import psycopg
import requests
import warnings
warnings.filterwarnings("ignore", category=RuntimeWarning)
import rasterio
from rasterio.enums import Resampling
from rasterio.features import geometry_mask
from rasterio.transform import from_origin
from rasterio.vrt import WarpedVRT
from rasterio.warp import transform_bounds, transform_geom
from scipy import ndimage
from PIL import Image
from pystac_client import Client

log = logging.getLogger("ow")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

DB = os.environ["DATABASE_URL"]
DATA = os.environ.get("OW_DATA_DIR", "/data/imagery")
APP = os.environ.get("OW_APP_URL", "http://app:3000")
INTERNAL = os.environ.get("OW_INTERNAL_KEY", "")
XAI_KEY = os.environ.get("XAI_API_KEY", "")
XAI_MODEL = os.environ.get("OW_XAI_MODEL", "grok-4.3")
CYCLE_S = int(os.environ.get("OW_CYCLE_SECONDS", "1800"))
SITE_EVERY_H = float(os.environ.get("OW_SITE_EVERY_HOURS", "3"))
MAX_PX = int(os.environ.get("OW_MAX_PX", "1024"))
LOOKBACK_D = int(os.environ.get("OW_LOOKBACK_DAYS", "120"))

os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif,.TIF,.tiff")
os.environ.setdefault("GDAL_HTTP_MAX_RETRY", "3")
os.environ.setdefault("GDAL_HTTP_RETRY_DELAY", "2")
os.environ.setdefault("GDAL_CACHEMAX", "64")
os.environ.setdefault("VSI_CACHE", "FALSE")

ES = "https://earth-search.aws.element84.com/v1"
PC = "https://planetarycomputer.microsoft.com/api/stac/v1"
UA = {"User-Agent": "RemoteView-OrbitalWatch-staging/0.1"}

SCHEMA = """
CREATE TABLE IF NOT EXISTS ow_sites (
  id BIGSERIAL PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
  geom JSONB NOT NULL, bbox DOUBLE PRECISION[] NOT NULL, area_km2 DOUBLE PRECISION NOT NULL,
  presets TEXT[] NOT NULL DEFAULT '{all}', active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_checked TIMESTAMPTZ, next_due TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT, status_detail TEXT);
CREATE TABLE IF NOT EXISTS ow_passes (
  id BIGSERIAL PRIMARY KEY, site_id BIGINT NOT NULL REFERENCES ow_sites(id) ON DELETE CASCADE,
  source TEXT NOT NULL, scene_id TEXT NOT NULL, scene_time TIMESTAMPTZ NOT NULL,
  baseline_ids TEXT[], baseline_from TIMESTAMPTZ, baseline_to TIMESTAMPTZ,
  valid_pct DOUBLE PRECISION, changed_km2 DOUBLE PRECISION, changed_pct DOUBLE PRECISION,
  classes JSONB, significant BOOLEAN NOT NULL DEFAULT false, confidence TEXT,
  summary TEXT, summary_by TEXT, before_img TEXT, after_img TEXT, overlay_img TEXT,
  extra JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(site_id, source, scene_id));
CREATE TABLE IF NOT EXISTS ow_scenes_seen (site_id BIGINT NOT NULL REFERENCES ow_sites(id) ON DELETE CASCADE,
  source TEXT NOT NULL, scene_id TEXT NOT NULL, scene_time TIMESTAMPTZ NOT NULL, usable BOOLEAN NOT NULL, note TEXT,
  PRIMARY KEY (site_id, source, scene_id));
CREATE TABLE IF NOT EXISTS ow_fires (site_id BIGINT NOT NULL REFERENCES ow_sites(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL, lon DOUBLE PRECISION NOT NULL, acq TIMESTAMPTZ NOT NULL, frp DOUBLE PRECISION,
  satellite TEXT, confidence TEXT, seen_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (site_id, lat, lon, acq, satellite));
CREATE TABLE IF NOT EXISTS ow_alerts (id BIGSERIAL PRIMARY KEY, site_id BIGINT NOT NULL REFERENCES ow_sites(id) ON DELETE CASCADE,
  pass_id BIGINT REFERENCES ow_passes(id) ON DELETE CASCADE, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), pushed BOOLEAN NOT NULL DEFAULT false);
"""

# ---------------------------------------------------------------- helpers

def conn():
    return psycopg.connect(DB, autocommit=True)


def utm_epsg(lon, lat):
    zone = int((lon + 180) // 6) + 1
    return (32600 if lat >= 0 else 32700) + zone


def site_grid(bbox, res):
    """Target grid in local UTM for a WGS84 bbox at a given metre resolution (capped to MAX_PX)."""
    lon = (bbox[0] + bbox[2]) / 2; lat = (bbox[1] + bbox[3]) / 2
    crs = f"EPSG:{utm_epsg(lon, lat)}"
    l, b, r, t = transform_bounds("EPSG:4326", crs, *bbox, densify_pts=21)
    res = max(res, (r - l) / MAX_PX, (t - b) / MAX_PX)
    w = max(8, int(math.ceil((r - l) / res))); h = max(8, int(math.ceil((t - b) / res)))
    return crs, from_origin(l, t, res, res), w, h, res


def read_on_grid(href, grid, resampling=Resampling.bilinear, band=1):
    crs, transform, w, h, _ = grid
    with rasterio.open(href) as src:
        with WarpedVRT(src, crs=crs, transform=transform, width=w, height=h, resampling=resampling,
                       src_nodata=src.nodata, nodata=src.nodata if src.nodata is not None else 0) as vrt:
            if band == "rgb":
                return vrt.read([1, 2, 3])
            return vrt.read(band).astype("float32")


def aoi_mask(geom, grid):
    crs, transform, w, h, _ = grid
    g = transform_geom("EPSG:4326", crs, geom)
    return ~geometry_mask([g], out_shape=(h, w), transform=transform)  # True inside


def clean(mask, min_px):
    if not mask.any():
        return mask
    m = ndimage.binary_opening(mask, structure=np.ones((3, 3)))
    lab, n = ndimage.label(m)
    if n == 0:
        return m
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    keep = np.zeros(n + 1, bool); keep[1:] = sizes >= min_px
    return keep[lab]


def stretch(rgb, lo=None, hi=None):
    a = rgb.astype("float32")
    if lo is None:
        v = a[np.isfinite(a) & (a > 0)]
        lo, hi = (np.percentile(v, 2), np.percentile(v, 98)) if v.size else (0, 1)
    a = np.clip((a - lo) / max(hi - lo, 1e-6), 0, 1)
    return (a * 255).astype("uint8")


def save_jpg(arr_hwc, path, max_side=640):
    im = Image.fromarray(arr_hwc)
    im.thumbnail((max_side, max_side), Image.LANCZOS)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, "JPEG", quality=85)
    return path


def overlay(after_hwc, mask, inside, path):
    img = after_hwc.astype("float32").copy()
    edge = mask & ~ndimage.binary_erosion(mask, iterations=1)
    fill = mask & ~edge
    cyan = np.array([0, 229, 255], "float32")
    img[fill] = img[fill] * 0.55 + cyan * 0.45
    img[ndimage.binary_dilation(edge, iterations=1)] = cyan
    outline = inside & ~ndimage.binary_erosion(inside, iterations=2)
    img[outline] = np.array([255, 196, 0], "float32")
    return save_jpg(img.clip(0, 255).astype("uint8"), path)


def pc_sign(href, collection, _cache={}):
    tok = _cache.get(collection)
    if not tok or tok[1] < time.time() + 300:
        j = requests.get(f"https://planetarycomputer.microsoft.com/api/sas/v1/token/{collection}", headers=UA, timeout=30).json()
        exp = dt.datetime.fromisoformat(j["msft:expiry"].replace("Z", "+00:00")).timestamp()
        tok = (j["token"], exp); _cache[collection] = tok
    return href + ("&" if "?" in href else "?") + tok[0]


def scale_offset(asset, default=(1.0, 0.0)):
    rb = (asset.extra_fields or {}).get("raster:bands") or []
    if rb and isinstance(rb, list):
        return float(rb[0].get("scale", default[0])), float(rb[0].get("offset", default[1]))
    return default

# ---------------------------------------------------------------- sources

class Optical:
    """Sentinel-2 L2A (Earth Search) and Landsat 8/9 C2 L2 (Planetary Computer)."""

    def __init__(self, kind):
        self.kind = kind
        if kind == "s2":
            self.cat, self.col, self.res = ES, "sentinel-2-c1-l2a", 10
            self.label = "Sentinel-2 (10 m optical)"
            self.bands = {"red": "red", "green": "green", "blue": "blue", "nir": "nir", "swir16": "swir16", "swir22": "swir22"}
        else:
            self.cat, self.col, self.res = PC, "landsat-c2-l2", 30
            self.label = "Landsat 8/9 (30 m optical)"
            self.bands = {"red": "red", "green": "green", "blue": "blue", "nir": "nir08", "swir16": "swir16", "swir22": "swir22"}

    def search(self, bbox, start, end):
        kw = {}
        if self.kind == "ls":
            kw["query"] = {"platform": {"in": ["landsat-8", "landsat-9"]}}
        items = Client.open(self.cat).search(collections=[self.col], bbox=bbox, datetime=f"{start}/{end}",
                                             max_items=60, query=kw.get("query")).items()
        out = [i for i in items if (i.properties.get("eo:cloud_cover") or 0) <= 80]
        out.sort(key=lambda i: i.datetime)
        return out

    def href(self, item, key):
        h = item.assets[key].href
        return pc_sign(h, self.col) if self.kind == "ls" else h

    def load(self, item, grid, inside):
        """Return dict of float reflectance bands + valid mask, or None if mostly cloudy over the site."""
        if self.kind == "s2":
            scl = read_on_grid(self.href(item, "scl"), grid, Resampling.nearest)
            valid = np.isin(scl, [4, 5, 6, 7, 11])
        else:
            qa = read_on_grid(self.href(item, "qa_pixel"), grid, Resampling.nearest).astype("uint16")
            bad = (qa & 1) | ((qa >> 1) & 1) | ((qa >> 3) & 1) | ((qa >> 4) & 1)
            valid = (bad == 0) & (qa > 0)
        # buffer cloud / shadow edges so their halos are not read as change
        valid = ~ndimage.binary_dilation(~valid, iterations=5 if self.kind == "s2" else 2)
        vpct = float(valid[inside].mean()) if inside.any() else 0.0
        if vpct < 0.6:
            return None, vpct
        out = {"valid": valid}
        for k, a in self.bands.items():
            sc, of = scale_offset(item.assets[a], (0.0001, -0.1) if self.kind == "s2" else (0.0000275, -0.2))
            dn = read_on_grid(self.href(item, a), grid)
            out[k] = np.where(dn > 0, dn * sc + of, np.nan).astype("float32")
        haze = out["blue"] > 0.30  # thick haze/smoke that the masks missed (bright desert sand reaches ~0.25)
        out["valid"] = valid & ~haze & np.isfinite(out["nir"])
        return out, float(out["valid"][inside].mean())

    def rgb(self, item, grid, bands=None):
        if self.kind == "s2":
            v = read_on_grid(self.href(item, "visual"), grid, Resampling.bilinear, band="rgb")
            return np.moveaxis(v, 0, -1).astype("uint8")
        b = bands
        rgb = np.dstack([b["red"], b["green"], b["blue"]])
        return stretch(np.nan_to_num(rgb), 0.0, 0.25)


def idx(a, b):
    with np.errstate(divide="ignore", invalid="ignore"):
        return (a - b) / (a + b)


def optical_change(base, after, inside, res):
    ndvi_b, ndvi_a = idx(base["nir"], base["red"]), idx(after["nir"], after["red"])
    nbr_b, nbr_a = idx(base["nir"], base["swir22"]), idx(after["nir"], after["swir22"])
    ndwi_b, ndwi_a = idx(base["green"], base["nir"]), idx(after["green"], after["nir"])
    ndbi_b, ndbi_a = idx(base["swir16"], base["nir"]), idx(after["swir16"], after["nir"])
    br_b = (base["red"] + base["green"] + base["blue"]) / 3
    br_a = (after["red"] + after["green"] + after["blue"]) / 3
    ok = base["valid"] & after["valid"] & inside
    min_px = max(4, int(round(5000 / (res * res))))  # 0.005 km2
    water_b, water_a = ndwi_b > 0.15, ndwi_a > 0.15
    # brightening that is not thin cloud (cloud lifts blue much more than SWIR), and darkening only when the
    # spectral shape changes too (pure uniform darkening is usually an unmasked cloud shadow)
    bright_up = (br_a - br_b > 0.09) & ((after["blue"] - base["blue"]) < 1.5 * (after["swir16"] - base["swir16"]) + 0.02)
    dark_spectral = (br_b - br_a > 0.09) & (np.abs(ndbi_a - ndbi_b) > 0.1)
    cls = {
        "vegetation_loss": ok & (ndvi_b > 0.35) & (ndvi_a - ndvi_b < -0.25) & ~water_a,
        "burn_scar": ok & (ndvi_b > 0.2) & (nbr_b - nbr_a > 0.27) & ~water_a,
        "new_water_or_flooding": ok & water_a & (ndwi_b < -0.05),
        "water_to_land": ok & water_b & (ndwi_a < -0.05),
        "new_construction_or_ground": ok & ~water_a & ~water_b & (ndvi_a < 0.3) & ~(nbr_b - nbr_a > 0.1) & (
            ((ndbi_a - ndbi_b > 0.12) & (ndvi_a - ndvi_b < -0.08)) | bright_up | dark_spectral),
    }
    px_km2 = res * res / 1e6
    out, total = {}, np.zeros_like(ok)
    for k, m in cls.items():
        m = clean(np.nan_to_num(m).astype(bool), min_px)
        cls[k] = m; total |= m
        out[k] = round(float(m.sum()) * px_km2, 4)
    return cls, total, out, float(ok.sum()) * px_km2


class Radar:
    """Sentinel-1 RTC (radiometrically terrain corrected GRD) from Planetary Computer, VV/VH gamma0."""
    col, res, label = "sentinel-1-rtc", 10, "Sentinel-1 radar (C-band SAR, through cloud and at night)"

    def search(self, bbox, start, end):
        items = list(Client.open(PC).search(collections=[self.col], bbox=bbox, datetime=f"{start}/{end}", max_items=60).items())
        items.sort(key=lambda i: i.datetime)
        return items

    def load(self, item, grid):
        vv = read_on_grid(pc_sign(item.assets["vv"].href, self.col), grid)
        vh = read_on_grid(pc_sign(item.assets["vh"].href, self.col), grid)
        valid = (vv > 0) & np.isfinite(vv)
        return {"vv": vv, "vh": vh, "valid": valid}


def water_mask(vv, vh=None):
    """Open water from one scene: large-window median of backscatter is very low (ships are too small to move it).
    Wind-roughened harbour water reaches VV ~0.02-0.03 but cross-pol VH stays very low, so use both."""
    med = ndimage.median_filter(np.nan_to_num(vv[::4, ::4]), size=7)
    wm = med < 0.025
    if vh is not None:
        medh = ndimage.median_filter(np.nan_to_num(vh[::4, ::4]), size=7)
        wm |= (medh < 0.0075) & (med < 0.045)
    return np.repeat(np.repeat(wm, 4, axis=0), 4, axis=1)[: vv.shape[0], : vv.shape[1]]


def count_ships(vv, water):
    bright = water & (np.nan_to_num(vv) > 0.25)
    lab, n = ndimage.label(bright)
    if n == 0:
        return 0
    sizes = ndimage.sum(bright, lab, range(1, n + 1))
    return int(((sizes >= 2) & (sizes <= 600)).sum())


def sar_change(base_list, after, inside, res):
    stack = np.stack([b["vv"] for b in base_list])
    bvalid = np.all(np.stack([b["valid"] for b in base_list]), axis=0)
    bvv = np.nanmean(np.where(stack > 0, stack, np.nan), axis=0)
    k = 5
    f_b = ndimage.uniform_filter(np.nan_to_num(bvv), k)
    f_a = ndimage.uniform_filter(np.nan_to_num(after["vv"]), k)
    water_a = water_mask(after["vv"], after.get("vh"))
    waters_b = [water_mask(b["vv"], b.get("vh")) for b in base_list]
    water_any = water_a | np.any(np.stack(waters_b), axis=0)
    ok = bvalid & after["valid"] & inside & (f_b > 0) & (f_a > 0)
    land = ok & ~ndimage.binary_dilation(water_any, iterations=3)
    with np.errstate(divide="ignore", invalid="ignore"):
        lr = 10 * np.log10(f_a / f_b)
    min_px = max(4, int(round(5000 / (res * res))))
    inc = clean(land & (lr > 3.0), min_px)
    dec = clean(land & (lr < -3.0), min_px)
    px_km2 = res * res / 1e6
    s_b = int(round(np.mean([count_ships(b["vv"], wb & inside & b["valid"]) for b, wb in zip(base_list, waters_b)])))
    s_a = count_ships(after["vv"], water_a & inside & after["valid"])
    cls = {"radar_brighter": inc, "radar_darker": dec}
    out = {"radar_brighter": round(float(inc.sum()) * px_km2, 4), "radar_darker": round(float(dec.sum()) * px_km2, 4)}
    wkm_a = float((water_a & inside).sum()) * px_km2
    wkm_b = float(np.mean([(wb & inside).sum() for wb in waters_b])) * px_km2
    # vessel counts are only comparable when the open-water mask came out similar in both (wind changes it)
    ships_ok = wkm_a > 0.5 and wkm_b > 0.5 and min(wkm_a, wkm_b) / max(wkm_a, wkm_b) > 0.7
    extra = {"ships_baseline": s_b, "ships_now": s_a, "ships_comparable": bool(ships_ok),
             "water_km2": round(wkm_a, 2), "water_km2_baseline": round(wkm_b, 2),
             "land_compared_km2": round(float(land.sum()) * px_km2, 2)}
    return cls, inc | dec, out, float(land.sum()) * px_km2, extra


def sar_rgb(d):
    vv = 10 * np.log10(np.clip(np.nan_to_num(d["vv"]), 1e-4, None))
    vh = 10 * np.log10(np.clip(np.nan_to_num(d["vh"]), 1e-4, None))
    r = np.clip((vv + 22) / 22, 0, 1); g = np.clip((vh + 28) / 22, 0, 1); b = np.clip(r - g * 0.5, 0, 1) * 0.6 + 0.2 * r
    return (np.dstack([r, g, b]) * 255).astype("uint8")

# ---------------------------------------------------------------- FIRMS

FIRMS_24H = [
    ("VIIRS S-NPP", "https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv"),
    ("VIIRS NOAA-20", "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv"),
    ("VIIRS NOAA-21", "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-21-viirs-c2/csv/J2_VIIRS_C2_Global_24h.csv"),
]
FIRMS_7D = [("VIIRS S-NPP", "https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_7d.csv")]
_firms = {"t": 0, "rows": [], "t7": 0}


def firms_rows():
    now = time.time()
    if now - _firms["t"] > 3000:
        rows = []
        lists = FIRMS_24H + (FIRMS_7D if now - _firms["t7"] > 6 * 3600 else [])
        for sat, url in lists:
            try:
                with requests.get(url, headers=UA, timeout=120, stream=True) as r:
                    r.raise_for_status()
                    lines = (l.decode("utf-8", "ignore") for l in r.iter_lines())
                    for row in csv.DictReader(lines):
                        try:
                            rows.append((float(row["latitude"]), float(row["longitude"]),
                                         f'{row["acq_date"]}T{row["acq_time"].zfill(4)[:2]}:{row["acq_time"].zfill(4)[2:]}:00Z',
                                         float(row.get("frp") or 0), sat, row.get("confidence", "")))
                        except Exception:
                            pass
            except Exception as e:
                log.warning("FIRMS %s failed: %s", sat, e)
        if rows:
            if now - _firms["t7"] > 6 * 3600:
                _firms["t7"] = now
            _firms["rows"], _firms["t"] = rows, now
    return _firms["rows"]


def point_in_poly(lon, lat, ring):
    inside = False
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]; x2, y2 = ring[i + 1]
        if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / ((y2 - y1) or 1e-12) + x1:
            inside = not inside
    return inside

# ---------------------------------------------------------------- summary

CLASS_WORDS = {
    "vegetation_loss": "vegetation cleared or lost", "burn_scar": "burn scar", "new_water_or_flooding": "new water or flooding",
    "water_to_land": "water turned to land (reclamation, drying or dredging)", "new_construction_or_ground": "new construction, earthworks or surface change",
    "radar_brighter": "radar return got stronger (new structures, vessels, stockpiles or rougher ground)",
    "radar_darker": "radar return got weaker (removed structures, smoother or wetter ground, fewer vessels)",
}


def template_summary(site, label, after_t, base_from, base_to, classes, total_km2, valid_pct, extra, fires):
    parts = [f"{label} pass on {after_t:%d %b %Y} compared with a baseline from {base_from:%d %b} to {base_to:%d %b %Y}."]
    top = sorted([(v, k) for k, v in classes.items() if v > 0], reverse=True)
    if total_km2 <= 0 or not top:
        parts.append("No significant change was detected inside the area.")
    else:
        bits = [f"{CLASS_WORDS.get(k, k)} ({v:.2f} km²)" for v, k in top[:3]]
        parts.append(f"About {total_km2:.2f} km² changed: " + "; ".join(bits) + ".")
    if extra and "ships_now" in extra and extra.get("ships_comparable"):
        parts.append(f"Ship-like radar targets on open water: {extra['ships_now']} now vs about {extra['ships_baseline']} in the baseline.")
    if fires:
        parts.append(f"NASA FIRMS reported {fires} fire detection(s) inside the area in the last 7 days.")
    parts.append(f"{valid_pct:.0f}% of the area was clear enough to compare. Objects smaller than the pixel size (10–30 m) cannot be seen.")
    return " ".join(parts)


def ai_summary(site, label, res, facts, before_path, after_path):
    if not XAI_KEY:
        return None
    def b64(p):
        return "data:image/jpeg;base64," + base64.b64encode(open(p, "rb").read()).decode()
    prompt = (
        "You write alerts for a satellite change-detection service. Using ONLY the numbers and the two images "
        f"(BEFORE = baseline, AFTER = newest pass, {label}, about {res:.0f} m per pixel), write 2-3 plain-English sentences "
        "for a business reader: what changed, roughly where in the frame, how big, and how confident. Never claim detail "
        "smaller than the pixel size (no individual cars or people), never guess identities or intent, and say if the "
        "change may be seasonal, tidal, cloud or shadow related. No preamble.\n\nFacts: " + json.dumps(facts, default=str))
    try:
        r = requests.post("https://api.x.ai/v1/chat/completions", timeout=90, headers={"Authorization": f"Bearer {XAI_KEY}"},
                          json={"model": XAI_MODEL, "temperature": 0.2, "max_tokens": 260,
                                "messages": [{"role": "user", "content": [
                                    {"type": "text", "text": prompt},
                                    {"type": "image_url", "image_url": {"url": b64(before_path)}},
                                    {"type": "image_url", "image_url": {"url": b64(after_path)}}]}]})
        if r.status_code != 200:
            log.warning("xAI summary HTTP %s: %s", r.status_code, r.text[:200])
            return None
        txt = r.json()["choices"][0]["message"]["content"].strip()
        return txt or None
    except Exception as e:
        log.warning("xAI summary failed: %s", e)
        return None

# ---------------------------------------------------------------- core

def seen(cur, site_id, source, item, usable, note=""):
    cur.execute("INSERT INTO ow_scenes_seen VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING",
                (site_id, source, item.id, item.datetime, usable, note))


def is_seen(cur, site_id, source, scene_id):
    cur.execute("SELECT 1 FROM ow_scenes_seen WHERE site_id=%s AND source=%s AND scene_id=%s", (site_id, source, scene_id))
    return cur.fetchone() is not None


def rel(p):
    return os.path.relpath(p, DATA)


def significant(total_km2, area_km2, extra=None):
    if total_km2 >= max(0.02, 0.003 * area_km2):
        return True
    if extra and "ships_now" in extra and extra.get("ships_comparable"):
        a, b = extra["ships_now"], extra["ships_baseline"]
        return abs(a - b) >= max(5, 0.25 * max(a, b))
    return False


def record_pass(cur, site, source, label, res, item, base_items, valid_pct, classes_km2, total_km2, ok_km2,
                before_p, after_p, overlay_p, extra):
    sig = significant(total_km2, site["area_km2"], extra)
    cur.execute("SELECT count(*) FROM ow_fires WHERE site_id=%s AND acq > now() - interval '7 days'", (site["id"],))
    fires = cur.fetchone()[0]
    bfrom = min(b.datetime for b in base_items); bto = max(b.datetime for b in base_items)
    conf = "high" if valid_pct >= 90 and len(base_items) >= 2 else ("medium" if valid_pct >= 75 else "low")
    facts = {"site": site["name"], "area_km2": round(site["area_km2"], 2), "sensor": label, "after_date": item.datetime.date(),
             "baseline": f"{bfrom.date()} to {bto.date()} ({len(base_items)} scenes)", "clear_pct": round(valid_pct),
             "changed_km2_total": round(total_km2, 3), "changed_by_class_km2": classes_km2, "fires_7d": fires, **(extra or {})}
    summary, by = None, "template"
    if sig:
        summary = ai_summary(site, label, res, facts, os.path.join(DATA, before_p), os.path.join(DATA, after_p))
        if summary:
            by = f"xAI {XAI_MODEL}"
    if not summary:
        summary = template_summary(site, label, item.datetime, bfrom, bto, classes_km2, total_km2, valid_pct, extra, fires)
    cur.execute("""INSERT INTO ow_passes (site_id, source, scene_id, scene_time, baseline_ids, baseline_from, baseline_to, valid_pct,
                   changed_km2, changed_pct, classes, significant, confidence, summary, summary_by, before_img, after_img, overlay_img, extra)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                   ON CONFLICT (site_id, source, scene_id) DO NOTHING RETURNING id""",
                (site["id"], source, item.id, item.datetime, [b.id for b in base_items], bfrom, bto, valid_pct, total_km2,
                 100 * total_km2 / max(ok_km2, 1e-9), json.dumps(classes_km2), sig, conf, summary, by, before_p, after_p, overlay_p,
                 json.dumps({**(extra or {}), "resolution_m": res, "fires_7d": fires})))
    row = cur.fetchone()
    if row and sig:
        what = f"{total_km2:.2f} km² changed"
        if extra and extra.get("ships_comparable") and abs(extra["ships_now"] - extra["ships_baseline"]) >= 5:
            what += f", vessels {extra['ships_baseline']}→{extra['ships_now']}"
        title = f"{site['name']}: {what} ({label.split(' (')[0]}, {item.datetime:%d %b})"
        cur.execute("INSERT INTO ow_alerts (site_id, pass_id, kind, title, body) VALUES (%s,%s,'change',%s,%s)",
                    (site["id"], row[0], title, summary))
    return row[0] if row else None


def run_optical(cur, site, kind, grid_cache):
    src = Optical(kind)
    source = kind
    end = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None); start = end - dt.timedelta(days=LOOKBACK_D)
    items = src.search(site["bbox"], start.strftime("%Y-%m-%dT%H:%M:%SZ"), end.strftime("%Y-%m-%dT%H:%M:%SZ"))
    if not items:
        return "no scenes"
    grid = site_grid(site["bbox"], src.res)
    inside = aoi_mask(site["geom"], grid)
    newest = [i for i in reversed(items) if not is_seen(cur, site["id"], source, i.id)]
    if not newest:
        return "up to date"
    after = after_item = None
    for it in newest[:4]:  # newest first, only a few per cycle
        try:
            d, vp = src.load(it, grid, inside)
        except Exception as e:
            seen(cur, site["id"], source, it, False, f"read error {e}"[:200]); continue
        if d is None or vp < 0.6:
            seen(cur, site["id"], source, it, False, f"cloudy ({vp*100:.0f}% clear)"); continue
        after, after_item, after_vp = d, it, vp
        break
    for it in newest[4:]:
        seen(cur, site["id"], source, it, False, "skipped: older backlog")
    if after is None:
        return "no clear new scene"
    base_items, bases = [], []
    for it in reversed(items):
        if it.datetime >= after_item.datetime - dt.timedelta(days=10):
            continue
        try:
            d, vp = src.load(it, grid, inside)
        except Exception:
            continue
        if d is not None and vp >= 0.6:
            base_items.append(it); bases.append(d)
        if len(bases) >= 3:
            break
    if not bases:
        seen(cur, site["id"], source, after_item, True, "no clear baseline yet")
        return "no clear baseline"
    base = {}
    for k in ["red", "green", "blue", "nir", "swir16", "swir22"]:
        st = np.stack([np.where(b["valid"], b[k], np.nan) for b in bases])
        with np.errstate(all="ignore"):
            base[k] = np.nanmedian(st, axis=0)
    base["valid"] = np.isfinite(base["nir"])
    cls, total, cls_km2, ok_km2 = optical_change(base, after, inside, grid[4])
    total_km2 = float(sum(cls_km2.values()))
    d = os.path.join(DATA, str(site["id"]), source)
    stamp = after_item.datetime.strftime("%Y%m%dT%H%M")
    before_rgb = src.rgb(base_items[0], grid, bases[0])
    after_rgb = src.rgb(after_item, grid, after)
    bp = save_jpg(before_rgb, os.path.join(d, f"{stamp}_before.jpg"))
    ap = save_jpg(after_rgb, os.path.join(d, f"{stamp}_after.jpg"))
    op = overlay(after_rgb, total, inside, os.path.join(d, f"{stamp}_change.jpg"))
    pid = record_pass(cur, site, source, src.label, grid[4], after_item, base_items, after_vp * 100, cls_km2, total_km2, ok_km2,
                      rel(bp), rel(ap), rel(op), {})
    seen(cur, site["id"], source, after_item, True, f"pass {pid}")
    return f"{src.label}: {total_km2:.3f} km² changed vs {len(bases)} baseline scenes"


def run_radar(cur, site):
    src = Radar(); source = "s1"
    end = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None); start = end - dt.timedelta(days=60)
    items = src.search(site["bbox"], start.strftime("%Y-%m-%dT%H:%M:%SZ"), end.strftime("%Y-%m-%dT%H:%M:%SZ"))
    if not items:
        return "no radar scenes"
    newest = [i for i in reversed(items) if not is_seen(cur, site["id"], source, i.id)]
    if not newest:
        return "up to date"
    after_item = newest[0]
    for it in newest[1:]:
        seen(cur, site["id"], source, it, False, "skipped: older backlog")
    orbit = (after_item.properties.get("sat:relative_orbit"), after_item.properties.get("sat:orbit_state"))
    base_items = [i for i in reversed(items) if i.id != after_item.id and i.datetime < after_item.datetime - dt.timedelta(days=4)
                  and (i.properties.get("sat:relative_orbit"), i.properties.get("sat:orbit_state")) == orbit][:2]
    if not base_items:
        seen(cur, site["id"], source, after_item, True, "no same-orbit baseline yet")
        return "no same-orbit baseline"
    grid = site_grid(site["bbox"], src.res)
    inside = aoi_mask(site["geom"], grid)
    after = src.load(after_item, grid)
    bases = [src.load(b, grid) for b in base_items]
    cls, total, cls_km2, ok_km2, extra = sar_change(bases, after, inside, grid[4])
    total_km2 = float(sum(cls_km2.values()))
    vp = 100 * float((after["valid"] & inside).sum()) / max(int(inside.sum()), 1)
    d = os.path.join(DATA, str(site["id"]), source)
    stamp = after_item.datetime.strftime("%Y%m%dT%H%M")
    b_rgb = sar_rgb(bases[0]); a_rgb = sar_rgb(after)
    bp = save_jpg(b_rgb, os.path.join(d, f"{stamp}_before.jpg"))
    ap = save_jpg(a_rgb, os.path.join(d, f"{stamp}_after.jpg"))
    op = overlay(a_rgb, total, inside, os.path.join(d, f"{stamp}_change.jpg"))
    extra.update({"relative_orbit": orbit[0], "orbit_state": orbit[1]})
    pid = record_pass(cur, site, source, src.label, grid[4], after_item, base_items, vp, cls_km2, total_km2, ok_km2,
                      rel(bp), rel(ap), rel(op), extra)
    seen(cur, site["id"], source, after_item, True, f"pass {pid}")
    return f"radar: {total_km2:.3f} km² changed, ships {extra['ships_baseline']}→{extra['ships_now']}"


def run_firms(cur, site):
    ring = site["geom"]["coordinates"][0]
    b = site["bbox"]; n_new = 0; newest = []
    for lat, lon, acq, frp, sat, confd in firms_rows():
        if b[1] <= lat <= b[3] and b[0] <= lon <= b[2] and point_in_poly(lon, lat, ring):
            cur.execute("INSERT INTO ow_fires (site_id, lat, lon, acq, frp, satellite, confidence) VALUES (%s,%s,%s,%s,%s,%s,%s) "
                        "ON CONFLICT DO NOTHING RETURNING acq", (site["id"], lat, lon, acq, frp, sat, confd))
            if cur.fetchone():
                n_new += 1; newest.append((acq, frp))
    if n_new:
        tot_frp = sum(f for _, f in newest)
        cur.execute("INSERT INTO ow_alerts (site_id, kind, title, body) VALUES (%s,'fire',%s,%s)",
                    (site["id"], f"{site['name']}: {n_new} new fire detection(s)",
                     f"NASA FIRMS (VIIRS, 375 m) reported {n_new} new active-fire detection(s) inside the area, total radiative power "
                     f"{tot_frp:.0f} MW, latest {max(a for a, _ in newest)} UTC. Detections are heat signatures; small or brief fires can be missed and some may be industrial heat sources."))
    return f"FIRMS: {n_new} new"


def notify(cur):
    cur.execute("SELECT a.id, s.user_id FROM ow_alerts a JOIN ow_sites s ON s.id=a.site_id WHERE NOT a.pushed ORDER BY a.id LIMIT 50")
    rows = cur.fetchall()
    for aid, uid in rows:
        try:
            r = requests.post(f"{APP}/api/orbital/internal/notify", json={"alertId": aid, "userId": uid},
                              headers={"x-ow-internal": INTERNAL}, timeout=30)
            log.info("push alert %s -> %s %s", aid, r.status_code, r.text[:120])
        except Exception as e:
            log.warning("push failed: %s", e)
        cur.execute("UPDATE ow_alerts SET pushed=true WHERE id=%s", (aid,))


def cycle():
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id, user_id, name, geom, bbox, area_km2, presets FROM ow_sites WHERE active AND next_due <= now() ORDER BY next_due LIMIT 20")
        sites = [dict(zip(["id", "user_id", "name", "geom", "bbox", "area_km2", "presets"], r)) for r in cur.fetchall()]
        for s in sites:
            t0 = time.time(); notes = []
            cur.execute("UPDATE ow_sites SET status='checking', status_detail=NULL WHERE id=%s", (s["id"],))
            for name, fn in [("firms", lambda: run_firms(cur, s)), ("s2", lambda: run_optical(cur, s, "s2", None)),
                             ("ls", lambda: run_optical(cur, s, "ls", None)), ("s1", lambda: run_radar(cur, s))]:
                try:
                    notes.append(f"{name}: {fn()}")
                except Exception as e:
                    log.error("site %s %s failed: %s", s["id"], name, traceback.format_exc()[-800:])
                    notes.append(f"{name}: error {type(e).__name__}")
            cur.execute("UPDATE ow_sites SET last_checked=now(), next_due=now() + %s * interval '1 hour', status='ok', status_detail=%s WHERE id=%s",
                        (SITE_EVERY_H, " | ".join(notes)[:1000], s["id"]))
            log.info("site %s (%s) done in %.0fs: %s", s["id"], s["name"], time.time() - t0, " | ".join(notes))
        notify(cur)


def main():
    with conn() as c:
        c.execute(SCHEMA)
    log.info("Orbital Watch worker started; cycle %ss, data %s", CYCLE_S, DATA)
    while True:
        t = time.time()
        try:
            cycle()
        except Exception:
            log.error("cycle failed: %s", traceback.format_exc()[-1500:])
        # wake early if a site was queued for an immediate check
        while time.time() - t < CYCLE_S:
            time.sleep(20)
            try:
                with conn() as c:
                    if c.execute("SELECT 1 FROM ow_sites WHERE active AND next_due <= now() LIMIT 1").fetchone():
                        break
            except Exception:
                pass


if __name__ == "__main__":
    main()
