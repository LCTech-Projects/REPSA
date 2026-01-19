"""
Vercel serverless function handler for Flask app
"""
import sys
import os

# Add the api directory to the path
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app

app = create_app()

def handler(request):
    """
    Vercel serverless function handler
    """
    from vercel import Response
    
    # Get the request path and method
    path = request.path
    method = request.method
    
    # Create a WSGI environment
    environ = {
        'REQUEST_METHOD': method,
        'PATH_INFO': path,
        'QUERY_STRING': request.query_string or '',
        'CONTENT_TYPE': request.headers.get('Content-Type', ''),
        'CONTENT_LENGTH': request.headers.get('Content-Length', '0'),
        'SERVER_NAME': request.host,
        'SERVER_PORT': '443',
        'wsgi.version': (1, 0),
        'wsgi.url_scheme': 'https',
        'wsgi.input': request.body,
        'wsgi.errors': sys.stderr,
        'wsgi.multithread': False,
        'wsgi.multiprocess': True,
        'wsgi.run_once': False,
    }
    
    # Add headers
    for key, value in request.headers.items():
        key = 'HTTP_' + key.upper().replace('-', '_')
        environ[key] = value
    
    # Call the Flask app
    response = Response()
    
    def start_response(status, headers):
        response.status = status
        response.headers = dict(headers)
    
    result = app(environ, start_response)
    
    # Combine the response body
    response.body = b''.join(result).decode('utf-8')
    
    return response
