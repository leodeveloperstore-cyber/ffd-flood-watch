import http.server
import socketserver
import json
import os

PORT = 8080
DIRECTORY = "."

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_POST(self):
        if self.path == '/api/update_station':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode('utf-8')
            try:
                # The data is expected to be JSON
                update_req = json.loads(post_data)
                
                # Load current live_stations.json
                stations_file = 'live_stations.json'
                if os.path.exists(stations_file):
                    with open(stations_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                else:
                    data = {"source": "Manual", "total_stations": 0, "stations": []}
                
                # Find the station and update it
                station_id = update_req.get('id')
                found = False
                for st in data.get('stations', []):
                    if st.get('id') == station_id:
                        st['inflow'] = update_req.get('inflow', st.get('inflow'))
                        st['outflow'] = update_req.get('outflow', st.get('outflow'))
                        st['sk'] = update_req.get('sk', st.get('sk'))
                        st['trend'] = update_req.get('trend', st.get('trend', 'steady'))
                        st['mode'] = update_req.get('mode', 'manual')
                        found = True
                        break
                
                if not found:
                    # Add as new station
                    data.setdefault('stations', []).append({
                        "id": station_id,
                        "inflow": update_req.get('inflow', 0),
                        "outflow": update_req.get('outflow', 0),
                        "sk": update_req.get('sk', 'normal'),
                        "trend": update_req.get('trend', 'steady'),
                        "mode": update_req.get('mode', 'manual')
                    })
                
                # Write back to file
                with open(stations_file, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

# To allow reusing the port if it was left open
socketserver.TCPServer.allow_reuse_address = True

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving at http://localhost:{PORT}")
    httpd.serve_forever()
