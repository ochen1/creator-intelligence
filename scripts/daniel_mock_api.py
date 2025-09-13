import json
from http.server import BaseHTTPRequestHandler, HTTPServer
import re
import time
import random

sample_data = [
    {
        "labels": ["UBC", "teen", "golf", "female"],
        "data": {
            "text": "this girl is clearly an avid golf player who regularly goes to <Golf Course Name> on saturdays. They seem to attend UBC."
        }
    },
    {
        "labels": ["UAB", "teen", "skiing", "male", "food", "travel"],
        "data": {
            "text": "this person likes to travel a lot on vacations, especially to ski resorts. They also seem to enjoy trying out different foods and food photography."
        }
    }
]

class SimpleHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        match = re.match(r'^/profile-instagram-user/([^/]+)$', self.path)
        if match:
            time.sleep(random.uniform(1.5, 2.5))  # Add random delay around 2s
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            result = random.choice(sample_data)
            self.wfile.write(json.dumps(result).encode('utf-8'))
        else:
            self.send_response(404)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'Not Found')

def run(server_class=HTTPServer, handler_class=SimpleHandler, port=13732):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f'Serving on port {port}...')
    httpd.serve_forever()

if __name__ == '__main__':
    run()