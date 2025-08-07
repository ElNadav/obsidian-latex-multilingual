# lang_server.py (v8 - With RTL Support)
from flask import Flask, request
from flask_cors import CORS
import pyautogui

app = Flask(__name__)
CORS(app) # This line enables CORS for all routes

@app.route('/press_shortcut')
def press_shortcut():
    """
    Presses a combination of keys passed as a URL parameter.
    Example: /press_shortcut?keys=alt,shiftleft,1
    """
    keys_str = request.args.get('keys')
    if not keys_str:
        return "Error: 'keys' parameter is missing", 400

    keys_list = keys_str.split(',')

    try:
        pyautogui.hotkey(*keys_list)
        print(f"Successfully pressed shortcut: {' + '.join(keys_list)}")
        return "OK", 200
    except Exception as e:
        print(f"Error pressing shortcut: {e}")
        return str(e), 500

@app.route('/status')
def status():
    """Endpoint for the plugin to check if the server is running."""
    return "Server is running", 200

if __name__ == '__main__':
    print("Starting language switcher server (Dynamic Shortcuts) on http://127.0.0.1:8181")
    print("Use Ctrl+C to stop the server.")
    app.run(host="127.0.0.1", port=8181)
