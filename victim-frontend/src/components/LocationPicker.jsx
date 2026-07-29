import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

// ─── Leaflet CSS (load once via CDN to avoid CRA css import issues) ─────────
if (!document.getElementById('vawc-leaflet-css')) {
    const link = document.createElement('link');
    link.id = 'vawc-leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    document.head.appendChild(link);
}

// ─── Fix default marker icon (CRA + Leaflet bundling issue) ─────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom orange-tinted marker for VAWC palette
const vawcIcon = new L.DivIcon({
    className: 'vawc-marker',
    html: `
      <div style="position:relative;width:32px;height:42px;transform:translate(-50%,-100%);">
        <svg width="32" height="42" viewBox="0 0 32 42" fill="none">
          <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 26 16 26s16-14 16-26C32 7.16 24.84 0 16 0z" fill="#F47920"/>
          <circle cx="16" cy="16" r="6" fill="#fff"/>
        </svg>
      </div>
    `,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
});

// ─── Scoped CSS ─────────────────────────────────────────────────────────────
if (!document.getElementById('vawc-locpicker-css')) {
    const s = document.createElement('style'); s.id = 'vawc-locpicker-css';
    s.textContent = `
        @keyframes lpSpin { to { transform: rotate(360deg); } }
        .lp-method { transition: all 0.15s ease; }
        .lp-method:hover:not(:disabled) { border-color: #F47920 !important; background: #FFF3E0 !important; }
        .lp-method:active:not(:disabled) { transform: scale(0.98); }
        .lp-search-input:focus { border-color: #F47920 !important; box-shadow: 0 0 0 3px rgba(244,121,32,0.12) !important; outline: none; }
        .lp-suggest:hover { background: #FFF3E0 !important; }
        .vawc-marker { background: transparent !important; border: none !important; }
        .lp-map-wrap .leaflet-container { font-family: 'DM Sans', sans-serif; }
    `;
    document.head.appendChild(s);
}

// ─── Defaults ───────────────────────────────────────────────────────────────
// Barangay Palanginan, Iba, Zambales (approximate centroid)
const DEFAULT_CENTER = { lat: 15.3279, lng: 119.9786 };
const DEFAULT_ZOOM   = 14;

// Nominatim (OpenStreetMap) - free geocoding, no API key
const NOMINATIM = 'https://nominatim.openstreetmap.org';

