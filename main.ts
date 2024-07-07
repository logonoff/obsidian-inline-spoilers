import { syntaxTree } from "@codemirror/language";
import {
	Extension,
	RangeSetBuilder,
	StateField,
	Transaction,
} from "@codemirror/state";
import {
	Decoration,
	DecorationSet, EditorView, WidgetType
} from "@codemirror/view";
import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	showAllSpoilers: boolean;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	showAllSpoilers: false
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		this.registerEditorExtension(emojiListField);

		this.registerMarkdownPostProcessor((element, context) => {
			const paragraphs = element.findAll("p");

			for (const paragraph of paragraphs) {
				const text = paragraph.innerText.trim();

				// find all substrings that start and end with the string "||"
				const matches = text.match(/\|\|[^|]+\|\|/g);

				console.log(text, matches);

				if (matches) {
					for (const match of matches) {
						const spoilerSpan = `<span style="background-color: ${this.settings.showAllSpoilers ? "var(--code-background)" : "var(--text-normal)"}; color: var(--text-normal);" onclick="this.style.backgroundColor='var(--code-background)';">${match.slice(2, -2)}</span>`

						paragraph.innerHTML = paragraph.innerHTML.replace(match, spoilerSpan);
					}
				}
			}
		});

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'create-spoiler',
			name: 'Create spoiler',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const selection = editor.getSelection();
				editor.replaceSelection(`||${selection}||`);
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

export class EmojiWidget extends WidgetType {
	toDOM(view: EditorView): HTMLElement {
		const div = document.createElement("span");

		div.innerText = "👉";

		return div;
	}
}

export const emojiListField = StateField.define<DecorationSet>({
	create(state): DecorationSet {
		return Decoration.none;
	},
	update(oldState: DecorationSet, transaction: Transaction): DecorationSet {
		const builder = new RangeSetBuilder<Decoration>();

		syntaxTree(transaction.state).iterate({
			enter(node) {
				if (node.type.name.startsWith("list")) {
					// Position of the '-' or the '*'.
					const listCharFrom = node.from - 2;

					builder.add(
						listCharFrom,
						listCharFrom + 1,
						Decoration.replace({
							widget: new EmojiWidget(),
						})
					);
				}
			},
		});

		return builder.finish();
	},
	provide(field: StateField<DecorationSet>): Extension {
		return EditorView.decorations.from(field);
	},
});

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
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
					await this.plugin.saveSettings();
				}));
	}
}
