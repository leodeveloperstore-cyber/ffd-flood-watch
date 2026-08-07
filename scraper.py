#!/usr/bin/env python3
import os, json, time, requests, re
from bs4 import BeautifulSoup

FFD_URL = "https://ffd.pmd.gov.pk/bulletin/bulletin"
RIVER_STATE_URL = "https://ffd.pmd.gov.pk/river-state"
RIVER_STATE_API = "https://ffd.pmd.gov.pk/river-state/data"
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "live_stations.json")
OVERRIDE_FILE = os.path.join(os.path.dirname(__file__), "manual_overrides.json")

# Base stations definition
base_stations = [
    {"id": "tarbela", "search": "tarbela", "en": "Tarbela Dam", "ur": "تربیلہ ڈیم", "river": "Indus", "lat": 34.08, "lon": 72.70},
    {"id": "marala", "search": "marala", "en": "Head Marala", "ur": "ہیڈ مرالہ", "river": "Chenab", "lat": 32.67, "lon": 74.46},
    {"id": "khanki", "search": "khanki", "en": "Head Khanki", "ur": "ہیڈ خانکی", "river": "Chenab", "lat": 32.40, "lon": 73.96},
    {"id": "qadirabad", "search": "qadirabad", "en": "Head Qadirabad", "ur": "ہیڈ قادر آباد", "river": "Chenab", "lat": 32.32, "lon": 73.69},
    {"id": "mangla", "search": "mangla", "en": "Mangla Dam", "ur": "منگلہ ڈیم", "river": "Jhelum", "lat": 33.14, "lon": 73.64},
    {"id": "kalabagh", "search": "kalabagh", "en": "Kalabagh", "ur": "کالاباغ", "river": "Indus", "lat": 32.96, "lon": 71.55},
    {"id": "chashma", "search": "chashma", "en": "Chashma", "ur": "چشما", "river": "Indus", "lat": 32.44, "lon": 71.37},
    {"id": "taunsa", "search": "taunsa", "en": "Taunsa", "ur": "تونسہ", "river": "Indus", "lat": 30.51, "lon": 70.84},
    {"id": "guddu", "search": "guddu", "en": "Guddu Barrage", "ur": "گڈو بیراج", "river": "Indus", "lat": 28.42, "lon": 69.70},
    {"id": "sukkur", "search": "sukkur", "en": "Sukkur Barrage", "ur": "سکھر بیراج", "river": "Indus", "lat": 27.57, "lon": 68.85},
    {"id": "kotri", "search": "kotri", "en": "Kotri Barrage", "ur": "کوٹری بیراج", "river": "Indus", "lat": 25.37, "lon": 68.31},
    {"id": "balloki", "search": "balloki", "en": "Head Balloki", "ur": "ہیڈ بلوکی", "river": "Ravi", "lat": 31.22, "lon": 73.86},
    {"id": "sulemanki", "search": "suleimanki", "en": "Head Sulemanki", "ur": "ہیڈ سلیمانکی", "river": "Sutlej", "lat": 30.37, "lon": 73.86},
    {"id": "nowshera", "search": "nowshera", "en": "Nowshera", "ur": "نوشہرہ", "river": "Kabul", "lat": 34.01, "lon": 71.97},
    {"id": "baglihar", "en": "Baglihar Dam", "ur": "بگلیہار ڈیم", "river": "Chenab (India)", "lat": 33.15, "lon": 75.31},
    {"id": "salal", "en": "Salal Dam", "ur": "سلال ڈیم", "river": "Chenab (India)", "lat": 33.08, "lon": 74.82},
    {"id": "kishanganga", "en": "Kishanganga", "ur": "کشن گنگا", "river": "Neelum (India)", "lat": 34.64, "lon": 74.75},
    {"id": "bhakra", "en": "Bhakra Dam", "ur": "بھاکڑا ڈیم", "river": "Sutlej (India)", "lat": 31.41, "lon": 76.43},
    {"id": "pong", "en": "Pong Dam", "ur": "پونگ ڈیم", "river": "Beas (India)", "lat": 31.96, "lon": 75.94},
    {"id": "thein", "en": "Thein Dam", "ur": "تھین ڈیم", "river": "Ravi (India)", "lat": 32.44, "lon": 75.73}
]

def determine_sk(inflow):
    if inflow > 800000: return 'critical'
    if inflow > 500000: return 'high'
    if inflow > 300000: return 'medium'
    if inflow > 200000: return 'low'
    return 'normal'

def load_overrides():
    if os.path.exists(OVERRIDE_FILE):
        try:
            with open(OVERRIDE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f).get('stations', {})
        except Exception:
            pass
    return {}

def fetch_api_data():
    s = requests.Session()
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        r = s.get(RIVER_STATE_URL, headers=headers, timeout=20, verify=False)
        match = re.search(r'RS_TOKEN\s*=\s*"([^"]+)"', r.text)
        if not match:
            return None, "Token not found"
            
        token = match.group(1)
        api_headers = {'User-Agent': 'Mozilla/5.0', 'X-Requested-With': 'XMLHttpRequest', 'X-FW-Token': token}
        r2 = s.get(RIVER_STATE_API, headers=api_headers, timeout=20, verify=False)
        return r2.json(), None
    except Exception as e:
        return None, str(e)

