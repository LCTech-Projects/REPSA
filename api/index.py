"""
Vercel serverless function entry point for Flask API
This file handles all API routes and forwards them to the Flask app
"""
import sys
import os
import json

# Add the api directory to the path
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app

# Create Flask app instance (singleton pattern for serverless)
app = None

def get_app():
    global app
    if app is None:
        app = create_app()
    return app

def handler(request):
    """
    Main handler for Vercel serverless functions
    Routes all /api/* requests to the Flask app
    """
    from http.server import BaseHTTPRequestHandler
    
    # Get Flask app
    flask_app = get_app()
    
    # Parse request
    method = request.get('method', 'GET')
    path = request.get('path', '/')
    headers = request.get('headers', {})
    body = request.get('body', '')
    query = request.get('query', {})
    
    # Remove /api prefix if present
    if path.startswith('/api'):
        path = path[4:]
    if not path:
        path = '/'
    
    # Build query string
    query_string = '&'.join([f"{k}={v}" for k, v in query.items()])
    
    # Create WSGI environment
    environ = {
        'REQUEST_METHOD': method,
        'PATH_INFO': path,
        'QUERY_STRING': query_string,
        'CONTENT_TYPE': headers.get('Content-Type', 'application/json'),
        'CONTENT_LENGTH': str(len(body) if body else 0),
        'SERVER_NAME': headers.get('Host', 'localhost'),
        'SERVER_PORT': '443',
        'wsgi.version': (1, 0),
        'wsgi.url_scheme': 'https',
        'wsgi.input': body.encode('utf-8') if isinstance(body, str) else body,
        'wsgi.errors': sys.stderr,
        'wsgi.multithread': False,
        'wsgi.multiprocess': True,
        'wsgi.run_once': False,
    }
    
    # Add HTTP headers
    for key, value in headers.items():
        http_key = 'HTTP_' + key.upper().replace('-', '_')
        environ[http_key] = value
    
    # Response storage
    status_code = [200]
    response_headers = {}
    response_body = []
    
    def start_response(status, headers_list):
        status_code[0] = int(status.split(' ')[0])
        response_headers.update(dict(headers_list))
    
    # Call Flask app
    result = flask_app(environ, start_response)
    
    # Collect response body
    for chunk in result:
        if chunk:
            response_body.append(chunk)
    
    # Return response
    return {
        'statusCode': status_code[0],
        'headers': response_headers,
        'body': b''.join(response_body).decode('utf-8') if response_body else ''
    }
