import { syntaxTree } from '@codemirror/language';
import { Extension, RangeSetBuilder } from '@codemirror/state';
import {
	Decoration,
	DecorationSet,
	EditorView,
	PluginSpec,
	PluginValue,
	ViewPlugin,
	ViewUpdate,
} from '@codemirror/view';
import { App, Editor, Plugin, PluginSettingTab, Setting, Workspace } from 'obsidian';

const SPOILER_REGEX = /\|\|(.+?)\|\|/g;

/*
 * Reading mode
 */
const processNode = (node: Node) => {
	if (node.nodeType === Node.TEXT_NODE) {
		if (!node.textContent || !node.parentNode) return;

		// Split the text node content by the spoiler pattern, keeping the delimiters
		const parts = node.textContent.split(/(\|\|[^|]+\|\|)/g);
		const fragment = document.createDocumentFragment();

		for (const part of parts) {
			if (SPOILER_REGEX.test(part)) {
				// It's a spoiler, create a span for it
				const spoilerText = part.slice(2, -2); // Remove the || delimiters
				// obsidian global helper
				// eslint-disable-next-line no-undef
				const spoilerSpan = createSpan({ cls: "inline_spoilers-spoiler", text: spoilerText });
				fragment.appendChild(spoilerSpan);
			} else {
				// It's regular text, create a text node for it
				const textNode = document.createTextNode(part);
				fragment.appendChild(textNode);
			}
		}

		// Replace the original text node with the new fragment
		node.parentNode.replaceChild(fragment, node);
	} else if (node.nodeType === Node.ELEMENT_NODE) {
		// For element nodes, recursively process their child nodes
		Array.from(node.childNodes).forEach(processNode);
	}
}

const updateReadingMode = (element: HTMLElement, plugin: InlineSpoilerPlugin) => {
	const allowedElems = element.findAll("p, li, h1, h2, h3, h4, h5, h6, blockquote, em, strong, b, i, a, th, td");

	for (const elem of allowedElems) {
		// Process each child node of the element
		Array.from(elem.childNodes).forEach(processNode);
	}

	const spoilers = element.findAll(".inline_spoilers-spoiler");

	for (const spoiler of spoilers) {
		plugin.registerDomEvent(spoiler, 'click', () => {
			spoiler.classList.toggle("inline_spoilers-revealed");
		});
	}
}

const unloadReadingMode = (workspace: Workspace) => {
	// remove all spoilers from reader mode
	const spoilers = Array.from(workspace.containerEl.querySelectorAll<HTMLElement>(".inline_spoilers-spoiler"));
	for (const spoiler of spoilers) {
		const parent = spoiler.parentNode;
		const spoilerText = document.createTextNode(`||${spoiler.innerText}||`);
		if (parent) {
			parent.replaceChild(spoilerText, spoiler);
		}
	}
}



/*
 * Editor mode
 */
const spoilerDecoration = Decoration.mark({
	class: "inline_spoilers-editor-spoiler",
	tagName: "span",
});

const spoilerDelimiterDecoration = Decoration.mark({
	class: "inline_spoilers-editor-spoiler-delimiter",
	tagName: "span",
});

class SpoilerEditorPlugin implements PluginValue {
	decorations: DecorationSet;

	constructor(view: EditorView) {
		this.decorations = this.buildDecorations(view);
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged) {
			this.decorations = this.buildDecorations(update.view);
		}
	}

	destroy() { }

	buildDecorations(view: EditorView): DecorationSet {
		const builder = new RangeSetBuilder<Decoration>();
		const ranges: { from: number, to: number, isDelimiter: boolean }[] = [];

		for (const { from, to } of view.visibleRanges) {
			syntaxTree(view.state).iterate({
				from,
				to,
				enter(node) {
					const text = view.state.sliceDoc(node.from, node.to);
					let match: RegExpExecArray | null;

					while ((match = SPOILER_REGEX.exec(text)) !== null) {
						const start = match.index;
						const end = start + match[0].length;

						const text = view.state.sliceDoc(start, end);

						if (!text.startsWith("||") && !text.endsWith("||")) {
							continue;  // sanity check
						}

						ranges.push({ from: start, to: start + 2, isDelimiter: true });
						ranges.push({ from: start + 2, to: end - 2, isDelimiter: false });
						ranges.push({ from: end - 2, to: end, isDelimiter: true });
					}
				},
			});
		}

		// Sort ranges by `from` position to prevent Codemirror error
		ranges.sort((a, b) => a.from - b.from);

		// Add sorted ranges to the builder
		for (const range of ranges) {
			builder.add(range.from, range.to, range.isDelimiter ? spoilerDelimiterDecoration : spoilerDecoration);
		}

		return builder.finish();
	}
}

const pluginSpec: PluginSpec<SpoilerEditorPlugin> = {
	decorations: (value: SpoilerEditorPlugin) => value.decorations,
};

const spoilerEditorPlugin = ViewPlugin.fromClass(
	SpoilerEditorPlugin,
	pluginSpec
);

const editorPlugins: Extension[] = [];

const loadEditorPlugin = (workspace: Workspace) => {
	if (!editorPlugins.includes(spoilerEditorPlugin)) {
		editorPlugins.push(spoilerEditorPlugin);
	}

	workspace.updateOptions();
}

const unloadEditorPlugin = (workspace: Workspace) => {
	const index = editorPlugins.indexOf(spoilerEditorPlugin);
	if (index !== -1) {
		editorPlugins.splice(index, 1);
	}

	workspace.updateOptions();
}

/*
 * Settings
 */
interface InlineSpoilerPluginSettings {
	showAllSpoilers: boolean;
	enableEditorMode: boolean;
}

const DEFAULT_SETTINGS: InlineSpoilerPluginSettings = {
	showAllSpoilers: false,
	enableEditorMode: false,
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
			.setDesc('Always show all inline spoilers, regardless of whether they are clicked or not.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showAllSpoilers)
				.onChange(async (value) => {
					this.plugin.settings.showAllSpoilers = value;
					this.app.workspace.containerEl.toggleClass("inline_spoilers-revealed", value);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Hide spoilers in editor view (experimental)')
			.setDesc('Hide spoilers in the editor until your cursor is on the same line as the spoiler.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableEditorMode)
				.onChange(async (value) => {
					this.plugin.settings.enableEditorMode = value;

					if (value) {
						loadEditorPlugin(this.app.workspace);
					} else {
						unloadEditorPlugin(this.app.workspace);
					}

					await this.plugin.saveSettings();
				}));
	}
}



/*
 * Obsidian plugin interface
 */
export default class InlineSpoilerPlugin extends Plugin {
	settings!: InlineSpoilerPluginSettings;

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

		this.registerEditorExtension(editorPlugins);

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new InlineSpoilerPluginSettingsTab(this.app, this));
	}

	onunload() {
		this.app.workspace.containerEl.classList.remove("inline_spoilers-revealed");
		unloadReadingMode(this.app.workspace);
		unloadEditorPlugin(this.app.workspace);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<InlineSpoilerPluginSettings>);
		this.app.workspace.containerEl.toggleClass("inline_spoilers-revealed", this.settings.showAllSpoilers);
		if (this.settings.enableEditorMode) {
			editorPlugins.push(spoilerEditorPlugin);
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
