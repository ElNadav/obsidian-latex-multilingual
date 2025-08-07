import { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { SyntaxNodeRef } from '@lezer/common';
import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { spawn, ChildProcess } from 'child_process';

// --- SETTINGS ---
interface LanguageSwitcherSettings {
	isPluginEnabled: boolean;
	pythonPath: string;
	scriptPath: string;
	englishShortcut: string;
	hebrewShortcut: string;
}

const DEFAULT_SETTINGS: LanguageSwitcherSettings = {
	isPluginEnabled: true,
	pythonPath: 'python',
	scriptPath: '',
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

	async onload() {
		await this.loadSettings();
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
		// Clean up body class on unload
		document.body.classList.remove('force-active-line-ltr');
	}

	startServer() {
		if (this.serverProcess) return;
		if (!this.settings.scriptPath || !this.settings.pythonPath) {
			new Notice("Python or script path not set in settings.");
			this.updateStatusBar();
			return;
		}
		this.serverProcess = spawn(this.settings.pythonPath, [this.settings.scriptPath]);
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
			const response = await fetch(`http://127.0.0.1:${port}/press_shortcut?keys=${shortcut}`);
			if (!response.ok) throw new Error("Server responded with an error.");
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
		this.app.workspace.updateOptions(); // Force editor refresh
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

        const statusSetting = new Setting(containerEl)
			.setName('Server Status')
			.setDesc('Check if the Python background server is running correctly.');
        const statusText = statusSetting.controlEl.createEl("span", { text: "Checking..." });
        const checkStatus = async () => {
			statusText.setText("Checking...");
            try {
                const response = await fetch(`http://127.0.0.1:8181/status`);
                if (response.ok) {
                    statusText.setText("Online");
                    statusText.style.color = "var(--text-success)";
                } else {
                    statusText.setText("Offline (Error)");
                    statusText.style.color = "var(--text-error)";
                }
            } catch (error) {
                statusText.setText("Offline");
                statusText.style.color = "var(--text-error)";
            }
        };
        statusSetting.addButton(button => button.setButtonText("Check Again").onClick(checkStatus));
        checkStatus();

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

		containerEl.createEl('h3', { text: 'Paths' });
		new Setting(containerEl)
			.setName('Python Executable Path')
			.setDesc('The full path to your python.exe.')
			.addText(text => text
				.setPlaceholder('C:\\Users\\...\\python.exe')
				.setValue(this.plugin.settings.pythonPath)
				.onChange(async (value) => {
					this.plugin.settings.pythonPath = value;
					await this.plugin.saveSettings();
				}));
		
		new Setting(containerEl)
			.setName('Server Script Path')
			.setDesc('The full path to the lang_server.py script.')
			.addText(text => text
				.setPlaceholder('C:\\obsidian-switcher-server\\lang_server.py')
				.setValue(this.plugin.settings.scriptPath)
				.onChange(async (value) => {
					this.plugin.settings.scriptPath = value;
					await this.plugin.saveSettings();
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
}
