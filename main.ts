import { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { SyntaxNodeRef } from '@lezer/common';
import { App, Notice, Plugin, PluginSettingTab, Setting, normalizePath } from 'obsidian';
import { spawn, ChildProcess, exec } from 'child_process';
import * as path from 'path';

// --- SETTINGS ---
interface LanguageSwitcherSettings {
	isPluginEnabled: boolean;
	basePythonPath: string;
	englishShortcut: string;
	hebrewShortcut: string;
}

const DEFAULT_SETTINGS: LanguageSwitcherSettings = {
	isPluginEnabled: true,
	basePythonPath: 'python',
	englishShortcut: 'alt,shiftleft,2',
	hebrewShortcut: 'alt,shiftleft,1',
}

// --- MAIN PLUGIN CLASS ---
export default class AutoLanguageSwitcher extends Plugin {
	settings: LanguageSwitcherSettings;
	statusBarItemEl: HTMLElement;
	isInsideMath = false;
	serverProcess: ChildProcess | null = null;
	debounceTimer: number | null = null;
	serverFolderPath: string;
	venvPythonPath: string;
	serverScriptPath: string;

	async onload() {
		await this.loadSettings();

		// Define paths relative to the plugin folder
		// The 'basePath' property is not in the official API, so we cast to 'any' to access it.
		const vaultPath = (this.app.vault.adapter as any).basePath;
		const pluginDir = path.join(vaultPath, this.manifest.dir ?? '');
		
		this.serverFolderPath = normalizePath(path.join(pluginDir, 'server'));
		this.venvPythonPath = normalizePath(path.join(this.serverFolderPath, 'venv', 'Scripts', 'python.exe'));
		this.serverScriptPath = normalizePath(path.join(this.serverFolderPath, 'lang_server.py'));

		this.addSettingTab(new LanguageSwitcherSettingTab(this.app, this));
		this.statusBarItemEl = this.addStatusBarItem();

		if (this.settings.isPluginEnabled) this.startServer();
		else this.updateStatusBar();

		this.registerEditorExtension(
			EditorView.updateListener.of((update) => {
				if (update.docChanged || update.selectionSet) {
					this.debounceLanguageCheck(update.view);
				}
			})
		);

        this.addCommand({
            id: 'toggle-language-switching',
            name: 'Toggle Auto Language Switching',
            callback: async () => {
                this.settings.isPluginEnabled = !this.settings.isPluginEnabled;
				if (this.settings.isPluginEnabled) this.startServer();
				else this.stopServer();
                await this.saveSettings();
                new Notice(`Auto language switching ${this.settings.isPluginEnabled ? 'enabled' : 'disabled'}.`);
            }
        });

		this.addCommand({
			id: 'toggle-active-line-ltr',
			name: 'Toggle LTR for Active Line',
			callback: () => {
				document.body.classList.toggle('force-active-line-ltr');
				const isForced = document.body.classList.contains('force-active-line-ltr');
				new Notice(`Forced LTR for active line is now ${isForced ? 'ON' : 'OFF'}.`);
			}
		});
	}

	onunload() {
		this.stopServer();
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		document.body.classList.remove('force-active-line-ltr');
	}

	startServer() {
		if (this.serverProcess) return;

		console.log("Starting Python server...");
		// Use the Python executable from the virtual environment
		this.serverProcess = spawn(this.venvPythonPath, [this.serverScriptPath]);
		this.updateStatusBar();

		if (this.serverProcess) {
			this.serverProcess.on('spawn', () => setTimeout(() => this.checkServerConnection(), 1000));
			if (this.serverProcess.stderr) {
				this.serverProcess.stderr.on('data', (data) => {
					console.error(`Server stderr: ${data}`);
					this.statusBarItemEl.setText('Lang: Server Error');
				});
			}
			this.serverProcess.on('close', (code) => {
				this.serverProcess = null;
				this.updateStatusBar();
			});
		}
	}

	stopServer() {
		if (this.serverProcess) {
			this.serverProcess.kill();
			this.serverProcess = null;
			this.updateStatusBar();
		}
	}

	debounceLanguageCheck(view: EditorView) {
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		this.debounceTimer = window.setTimeout(() => this.performLanguageCheck(view), 50);
	}

    performLanguageCheck = async (view: EditorView) => {
        if (!this.settings.isPluginEnabled || !this.serverProcess) return;

        let currentlyInMath = false;
        const selection = view.state.selection.main;
        
        syntaxTree(view.state).iterate({
            enter: (node: SyntaxNodeRef) => {
                if (node.name.includes("math")) {
                    if (node.from <= selection.head && node.to >= selection.head) {
                        currentlyInMath = true;
                    }
                }
            },
        });

		if (currentlyInMath !== this.isInsideMath) {
			this.isInsideMath = currentlyInMath;
			await this.switchKeyboardLanguage(this.isInsideMath ? 'english' : 'hebrew');
		}
    }

	async switchKeyboardLanguage(language: 'english' | 'hebrew') {
		const shortcut = language === 'english' ? this.settings.englishShortcut : this.settings.hebrewShortcut;
		const port = 8181;
		try {
			await fetch(`http://127.0.0.1:${port}/press_shortcut?keys=${shortcut}`);
            this.updateStatusBar();
		} catch (error) {
			console.error("Failed to press shortcut. Server might be down.");
			this.updateStatusBar();
		}
	}

	async checkServerConnection() {
		try {
			await fetch(`http://127.0.0.1:8181/status`);
			this.updateStatusBar();
		} catch (error) {
			this.updateStatusBar();
		}
	}

    updateStatusBar() {
		if (!this.settings.isPluginEnabled) {
			this.statusBarItemEl.setText('Lang: Off');
		} else if (!this.serverProcess) {
			this.statusBarItemEl.setText('Lang: Disconnected');
		} else {
			this.statusBarItemEl.setText(this.isInsideMath ? 'Lang: EN' : 'Lang: HE');
		}
    }

    async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.app.workspace.updateOptions();
	}
}

