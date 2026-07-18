#!/usr/bin/env python3
"""Dev server cho game — TẮT CACHE để sửa file là hiện ngay (không cần hard-refresh).
Chạy:  python3 serve.py   (mặc định cổng 8123)
"""
import http.server
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *args):
        pass  # đỡ spam log


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
    print(f"Dev server (no-cache) chạy tại http://localhost:{PORT}")
    print("Sửa file .js/.css rồi refresh thường (F5) là thấy ngay. Ctrl+C để dừng.")
    httpd.serve_forever()
