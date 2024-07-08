import { App, Editor, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface InlineSpoilerPluginSettings {
	showAllSpoilers: boolean;
}

const DEFAULT_SETTINGS: InlineSpoilerPluginSettings = {
	showAllSpoilers: false
}

const SPOILER_REGEX = /\|\|(.+?)\|\|/g;

const updateReadingMode = (element: HTMLElement, plugin: InlineSpoilerPlugin) => {
	const paragraphs = element.findAll("p");

	for (const paragraph of paragraphs) {
		let newHTML = paragraph.innerHTML;

		// find all substrings that start and end with the string "||"
		const matches = paragraph.innerText.match(SPOILER_REGEX);

		if (matches) {
			for (const match of matches) {
				const spoilerSpan = document.createElement("span");
				spoilerSpan.classList.add("inline_spoilers-spoiler");
				spoilerSpan.innerText = match.slice(2, -2);
				newHTML = newHTML.replace(match, spoilerSpan.outerHTML);
			}
		}

		paragraph.innerHTML = newHTML;
	}

	const spoilers = element.findAll(".inline_spoilers-spoiler");

	for (const spoiler of spoilers) {
		plugin.registerDomEvent(spoiler, 'click', () => {
			spoiler.classList.toggle("inline_spoilers-revealed");
		});
	}
}

export default class InlineSpoilerPlugin extends Plugin {
	settings: InlineSpoilerPluginSettings;

	async onload() {
		await this.loadSettings();

		const readingView = document.querySelector(".markdown-reading-view");
		if (readingView) {
			updateReadingMode(readingView as HTMLElement, this);
		}

		this.registerMarkdownPostProcessor((element) => {
			updateReadingMode(element, this);
		});

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'create-spoiler',
			name: 'Create spoiler',
			editorCallback: (editor: Editor) => {
				const selection = editor.getSelection();
				editor.replaceSelection(`||${selection}||`);
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new InlineSpoilerPluginSettingsTab(this.app, this));
	}

	onunload() {
		// undo changes to the body
		document.body.classList.remove("inline_spoilers-revealed");

		// remove all spoilers
		const spoilers = Array.from(document.querySelectorAll(".inline_spoilers-spoiler"));
		for (const spoiler of spoilers) {
			spoiler.outerHTML = `||${spoiler.innerHTML}||`;
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		if (this.settings.showAllSpoilers) {
			document.body.classList.add("inline_spoilers-revealed");
		} else {
			document.body.classList.remove("inline_spoilers-revealed");
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class InlineSpoilerPluginSettingsTab extends PluginSettingTab {
	plugin: InlineSpoilerPlugin;

	constructor(app: App, plugin: InlineSpoilerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Reveal all spoilers')
			.setDesc('Reveal all spoilers by default.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showAllSpoilers)
				.onChange(async (value) => {
					this.plugin.settings.showAllSpoilers = value;

					if (value) {
						document.body.classList.add("inline_spoilers-revealed");
					} else {
						document.body.classList.remove("inline_spoilers-revealed");
					}

					await this.plugin.saveSettings();
				}));
	}
}