// --- SETTINGS TAB CLASS ---
class LanguageSwitcherSettingTab extends PluginSettingTab {
	plugin: AutoLanguageSwitcher;

	constructor(app: App, plugin: AutoLanguageSwitcher) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();
		containerEl.createEl('h2', {text: 'Auto Language Switcher Settings'});

        new Setting(containerEl)
			.setName('Enable Auto Switching')
			.setDesc('Turn the automatic language switching on or off.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.isPluginEnabled)
				.onChange(async (value) => {
					this.plugin.settings.isPluginEnabled = value;
					if (value) this.plugin.startServer();
					else this.plugin.stopServer();
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: 'Server Setup' });
		new Setting(containerEl)
			.setName('Base Python Executable Path')
			.setDesc('The full path to your globally installed python.exe. This is only needed for the initial server setup.')
			.addText(text => text
				.setPlaceholder('C:\\Users\\...\\python.exe')
				.setValue(this.plugin.settings.basePythonPath)
				.onChange(async (value) => {
					this.plugin.settings.basePythonPath = value;
					await this.plugin.saveSettings();
				}));

		const setupDesc = document.createDocumentFragment();
		setupDesc.append(
			'Click this button to create an isolated Python environment for the server inside the plugin folder.',
			setupDesc.createEl('br'),
			'This ensures the plugin\'s dependencies do not conflict with your other Python projects.'
		);

		new Setting(containerEl)
			.setName('Setup Server Environment')
			.setDesc(setupDesc)
			.addButton(button => button
				.setButtonText("Setup")
				.setCta()
				.onClick(async () => {
					button.setButtonText("Setting up...");
					button.setDisabled(true);

					const venvPath = normalizePath(this.plugin.serverFolderPath + '/venv');
					const requirementsPath = normalizePath(this.plugin.serverFolderPath + '/requirements.txt');

					const venvCommand = `"${this.plugin.settings.basePythonPath}" -m venv "${venvPath}"`;
					const pipCommand = `"${this.plugin.venvPythonPath}" -m pip install -r "${requirementsPath}"`;
					
					try {
						new Notice("Creating virtual environment...");
						await this.runCommand(venvCommand);
						new Notice("Installing dependencies...");
						await this.runCommand(pipCommand);
						new Notice("Server setup complete! Please restart the plugin.", 10000);
						button.setButtonText("Setup Complete");
					} catch (err) {
						new Notice("Server setup failed. Check the developer console (Ctrl+Shift+I) for errors.", 10000);
						console.error(err);
						button.setButtonText("Setup Failed");
					}
				}));

		containerEl.createEl('h3', { text: 'Shortcuts' });
        new Setting(containerEl)
			.setName('English Shortcut')
			.setDesc('Keys to press for English, separated by commas.')
			.addText(text => text
				.setPlaceholder('alt,shiftleft,2')
				.setValue(this.plugin.settings.englishShortcut)
				.onChange(async (value) => {
					this.plugin.settings.englishShortcut = value;
					await this.plugin.saveSettings();
				}));

        new Setting(containerEl)
			.setName('Hebrew Shortcut')
			.setDesc('Keys to press for Hebrew, separated by commas.')
			.addText(text => text
				.setPlaceholder('alt,shiftleft,1')
				.setValue(this.plugin.settings.hebrewShortcut)
				.onChange(async (value) => {
					this.plugin.settings.hebrewShortcut = value;
					await this.plugin.saveSettings();
				}));
	}

	// Helper function to run shell commands
	async runCommand(command: string): Promise<string> {
		return new Promise((resolve, reject) => {
			exec(command, (error, stdout, stderr) => {
				if (error) {
					console.error(`exec error: ${error}`);
					return reject(error);
				}
				if (stderr) {
					console.error(`stderr: ${stderr}`);
				}
				resolve(stdout);
			});
		});
	}
}
