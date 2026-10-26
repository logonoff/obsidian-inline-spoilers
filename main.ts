import { Plugin, type Editor } from 'obsidian';
import {
	applyAppearance as applyDocumentAppearance,
	removeAppearance,
} from './src/appearance';
import { configureEditorMode, editorPlugins } from './src/editor-mode';
import {
	rerenderExistingReadingView,
	updateReadingMode,
	unloadReadingMode,
} from './src/reading-mode';
import {
	DEFAULT_SETTINGS,
	type InlineSpoilerPluginSettings,
} from './src/settings';
import { InlineSpoilerPluginSettingsTab } from './src/settings-tab';

/*
 * Obsidian plugin interface
 */
export default class InlineSpoilerPlugin extends Plugin {
	settings!: InlineSpoilerPluginSettings;

	/** Documents of the main window and all open popout windows */
	documents = new Set<Document>();

	async onload() {
		this.documents.add(this.app.workspace.containerEl.doc);
		this.app.workspace.iterateAllLeaves((leaf) => {
			this.documents.add(leaf.view.containerEl.doc);
		});

		await this.loadSettings();

		this.registerMarkdownPostProcessor((element, ctx) => {
			updateReadingMode(element, this, ctx);
		});

		rerenderExistingReadingView(this.app.workspace);

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'create-spoiler',
			name: 'Create spoiler',
			editorCallback: (editor: Editor) => {
				const selection = editor.getSelection();
				editor.replaceSelection(`||${selection}||`);
			},
		});

		this.registerEditorExtension(editorPlugins);

		// popout windows have their own document, which needs the appearance applied as well
		this.registerEvent(
			this.app.workspace.on('window-open', (_win, window) => {
				this.documents.add(window.document);
				applyDocumentAppearance(window.document, this.settings);
			}),
		);
		this.registerEvent(
			this.app.workspace.on('window-close', (_win, window) => {
				this.documents.delete(window.document);
			}),
		);

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new InlineSpoilerPluginSettingsTab(this.app, this));
	}

	onunload() {
		this.app.workspace.containerEl.classList.remove(
			'inline_spoilers-revealed',
		);
		unloadReadingMode(this.app.workspace);
		configureEditorMode(false, this.app.workspace);
		this.documents.forEach(removeAppearance);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<InlineSpoilerPluginSettings>,
		);
		this.app.workspace.containerEl.toggleClass(
			'inline_spoilers-revealed',
			this.settings.showAllSpoilers,
		);
		configureEditorMode(this.settings.enableEditorMode);
		this.applyAppearance();
	}

	async saveSettings() {
		this.applyAppearance();
		await this.saveData(this.settings);
	}

	applyAppearance() {
		this.documents.forEach((doc) =>
			applyDocumentAppearance(doc, this.settings),
		);
	}
}
