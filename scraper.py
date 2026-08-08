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
    {"id": "skardu", "search": "skardu", "en": "Skardu", "ur": "\u0633\u06a9\u0631\u062f\u0648", "river": "Indus", "lat": 35.2971, "lon": 75.6333},
    {"id": "partab", "search": "partab", "en": "Partab Bridge", "ur": "\u067e\u0631\u062a\u0627\u0628 \u0628\u0631\u062c", "river": "Indus", "lat": 35.7333, "lon": 74.6167},
    {"id": "besham", "search": "besham", "en": "Besham", "ur": "\u0628\u0634\u0627\u0645", "river": "Indus", "lat": 34.92, "lon": 72.88},
    {"id": "nowshera", "search": "nowshera", "en": "Nowshera", "ur": "\u0646\u0648\u0634\u06c1\u0631\u06c1", "river": "Kabul", "lat": 34.0153, "lon": 71.9747},
    {"id": "tarbela", "search": "tarbela", "en": "Tarbela Dam", "ur": "\u062a\u0631\u0628\u06cc\u0644\u06c1 \u0688\u06cc\u0645", "river": "Indus", "lat": 34.0874, "lon": 72.6975},
    {"id": "muzaffarabad", "search": "muzaffarabad", "en": "Muzaffarabad", "ur": "\u0645\u0638\u0641\u0631\u0622\u0628\u0627\u062f", "river": "Jhelum", "lat": 34.36, "lon": 73.47},
    {"id": "chattarkallas", "search": "chattar kallas", "en": "Chattar Kallas", "ur": "\u0686\u06be\u062a\u0631 \u06a9\u0644\u0627\u0633", "river": "Jhelum", "lat": 33.88, "lon": 73.45},
    {"id": "azadpattan", "search": "azad pattan", "en": "Azad Pattan", "ur": "\u0622\u0632\u0627\u062f \u067e\u0679\u0646", "river": "Jhelum", "lat": 33.72, "lon": 73.61},
    {"id": "kotli", "search": "kotli", "en": "Kotli", "ur": "\u06a9\u0648\u0679\u0644\u06cc", "river": "Poonch", "lat": 33.15, "lon": 73.9},
    {"id": "mangla", "search": "mangla", "en": "Mangla Dam", "ur": "\u0645\u0646\u06af\u0644\u06c1 \u0688\u06cc\u0645", "river": "Jhelum", "lat": 33.1449, "lon": 73.6426},
    {"id": "marala", "search": "marala", "en": "Marala", "ur": "\u0645\u0631\u0627\u0644\u06c1", "river": "Chenab", "lat": 32.6713, "lon": 74.4646},
    {"id": "khanki", "search": "khanki", "en": "Khanki", "ur": "\u062e\u0627\u0646\u06a9\u06cc", "river": "Chenab", "lat": 32.4, "lon": 73.87},
    {"id": "qadirabad", "search": "qadirabad", "en": "Qadirabad", "ur": "\u0642\u0627\u062f\u0631\u0622\u0628\u0627\u062f", "river": "Chenab", "lat": 32.32, "lon": 73.69},
    {"id": "kalabagh", "search": "kalabagh", "en": "Kalabagh", "ur": "\u06a9\u0627\u0644\u0627 \u0628\u0627\u063a", "river": "Indus", "lat": 32.9667, "lon": 71.55},
    {"id": "chashma", "search": "chashma", "en": "Chashma", "ur": "\u0686\u0634\u0645\u06c1", "river": "Indus", "lat": 32.44, "lon": 71.39},
    {"id": "rasul", "search": "rasul", "en": "New Rasul", "ur": "\u0631\u0633\u0648\u0644 \u0628\u06cc\u0631\u0627\u062c", "river": "Jhelum", "lat": 32.6865, "lon": 73.5283},
    {"id": "chiniot", "search": "chiniot", "en": "Chiniot Bridge", "ur": "\u0686\u0646\u06cc\u0648\u0679 \u067e\u0644", "river": "Chenab", "lat": 31.72, "lon": 72.98},
    {"id": "jassar", "search": "jassar", "en": "Jassar", "ur": "\u062c\u0633\u0631", "river": "Ravi", "lat": 32.1, "lon": 74.87},
    {"id": "shahdara", "search": "shahdara", "en": "Shahdara", "ur": "\u0634\u0627\u06c1\u062f\u0631\u06c1", "river": "Ravi", "lat": 31.62, "lon": 74.3},
    {"id": "balloki", "search": "balloki", "en": "Balloki", "ur": "\u0628\u0644\u0648\u06a9\u06cc", "river": "Ravi", "lat": 31.2225, "lon": 73.8647},
    {"id": "gandasingh", "search": "ganda singh wala", "en": "Ganda Singh Wala", "ur": "\u06af\u0646\u0688\u0627 \u0633\u0646\u06af\u06be \u0648\u0627\u0644\u0627", "river": "Sutlej", "lat": 31.1, "lon": 74.5},
    {"id": "sulemanki", "search": "sulemanki", "en": "Sulaimanki", "ur": "\u0633\u0644\u06cc\u0645\u0627\u0646\u06a9\u06cc", "river": "Sutlej", "lat": 30.3792, "lon": 73.8569},
    {"id": "islam", "search": "islam", "en": "Islam", "ur": "\u0627\u0633\u0644\u0627\u0645 \u0628\u06cc\u0631\u0627\u062c", "river": "Sutlej", "lat": 29.82, "lon": 72.55},
    {"id": "sidhnai", "search": "sidhnai", "en": "Sidhnai", "ur": "\u0633\u062f\u06be\u0646\u0627\u0626\u06cc", "river": "Ravi", "lat": 30.57, "lon": 72.14},
    {"id": "trimmu", "search": "trimmu", "en": "Trimmu", "ur": "\u062a\u0631\u06cc\u0645\u0648\u06ba", "river": "Chenab", "lat": 31.18, "lon": 72.15},
    {"id": "taunsa", "search": "taunsa", "en": "Taunsa", "ur": "\u062a\u0648\u0646\u0633\u06c1 \u0628\u06cc\u0631\u0627\u062c", "river": "Indus", "lat": 30.5061, "lon": 70.8384},
    {"id": "panjnad", "search": "panjnad", "en": "Panjnad", "ur": "\u067e\u0646\u062c\u0646\u062f", "river": "Chenab", "lat": 29.35, "lon": 71.02},
    {"id": "guddu", "search": "guddu", "en": "Guddu", "ur": "\u06af\u0688\u0648 \u0628\u06cc\u0631\u0627\u062c", "river": "Indus", "lat": 28.42, "lon": 69.7},
    {"id": "sukkur", "search": "sukkur", "en": "Sukkur", "ur": "\u0633\u06a9\u06be\u0631 \u0628\u06cc\u0631\u0627\u062c", "river": "Indus", "lat": 27.5298, "lon": 68.8471},
    {"id": "kotri", "search": "kotri", "en": "Kotri", "ur": "\u06a9\u0648\u0679\u0631\u06cc \u0628\u06cc\u0631\u0627\u062c", "river": "Indus", "lat": 25.367, "lon": 68.3516},
    {"id": "baglihar", "search": "baglihar dam (india)", "en": "Baglihar Dam (India)", "ur": "\u0628\u06af\u0644\u06cc\u06c1\u0627\u0631 \u0688\u06cc\u0645 (\u0628\u06be\u0627\u0631\u062a)", "river": "Chenab (India)", "lat": 33.15, "lon": 75.31},
    {"id": "salal", "search": "salal dam (india)", "en": "Salal Dam (India)", "ur": "\u0633\u0644\u0627\u0644 \u0688\u06cc\u0645 (\u0628\u06be\u0627\u0631\u062a)", "river": "Chenab (India)", "lat": 33.08, "lon": 74.82},
    {"id": "kishanganga", "search": "kishanganga dam (india)", "en": "Kishanganga Dam (India)", "ur": "\u06a9\u0634\u0646 \u06af\u0646\u06af\u0627 \u0688\u06cc\u0645 (\u0628\u06be\u0627\u0631\u062a)", "river": "Neelum (India)", "lat": 34.64, "lon": 74.75},
    {"id": "bhakra", "search": "bhakra dam (india)", "en": "Bhakra Dam (India)", "ur": "\u0628\u06be\u0627\u06a9\u0691\u0627 \u0688\u06cc\u0645 (\u0628\u06be\u0627\u0631\u062a)", "river": "Sutlej (India)", "lat": 31.41, "lon": 76.43},
    {"id": "pong", "search": "pong dam (india)", "en": "Pong Dam (India)", "ur": "\u067e\u0648\u0646\u06af \u0688\u06cc\u0645 (\u0628\u06be\u0627\u0631\u062a)", "river": "Beas (India)", "lat": 31.96, "lon": 75.94},
    {"id": "thein", "search": "thein dam (india)", "en": "Thein Dam (India)", "ur": "\u062a\u06be\u06cc\u0646 \u0688\u06cc\u0645 (\u0628\u06be\u0627\u0631\u062a)", "river": "Ravi (India)", "lat": 32.44, "lon": 75.73}
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
                    scraped_values[bs['id']] = {
                        "inflow": inv, 
                        "outflow": outv,
                        "recording_time": pst.get("recording_time"),
                        "cyp_discharge": pst.get("cyp_discharge"),
                        "cyp_date": pst.get("cyp_date"),
                        "cyp_status": pst.get("cyp_status"),
                        "forecast_status": pst.get("forecast_status"),
                        "forecast_qual": pst.get("forecast_qual"),
                        "forecast_quant": pst.get("forecast_quant")
                    }
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
            for k in ["recording_time", "cyp_discharge", "cyp_date", "cyp_status", "forecast_status", "forecast_qual", "forecast_quant"]:
                if k in old_data[sid]:
                    st_data[k] = old_data[sid][k]
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
            
            for k in ["recording_time", "cyp_discharge", "cyp_date", "cyp_status", "forecast_status", "forecast_qual", "forecast_quant"]:
                if scraped_values[sid].get(k) is not None:
                    st_data[k] = scraped_values[sid][k]
            
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
        "source": "PakFlood PC Auto-Scraper - Live API",
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