def fetch_bulletin_data():
    storage_data = {}
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        res = requests.get(FFD_URL, headers=headers, timeout=20, verify=False)
        soup = BeautifulSoup(res.text, 'html.parser')
        for table in soup.find_all('table'):
            txt = table.get_text()
            if 'Storage' in txt and '% live' in txt:
                match = re.search(r'Storage.*?([\d.]+)%\s*live', txt, re.IGNORECASE)
                if match:
                    if 'tarbela' not in storage_data:
                        storage_data['tarbela'] = float(match.group(1))
                    elif 'mangla' not in storage_data:
                        storage_data['mangla'] = float(match.group(1))
    except Exception:
        pass
    return storage_data

def scrape():
    print("[PakFlood Auto-Scraper] Upgrading to River State Live API...")
    
    old_data = {}
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                old_data = {s['id']: s for s in json.load(f).get('stations', [])}
        except:
            pass

    api_data, err = fetch_api_data()
    bulletin_storage = fetch_bulletin_data()
    
    scraped_values = {}
    bulletin_date = time.strftime("Dated: %d %b %Y %H:%M PKT")
    
    if api_data and "stations" in api_data:
        pmd_stations = api_data["stations"]
        for pst in pmd_stations:
            name = pst.get("name", "").lower()
            gauges = pst.get("gauges", [])
            inv = 0
            outv = 0
            for g in gauges:
                val_str = str(g.get("discharge", "0")).replace(',', '')
                try:
                    val = int(val_str)
                except:
                    val = 0
                if g.get("type") == "INFLOW": inv = val
                if g.get("type") == "OUTFLOW": outv = val
            
            for bs in base_stations:
                if 'search' in bs and bs['search'] in name:
                    scraped_values[bs['id']] = {"inflow": inv, "outflow": outv}
                    if "recording_time" in pst:
                        bulletin_date = f"Dated: {pst['recording_time']}"
                    break
        print(f"[SUCCESS] Scraped {len(scraped_values)} live stations from New API!")
    else:
        print(f"[ERROR] New API failed ({err}). Using fallback/old data.")
        # If API fails, we could fallback to bulletin, but for simplicity, use old data

    overrides = load_overrides()
    final_stations = []
    
    for bs in base_stations:
        sid = bs['id']
        st_data = dict(bs)
        st_data.pop('search', None)
        
        # Base defaults
        if sid in old_data:
            st_data['inflow'] = old_data[sid].get('inflow', 0)
            st_data['outflow'] = old_data[sid].get('outflow', 0)
            st_data['mode'] = old_data[sid].get('mode', 'auto')
            st_data['sk'] = old_data[sid].get('sk', 'normal')
            if 'storage' in old_data[sid]:
                st_data['storage'] = old_data[sid]['storage']
        else:
            st_data['inflow'] = 0
            st_data['outflow'] = 0
            st_data['mode'] = 'auto'
            st_data['sk'] = 'normal'

        # Apply Live API Data
        if sid in scraped_values and st_data['mode'] != 'manual':
            st_data['inflow'] = scraped_values[sid]['inflow']
            st_data['outflow'] = scraped_values[sid]['outflow']
            st_data['sk'] = determine_sk(st_data['inflow'])
            
        # Apply Storage Data
        if sid in bulletin_storage:
            st_data['storage'] = bulletin_storage[sid]
            
        # Apply Overrides
        if sid in overrides:
            ov = overrides[sid]
            if ov.get('inflow', 0) > 0 or ov.get('outflow', 0) > 0:
                st_data['inflow'] = ov.get('inflow', st_data['inflow'])
                st_data['outflow'] = ov.get('outflow', st_data['outflow'])
                st_data['sk'] = ov.get('sk', determine_sk(st_data['inflow']))
                st_data['mode'] = 'manual'
                
        final_stations.append(st_data)

    payload = {
        "source": "PakFlood Auto-Scraper (GitHub Actions) - Live API",
        "last_updated": bulletin_date,
        "total_stations": len(final_stations),
        "stations": final_stations
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
        
    print(f"[DONE] Saved {len(final_stations)} stations to {OUTPUT_FILE}.")
    push_to_github(payload)

import base64
def push_to_github(payload_dict):
    token_file = os.path.join(os.path.dirname(__file__), "github_token.txt")
    if not os.path.exists(token_file):
        print("[WARN] github_token.txt not found.")
        return
        
    with open(token_file, "r") as f:
        token = f.read().strip()
        
    if not token:
        print("[WARN] Token is empty.")
        return
        
    url = "https://api.github.com/repos/leodeveloperstore-cyber/ffd-flood-watch/contents/live_stations.json"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    
    sha = None
    try:
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code == 200:
            sha = res.json().get("sha")
    except Exception as e:
        print(f"[ERROR] Failed to fetch SHA: {e}")
        return
        
    content_bytes = json.dumps(payload_dict, indent=2, ensure_ascii=False).encode('utf-8')
    content_b64 = base64.b64encode(content_bytes).decode('utf-8')
    
    data = {
        "message": "Auto-update live river telemetry (New Live API)",
        "content": content_b64,
        "branch": "main"
    }
    if sha:
        data["sha"] = sha
        
    try:
        put_res = requests.put(url, headers=headers, json=data, timeout=15)
        if put_res.status_code in [200, 201]:
            print("[SUCCESS] Successfully pushed live_stations.json to GitHub!")
        else:
            print(f"[ERROR] Failed to push to GitHub: {put_res.status_code} - {put_res.text}")
    except Exception as e:
        print(f"[ERROR] Failed to push to GitHub: {e}")

if __name__ == "__main__":
    import urllib3
    urllib3.disable_warnings()
    scrape()
