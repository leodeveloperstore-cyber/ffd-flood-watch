import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

with open('new_cities.txt', 'r', encoding='utf-8') as f:
    new_cities = f.read()

# Replace weatherCities
html = re.sub(
    r'const weatherCities = \[.*?\];',
    'const weatherCities = [\n' + new_cities + '\n];',
    html,
    flags=re.DOTALL
)

# Add Search input in HTML
search_html = '''      <div class="sec-head" style="display:flex; justify-content:space-between; align-items:center;">
        <span>Live Weather — Major Pakistani Cities</span>
        <input type="text" id="weather-search" placeholder="Search city..." style="padding:4px 8px; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-main); font-size:0.8rem; width:150px;">
      </div>'''

html = re.sub(
    r'<div class="sec-head">Live Weather — Major Pakistani Cities</div>',
    search_html,
    html
)

# Add JS logic for search filtering
search_js = '''
document.getElementById('weather-search').addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  const cards = document.querySelectorAll('.weather-city-card');
  cards.forEach(card => {
    const city = card.querySelector('.wc-city').innerText.toLowerCase();
    if(city.includes(term)) card.style.display = 'flex';
    else card.style.display = 'none';
  });
});
'''

# insert before loadWeather();
html = html.replace('loadWeather();', search_js + '\nloadWeather();')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('Updated index.html')
