"""
Vercel serverless function for Flask API
This file is placed in api/api/ to match Vercel's routing structure
"""
import sys
import os

# Add parent directories to path
current_dir = os.path.dirname(os.path.abspath(__file__))
api_dir = os.path.dirname(current_dir)
sys.path.insert(0, api_dir)

from app import create_app

# Create Flask app instance
app = create_app()

# Vercel expects a handler function
def handler(request):
    """
    Vercel serverless function handler
    Vercel passes request as a dictionary-like object
    """
    # Vercel Python runtime format
    if isinstance(request, dict):
        # Standard Vercel format
        path = request.get('path', '/')
        method = request.get('method', 'GET')
        headers = request.get('headers', {})
        body = request.get('body', b'')
        query = request.get('queryStringParameters', {})
        query_string = '&'.join([f"{k}={v}" for k, v in query.items()]) if query else ''
    else:
        # Fallback for object format
        path = getattr(request, 'path', '/')
        method = getattr(request, 'method', 'GET')
        headers = getattr(request, 'headers', {})
        body = getattr(request, 'body', b'')
        query_string = getattr(request, 'query_string', '')
    
    # Remove /api prefix
    if path.startswith('/api'):
        path = path[4:]
    if not path:
        path = '/'
    
    # Create WSGI environment
    environ = {
        'REQUEST_METHOD': method,
        'PATH_INFO': path,
        'QUERY_STRING': query,
        'CONTENT_TYPE': headers.get('Content-Type', 'application/json'),
        'CONTENT_LENGTH': str(len(body) if body else 0),
        'SERVER_NAME': headers.get('Host', 'localhost'),
        'SERVER_PORT': '443',
        'wsgi.version': (1, 0),
        'wsgi.url_scheme': 'https',
        'wsgi.input': body if isinstance(body, bytes) else body.encode('utf-8'),
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
    result = app(environ, start_response)
    
    # Collect response body
    for chunk in result:
        if chunk:
            response_body.append(chunk)
    
    # Return response
    body_str = b''.join(response_body).decode('utf-8') if response_body else ''
    
    if use_vercel_types:
        return Response(
            status=status_code[0],
            headers=response_headers,
            body=body_str
        )
    else:
        return {
            'statusCode': status_code[0],
            'headers': response_headers,
            'body': body_str
        }