// ─── Icons ──────────────────────────────────────────────────────────────────
const IcoGPS    = ({ c = '#fff', size = 16 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke={c} strokeWidth="2"/><circle cx="12" cy="12" r="8" stroke={c} strokeWidth="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>);
const IcoPin   = ({ c = '#fff', size = 16 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="10" r="3" stroke={c} strokeWidth="2"/></svg>);
const IcoSearch = ({ c = '#94A3B8', size = 16 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke={c} strokeWidth="2"/><path d="M16 16l4 4" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>);
const IcoCheck  = ({ c = '#2E7D32', size = 14 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoX      = ({ c = '#94A3B8', size = 14 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>);
const Spinner   = ({ size = 14, c = '#fff' }) => (<span style={{ width: size, height: size, border: `2px solid ${c}40`, borderTopColor: c, borderRadius: '50%', animation: 'lpSpin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 }} />);

// ─── Helpers ────────────────────────────────────────────────────────────────
async function reverseGeocode(lat, lng) {
    const r = await fetch(`${NOMINATIM}/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: { 'Accept-Language': 'en' } });
    if (!r.ok) throw new Error('Reverse geocode failed.');
    const d = await r.json();
    return d.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

async function forwardGeocode(query) {
    // Bias to Philippines + Zambales context for better local results
    const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: '5',
        countrycodes: 'ph',
        addressdetails: '1',
    });
    const r = await fetch(`${NOMINATIM}/search?${params}`, { headers: { 'Accept-Language': 'en' } });
    if (!r.ok) throw new Error('Search failed.');
    return await r.json(); // array of { lat, lon, display_name, ... }
}

// ─── Internal: handles clicks on the map ────────────────────────────────────
function MapClickHandler({ onPick }) {
    useMapEvents({
        click: (e) => onPick(e.latlng.lat, e.latlng.lng),
    });
    return null;
}

// ─── Internal: recenter map when location changes externally ────────────────
function MapRecenter({ lat, lng }) {
    const map = useMap();
    useEffect(() => {
        if (typeof lat === 'number' && typeof lng === 'number') {
            map.flyTo([lat, lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
        }
    }, [lat, lng, map]);
    return null;
}

// ─── Main component ────────────────────────────────────────────────────────
function LocationPicker({ location, address, onChange, onClear, error, onError }) {
    const [gpsLoading,     setGpsLoading]   = useState(false);
    const [pinLoading,     setPinLoading]   = useState(false);
    const [searchQuery,    setSearchQuery]  = useState('');
    const [suggestions,    setSuggestions]  = useState([]);
    const [searchLoading,  setSearchLoad]   = useState(false);
    const [searchFocused,  setSearchFocus]  = useState(false);
    const searchTimer = useRef(null);

    // Unique key per LocationPicker mount - guarantees a fresh DOM container
    // on HMR/remount so Leaflet doesn't see a recycled `_leaflet_id`.
    // react-leaflet handles map.remove() internally on unmount; do NOT call it manually.
    const [mapKey] = useState(() => `lp-map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    // ─── GPS ────────────────────────────────────────────────────────────────
    const handleGPS = () => {
        if (!navigator.geolocation) {
            onError && onError('Geolocation is not supported by your browser.');
            return;
        }
        setGpsLoading(true);
        onError && onError('');
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude: lat, longitude: lng } = pos.coords;
                let resolvedAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                try { resolvedAddress = await reverseGeocode(lat, lng); } catch {}
                onChange({ lat, lng, address: resolvedAddress });
                setGpsLoading(false);
            },
            () => {
                onError && onError('Unable to retrieve location. Please allow location access in your browser settings.');
                setGpsLoading(false);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    // ─── Map pin click ──────────────────────────────────────────────────────
    const handleMapPick = async (lat, lng) => {
        setPinLoading(true);
        onError && onError('');
        let resolvedAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        try { resolvedAddress = await reverseGeocode(lat, lng); } catch {}
        onChange({ lat, lng, address: resolvedAddress });
        setPinLoading(false);
    };

    // ─── Search (debounced) ─────────────────────────────────────────────────
    const runSearch = useCallback(async (q) => {
        if (!q || q.trim().length < 3) { setSuggestions([]); return; }
        setSearchLoad(true);
        try {
            const results = await forwardGeocode(q.trim());
            setSuggestions(results);
        } catch {
            setSuggestions([]);
        } finally {
            setSearchLoad(false);
        }
    }, []);

    useEffect(() => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => runSearch(searchQuery), 500);
        return () => searchTimer.current && clearTimeout(searchTimer.current);
    }, [searchQuery, runSearch]);

    const pickSuggestion = (s) => {
        const lat = parseFloat(s.lat), lng = parseFloat(s.lon);
        onChange({ lat, lng, address: s.display_name });
        setSearchQuery('');
        setSuggestions([]);
        setSearchFocus(false);
    };

    const handleClear = () => {
        onClear && onClear();
        setSearchQuery('');
        setSuggestions([]);
    };

    const center = location || DEFAULT_CENTER;

    return (
        <div style={S.wrap}>
            {/* ── Method buttons row ─────────────────────────────────────── */}
            <div style={S.methodsRow}>
                <button type="button" className="lp-method" style={S.methodBtn} onClick={handleGPS} disabled={gpsLoading}>
                    {gpsLoading ? <Spinner c="#F47920" /> : <IcoGPS c="#F47920" />}
                    <span>{gpsLoading ? 'Locating…' : 'Use My GPS'}</span>
                </button>
                <button type="button" className="lp-method" style={S.methodBtn} onClick={() => {
                    document.getElementById('lp-search-input')?.focus();
                }}>
                    <IcoSearch c="#F47920" />
                    <span>Search Address</span>
                </button>
            </div>

            {/* ── Address search ─────────────────────────────────────────── */}
            <div style={S.searchWrap}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <IcoSearch c="#94A3B8" size={15} />
                </span>
                <input
                    id="lp-search-input"
                    type="text"
                    className="lp-search-input"
                    placeholder="Type a street, landmark, or barangay…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setSearchFocus(true)}
                    onBlur={() => setTimeout(() => setSearchFocus(false), 200)}
                    style={S.searchInput}
                />
                {searchLoading && (
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
                        <Spinner c="#F47920" size={14} />
                    </span>
                )}
                {searchFocused && suggestions.length > 0 && (
                    <div style={S.suggestList}>
                        {suggestions.map((s, i) => (
                            <button
                                key={s.place_id || i}
                                type="button"
                                className="lp-suggest"
                                onClick={() => pickSuggestion(s)}
                                style={S.suggestItem}
                            >
                                <IcoPin c="#F47920" size={14} />
                                <span style={S.suggestText}>{s.display_name}</span>
                            </button>
                        ))}
                    </div>
                )}
                {searchFocused && searchQuery.trim().length >= 3 && !searchLoading && suggestions.length === 0 && (
                    <div style={{ ...S.suggestList, padding: '10px 14px' }}>
                        <p style={{ margin: 0, fontSize: 12.5, color: '#94A3B8', fontFamily: "'DM Sans', sans-serif" }}>No matches in the Philippines for "{searchQuery}".</p>
                    </div>
                )}
            </div>

            {/* ── Map ────────────────────────────────────────────────────── */}
            <div className="lp-map-wrap" style={S.mapWrap}>
                <MapContainer
                    key={mapKey}
                    center={[center.lat, center.lng]}
                    zoom={DEFAULT_ZOOM}
                    scrollWheelZoom={true}
                    style={{ height: 280, width: '100%' }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {location && <Marker position={[location.lat, location.lng]} icon={vawcIcon} />}
                    <MapClickHandler onPick={handleMapPick} />
                    <MapRecenter lat={location?.lat} lng={location?.lng} />
                </MapContainer>
                <div style={S.mapHint}>
                    {pinLoading
                        ? <><Spinner c="#F47920" size={12} /> <span>Resolving address…</span></>
                        : <><IcoPin c="#F47920" size={12} /> <span>Tap anywhere on the map to drop a pin</span></>
                    }
                </div>
            </div>

            {/* ── Captured location summary ──────────────────────────────── */}
            {location && (
                <div style={S.capturedCard}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                        <IcoCheck c="#2E7D32" />
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1B4D1E', fontFamily: "'DM Sans', sans-serif" }}>Crime scene location set</p>
                    </div>
                    {address && (
                        <p style={{ margin: '0 0 6px', fontSize: 13, color: '#0F172A', lineHeight: 1.55, fontFamily: "'DM Sans', sans-serif" }}>
                            {address}
                        </p>
                    )}
                    <p style={{ margin: 0, fontSize: 11.5, color: '#475569', fontFamily: 'monospace' }}>
                        {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                    </p>
                    <button type="button" onClick={handleClear}
                        style={S.clearBtn}>
                        <IcoX c="#C62828" size={12} />
                        Remove location
                    </button>
                </div>
            )}

            {/* ── Error ──────────────────────────────────────────────────── */}
            {error && (
                <div style={S.errorBox}>
                    <p style={{ margin: 0, fontSize: 13, color: '#C62828', lineHeight: 1.55, fontFamily: "'DM Sans', sans-serif" }}>{error}</p>
                </div>
            )}
        </div>
    );
}

const S = {
    wrap:        { display: 'flex', flexDirection: 'column', gap: 12 },

    methodsRow:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
    methodBtn:   {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '11px 12px', borderRadius: 10,
        border: '1.5px solid #E2E8F0', background: '#fff',
        fontSize: 13, fontWeight: 700, color: '#C45E10',
        cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
    },

    searchWrap:  { position: 'relative', width: '100%' },
    searchInput: {
        width: '100%', boxSizing: 'border-box',
        padding: '11px 14px 11px 38px',
        borderRadius: 10, border: '1.5px solid #E2E8F0',
        background: '#fff', fontSize: 14, color: '#0F172A',
        fontFamily: "'DM Sans', sans-serif", outline: 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
    },
    suggestList: {
        position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
        background: '#fff', border: '1.5px solid #FFCC99', borderRadius: 10,
        boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
        zIndex: 1000, maxHeight: 240, overflowY: 'auto',
    },
    suggestItem: {
        display: 'flex', alignItems: 'flex-start', gap: 9,
        width: '100%', padding: '10px 14px',
        border: 'none', borderBottom: '1px solid #F1F5F9',
        background: 'transparent', cursor: 'pointer', textAlign: 'left',
        fontFamily: "'DM Sans', sans-serif",
    },
    suggestText: { fontSize: 12.5, color: '#0F172A', lineHeight: 1.5 },

    mapWrap:     { position: 'relative', border: '1.5px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' },
    mapHint:     {
        position: 'absolute', bottom: 10, left: 10,
        background: 'rgba(255,255,255,0.92)', padding: '5px 10px', borderRadius: 9999,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 11.5, fontWeight: 600, color: '#475569',
        fontFamily: "'DM Sans', sans-serif",
        boxShadow: '0 1px 3px rgba(15,23,42,0.1)',
        zIndex: 500,
    },

    capturedCard: {
        backgroundColor: '#ECFDF5', borderRadius: 10,
        padding: 14, border: '1.5px solid #A7F3D0',
    },
    clearBtn: {
        marginTop: 10,
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: 'none', border: 'none',
        color: '#C62828', fontSize: 12, fontWeight: 700,
        cursor: 'pointer', padding: 0,
        fontFamily: "'DM Sans', sans-serif",
    },

    errorBox: {
        backgroundColor: '#FEF2F2', borderRadius: 10,
        padding: '12px 14px', border: '1.5px solid #FECACA',
    },
};

export default LocationPicker;
