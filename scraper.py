#!/usr/bin/env python3
import os, json, time, requests, re
from bs4 import BeautifulSoup

FFD_URL = "https://ffd.pmd.gov.pk/bulletin/bulletin"
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "live_stations.json")
OVERRIDE_FILE = os.path.join(os.path.dirname(__file__), "manual_overrides.json")

# Base stations definition (Indian dams will be handled via manual overrides)
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
    
    # Manual overrides stations
    {"id": "baglihar", "en": "Baglihar Dam", "ur": "بگلیہار ڈیم", "river": "Chenab (India)", "lat": 33.15, "lon": 75.31},
    {"id": "salal", "en": "Salal Dam", "ur": "سلال ڈیم", "river": "Chenab (India)", "lat": 33.08, "lon": 74.82},
    {"id": "kishanganga", "en": "Kishanganga", "ur": "کشن گنگا", "river": "Neelum (India)", "lat": 34.64, "lon": 74.75},
    {"id": "bhakra", "en": "Bhakra Dam", "ur": "بھاکڑا ڈیم", "river": "Sutlej (India)", "lat": 31.41, "lon": 76.43},
    {"id": "pong", "en": "Pong Dam", "ur": "پونگ ڈیم", "river": "Beas (India)", "lat": 31.96, "lon": 75.94},
    {"id": "thein", "en": "Thein Dam", "ur": "تھین ڈیم", "river": "Ravi (India)", "lat": 32.44, "lon": 75.73}
]

def clean_number(txt):
    nums = re.findall(r'\d+', str(txt).replace(',', ''))
    if nums:
        return int(nums[0])
    return 0

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
        except Exception as e:
            print(f"[WARN] Failed to load overrides: {e}")
    return {}

def scrape():
    print(f"[PakFlood Auto-Scraper] Starting fetch from {FFD_URL} ...")
    
    old_data = {}
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                old_data = {s['id']: s for s in json.load(f).get('stations', [])}
        except:
            pass

    scraped_values = {}
    bulletin_date = time.strftime("%d-%b-%Y %H:%M PKT")
    
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        res = requests.get(FFD_URL, headers=headers, timeout=20, verify=False)
        if res.status_code == 200:
            soup = BeautifulSoup(res.text, 'html.parser')
            
            # Try to get the exact bulletin date
            date_tags = soup.find_all(string=re.compile('Dated', re.I))
            if date_tags:
                bulletin_date = date_tags[0].get_text(strip=True) + " 06:00 PKT"

            # 1. Scrape River Flows (Table with Tarbela)
            target_table = None
            for table in soup.find_all('table'):
                if 'Tarbela' in table.get_text():
                    target_table = table
                    break
            
            if target_table:
                # Find all rows in this table
                for tr in target_table.find_all('tr'):
                    tds = tr.find_all('td')
                    if len(tds) >= 4:
                        # Extract the station name
                        station_name_cell = tds[1].get_text(strip=True).lower()
                        
                        for bs in base_stations:
                            if 'search' in bs and bs['search'] in station_name_cell:
                                # Data might contain commas or decimal points. `clean_number` just takes the first sequence of digits.
                                # But actually it's better to parse floats.
                                try:
                                    inv = int(float(tds[2].get_text(strip=True).replace(',', '')) * 1000)
                                except:
                                    inv = 0
                                try:
                                    outv = int(float(tds[3].get_text(strip=True).replace(',', '')) * 1000)
                                except:
                                    outv = 0
                                
                                if inv > 0 or outv > 0:
                                    scraped_values[bs['id']] = {
                                        "inflow": inv,
                                        "outflow": outv
                                    }
                                break

            # 2. Scrape Storage Data (Tables with "Storage" and "% live")
            storage_data = {}
            for table in soup.find_all('table'):
                txt = table.get_text()
                if 'Storage' in txt and '% live' in txt:
                    # Depending on position, first storage table is Tarbela, second is Mangla. But let's check surrounding text.
                    # As a heuristic, we can grab all of them.
                    # Instead of parsing the table structurally which is fragile, let's just use regex on the text
                    match = re.search(r'Storage.*?([\d.]+)%\s*live', txt, re.IGNORECASE)
                    if match:
                        if 'tarbela' not in storage_data:
                            storage_data['tarbela'] = float(match.group(1))
                        elif 'mangla' not in storage_data:
                            storage_data['mangla'] = float(match.group(1))
            
            # We'll attach storage to the scraped_values
            if 'tarbela' in scraped_values and 'tarbela' in storage_data:
                scraped_values['tarbela']['storage'] = storage_data['tarbela']
            if 'mangla' in scraped_values and 'mangla' in storage_data:
                scraped_values['mangla']['storage'] = storage_data['mangla']

            print(f"[SUCCESS] Scraped data for {len(scraped_values)} stations from HTML.")
        else:
            print(f"[ERROR] HTTP {res.status_code}. Using fallback data.")
    except Exception as e:
        print(f"[ERROR] Network/Parsing error: {e}. Using fallback data.")

    overrides = load_overrides()

    final_stations = []
    
    for bs in base_stations:
        sid = bs['id']
        st_data = dict(bs)
        st_data.pop('search', None)
        
        if sid in old_data:
            st_data['inflow'] = old_data[sid].get('inflow', 0)
            st_data['outflow'] = old_data[sid].get('outflow', 0)
            st_data['mode'] = old_data[sid].get('mode', 'auto')
            st_data['sk'] = old_data[sid].get('sk', 'normal')
        else:
            st_data['inflow'] = 0
            st_data['outflow'] = 0
            st_data['mode'] = 'auto'
            st_data['sk'] = 'normal'

        if sid in scraped_values and st_data['mode'] != 'manual':
            st_data['inflow'] = scraped_values[sid]['inflow']
            st_data['outflow'] = scraped_values[sid]['outflow']
            st_data['sk'] = determine_sk(st_data['inflow'])
            if 'storage' in scraped_values[sid]:
                st_data['storage'] = scraped_values[sid]['storage']
            
        if sid in overrides:
            ov = overrides[sid]
            if ov.get('inflow', 0) > 0 or ov.get('outflow', 0) > 0:
                st_data['inflow'] = ov.get('inflow', st_data['inflow'])
                st_data['outflow'] = ov.get('outflow', st_data['outflow'])
                st_data['sk'] = ov.get('sk', determine_sk(st_data['inflow']))
                st_data['mode'] = 'manual'
                
        final_stations.append(st_data)

    payload = {
        "source": "PakFlood Auto-Scraper (GitHub Actions)",
        "last_updated": bulletin_date,
        "total_stations": len(final_stations),
        "stations": final_stations
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
        
    print(f"[DONE] Saved {len(final_stations)} stations to {OUTPUT_FILE}.")

if __name__ == "__main__":
    import urllib3
    urllib3.disable_warnings() # Disable SSL warnings if any
    scrape()
