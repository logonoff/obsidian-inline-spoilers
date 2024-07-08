import { App, Editor, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface InlineSpoilerPluginSettings {
	showAllSpoilers: boolean;
}

const DEFAULT_SETTINGS: InlineSpoilerPluginSettings = {
	showAllSpoilers: false
}

const SPOILER_REGEX = /\|\|(.+?)\|\|/g;

const updateReadingMode = (element: HTMLElement, plugin: InlineSpoilerPlugin) => {
	const allowedElems = element.findAll("p, li, h1, h2, h3, h4, h5, h6, blockquote, em, strong, b, i, a, th, td");

	for (const elem of allowedElems) {
		// Split the text content of the element by the spoiler pattern, keeping the delimiters
		const parts = elem.innerText.split(/(\|\|[^|]+\|\|)/g);

		// Clear the element's content
		while (elem.firstChild) {
			elem.removeChild(elem.firstChild);
		}

		// Process each part
		for (const part of parts) {
			if (SPOILER_REGEX.test(part)) {
				// It's a spoiler, create a span for it
				const spoilerText = part.slice(2, -2); // Remove the || delimiters
				const spoilerSpan = createSpan({ cls: "inline_spoilers-spoiler", text: spoilerText });
				elem.appendChild(spoilerSpan);
			} else {
				// It's regular text, create a text node for it
				const textNode = document.createTextNode(part);
				elem.appendChild(textNode);
			}
		}
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

		const readingView = this.app.workspace.containerEl.querySelector(".markdown-reading-view");
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
		this.app.workspace.containerEl.classList.remove("inline_spoilers-revealed");

		// remove all spoilers
		const spoilers = Array.from(this.app.workspace.containerEl.querySelectorAll(".inline_spoilers-spoiler")) as HTMLElement[];
		for (const spoiler of spoilers) {
			const parent = spoiler.parentNode;
			const spoilerText = document.createTextNode(`||${spoiler.innerText}||`);
			if (parent) {
				parent.replaceChild(spoilerText, spoiler);
			}
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.app.workspace.containerEl.toggleClass("inline_spoilers-revealed", this.settings.showAllSpoilers);
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
					this.app.workspace.containerEl.toggleClass("inline_spoilers-revealed", value);
					await this.plugin.saveSettings();
				}));
	}
}
