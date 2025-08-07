# Obsidian Latex Multilingual

An Obsidian plugin designed for bilingual users who frequently switch between a Right-to-Left (RTL) language (like Hebrew) and a Left-to-Right (LTR) language (like English), especially when writing mathematical notes with LaTeX.

This plugin automates the tedious process of switching keyboard layouts and text direction, allowing for a seamless and efficient note-taking experience.

## Features

- **Automatic Language Switching:** Intelligently detects when your cursor enters or exits a MathJax environment (
    
    ...
    
    or `$...$`) and automatically switches your system's keyboard layout.
    
- **Self-Contained Server:** The plugin automatically starts and stops its own lightweight Python background server, so you never have to manage it manually.
    
- **Manual Direction Control:** Provides a command to manually force the current line's text direction to LTR. This is perfect for easily navigating and editing complex inline math expressions within an RTL paragraph.
    
- **Full Customization:** A comprehensive settings menu allows you to:
    
    - Enable or disable the plugin.
        
    - Specify the paths to your Python executable and the server script.
        
    - Define the exact keyboard shortcuts for switching to each language.
        
- **Live Status Indicators:** A status bar item shows the current language mode (EN/HE) and the server's connection status. The settings menu also provides a live "Online/Offline" check.
    

## How It Works

The plugin uses a robust client-server model to safely interact with your operating system:

1. **The Obsidian Plugin (Client):** Written in TypeScript, this part lives inside Obsidian. It uses the modern CodeMirror 6 editor's syntax tree to reliably detect when the cursor is inside a math environment.
    
2. **The Python Server (Backend):** A lightweight Flask server that runs silently in the background (managed by the plugin). When it receives a command from the plugin, it uses `pyautogui` to simulate the keyboard shortcuts you've configured, changing your system's language.
    

This architecture ensures that the plugin never leaves the secure sandbox of Obsidian, while still giving you powerful automation capabilities.

## Requirements

- Obsidian v1.5.0 or newer.
    
- Python 3.x installed on your system.
    
- The following Python libraries: `Flask`, `pyautogui`, `flask-cors`.
    

## Installation and Setup

### Step 1: Set Up the Python Server

1. Create a permanent folder on your computer for the server (e.g., `C:\obsidian-switcher-server`).
    
2. Inside that folder, create a new file named `lang_server.py` and copy the Python code from our guide into it.
    
3. Open a Command Prompt or PowerShell and install the required libraries by running:
    
    ```
    pip install Flask pyautogui flask-cors
    ```
    

### Step 2: Install the Plugin in Obsidian

1. Go to the [Releases page](https://www.google.com/search?q=https://github.com/YOUR_USERNAME/obsidian-latex-multilingual/releases "null") of this GitHub repository.
    
2. Download the latest `main.js`, `manifest.json`, and `styles.css` files.
    
3. In your Obsidian vault, go to `Settings` > `Community Plugins`.
    
4. Click the folder icon to open your vault's plugins folder (`.obsidian/plugins`).
    
5. Create a new folder inside `plugins` named `obsidian-latex-multilingual`.
    
6. Copy the three downloaded files (`main.js`, `manifest.json`, `styles.css`) into this new folder.
    
7. Go back to Obsidian's Community Plugins settings and click the "Reload plugins" button.
    
8. Find "Obsidian Latex Multilingual" in the list and enable it.
    

### Step 3: Configure the Plugin

1. Go to `Settings` > `Community Plugins` and click the gear icon next to "Obsidian Latex Multilingual".
    
2. **Crucially, you must fill in the "Server Script Path"** with the full, absolute path to the `lang_server.py` file you created in Step 1.
    
3. Verify that the "Python Executable Path" is correct (for most users, the default "python" is fine).
    
4. Customize your keyboard shortcuts for switching between English and Hebrew.
    
5. (Optional) Go to `Settings` > `Hotkeys` and assign a convenient hotkey (like `Ctrl+E`) to the "Toggle LTR for Active Line" command.
    

The plugin is now ready to use!

## License

This plugin is released under the MIT License.