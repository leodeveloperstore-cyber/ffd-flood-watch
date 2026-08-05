import urllib.request, urllib.parse, json, time

cities_str = 'Astore, Babusar, Bagrote, Bunji, Chilas, Gilgit, Gupis, Hunza, Skardu, Balakot, Cherat, Chitral, D.I.Khan, Dir, Drosh, Kakul, Kalam, Kohat, Malam Jabba, Parachinar, Pattan, Peshawar, Risalpur, Saidu Sharif, Attock, Bahawalnagar, Bahawalpur, Bhakkar, Chakwal, D.G.Khan, Faisalabad, Gujranwala, Gujrat, Hafizabad, Islamabad, Jhang, Jhelum, Joharabad, Kamra, Kasur, Khanewal, Khanpur, Kot Addu, Lahore, Layyah, Mangla, Karachi, Quetta, Multan, Sialkot'

out_list = []
for city in cities_str.split(','):
    c = city.strip()
    try:
        url = 'https://geocoding-api.open-meteo.com/v1/search?name=' + urllib.parse.quote(c) + '&count=1'
        res = json.load(urllib.request.urlopen(url))
        if 'results' in res and len(res['results']) > 0:
            lat = res['results'][0]['latitude']
            lon = res['results'][0]['longitude']
            out_list.append(f"  {{en:'{c}', ur:'{c}', lat:{lat}, lon:{lon}}},")
        else:
            print('Not found:', c)
    except Exception as e:
        print('Error:', c, e)
    time.sleep(0.5)

with open('new_cities.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out_list))
print('Done!')
